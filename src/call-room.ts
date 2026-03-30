import { DurableObject } from "cloudflare:workers";
import { elevenLabsTts, transcribe, translateText, announceTts } from "./pipeline.js";
import { langLabel } from "./lang.js";

const INTRO_TEXT = "Ready for live translation.";

const IDLE_MS = 30 * 60 * 1000;
const MAX_NAME = 64;

type Participant = {
  id: string;
  speakLang: string;
  hearLang: string;
  displayName: string;
  voiceType: string;
};

export class CallRoom extends DurableObject<Env> {
  private participants = new Map<string, Participant & { ws: WebSocket }>();
  private wsToId = new Map<WebSocket, string>();
  /** Set from the first participant’s join message for this room session. */
  private hostSpeakLang: string | null = null;
  private hostHearLang: string | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async bumpIdleAlarm(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
  }

  private async sendAnnouncement(ws: WebSocket, text: string): Promise<void> {
    ws.send(JSON.stringify({ type: "announcement", text }));
    try {
      const audio = await announceTts(this.env, text);
      if (audio && audio.byteLength > 0) {
        ws.send(audio);
      }
    } catch (e) {
      console.error("announcement tts error", e);
    }
  }

  private resetRoomState(): void {
    this.hostSpeakLang = null;
    this.hostHearLang = null;
  }

  async alarm(): Promise<void> {
    for (const p of this.participants.values()) {
      try {
        p.ws.close(4408, "room idle timeout");
      } catch {
        /* ignore */
      }
    }
    this.participants.clear();
    this.wsToId.clear();
    this.resetRoomState();
  }

  async fetch(request: Request): Promise<Response> {
    const u = new URL(request.url);
    if (request.method === "GET" && (u.pathname === "/__meta" || u.pathname.endsWith("/__meta"))) {
      const hasHost = this.hostSpeakLang != null && this.hostHearLang != null;
      return Response.json({
        hostSpeakLang: this.hostSpeakLang,
        hostHearLang: this.hostHearLang,
        hasHost,
      });
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    this.ctx.acceptWebSocket(server);
    await this.bumpIdleAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    await this.bumpIdleAlarm();

    if (typeof message === "string") {
      let parsed: {
        type?: string;
        speakLang?: string;
        hearLang?: string;
        displayName?: string;
        voiceType?: string;
        payload?: unknown;
      };
      try {
        parsed = JSON.parse(message) as typeof parsed;
      } catch {
        return;
      }
      if (parsed.type === "join") {
        const id = crypto.randomUUID();
        const speakLang = parsed.speakLang ?? "en";
        const hearLang = parsed.hearLang ?? "en";
        let displayName = String(parsed.displayName ?? "Guest").trim().slice(0, MAX_NAME);
        if (!displayName) displayName = "Guest";
        const voiceType = parsed.voiceType === "male" ? "male" : "female";

        const isFirst = this.participants.size === 0;
        if (isFirst) {
          this.hostSpeakLang = speakLang;
          this.hostHearLang = hearLang;
        }

        this.wsToId.set(ws, id);
        this.participants.set(id, { id, ws, speakLang, hearLang, displayName, voiceType });
        const others = [...this.participants.keys()].filter((k) => k !== id);
        const existingPeers = others.map((oid) => {
          const op = this.participants.get(oid);
          return {
            participantId: oid,
            displayName: op?.displayName ?? "Guest",
          };
        });
        ws.send(
          JSON.stringify({
            type: "joined",
            participantId: id,
            isHost: others.length === 0,
            hostSpeakLang: this.hostSpeakLang,
            hostHearLang: this.hostHearLang,
            displayName,
            peers: existingPeers,
          })
        );

        if (others.length === 0) {
          this.ctx.waitUntil(this.sendAnnouncement(ws, INTRO_TEXT));
        } else {
          ws.send(JSON.stringify({ type: "announcement", text: `Connected. Speak naturally.` }));
        }

        for (const oid of others) {
          const o = this.participants.get(oid);
          if (!o) continue;
          o.ws.send(
            JSON.stringify({
              type: "peer-joined",
              participantId: id,
              displayName,
            })
          );
          o.ws.send(JSON.stringify({
            type: "announcement",
            text: `${displayName} joined. Translation active.`,
          }));
        }
        return;
      }
      if (parsed.type === "signal") {
        const fromId = this.wsToId.get(ws);
        if (!fromId) return;
        for (const [pid, p] of this.participants) {
          if (pid !== fromId) {
            p.ws.send(
              JSON.stringify({
                type: "signal",
                fromParticipantId: fromId,
                payload: parsed.payload,
              })
            );
          }
        }
        return;
      }
      if (parsed.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }
      return;
    }

    const fromId = this.wsToId.get(ws);
    if (!fromId) return;
    const speaker = this.participants.get(fromId);
    if (!speaker) return;

    let other: (Participant & { ws: WebSocket }) | undefined;
    for (const [pid, p] of this.participants) {
      if (pid !== fromId) {
        other = p;
        break;
      }
    }
    if (!other) return;

    const bytes = new Uint8Array(message);
    if (!this.env.ELEVENLABS_KEY) {
      ws.send(JSON.stringify({ type: "error", message: "ELEVENLABS_KEY not configured" }));
      return;
    }

    const speakerWs = ws;
    const otherWs = other.ws;
    const speakerName = speaker.displayName;
    const speakerLang = speaker.speakLang;
    const otherHearLang = other.hearLang;
    const speakerVoiceType = speaker.voiceType;
    const env = this.env;

    this.ctx.waitUntil((async () => {
      let text: string;
      try {
        text = await transcribe(env, bytes);
      } catch (e) {
        console.error("transcribe error", e);
        return;
      }
      if (!text) return;

      speakerWs.send(JSON.stringify({
        type: "transcript", from: "self", name: speakerName, text,
      }));

      const translatePromise = translateText(env, text, speakerLang, otherHearLang);

      let translated: string;
      try {
        translated = await translatePromise;
      } catch (e) {
        console.error("translate error", e);
        return;
      }
      if (!translated) return;

      otherWs.send(JSON.stringify({
        type: "transcript", from: "peer", name: speakerName, text: translated,
      }));

      try {
        const audio = await elevenLabsTts(env, translated, speakerVoiceType);
        if (audio && audio.byteLength > 0) {
          otherWs.send(audio);
        }
      } catch (e) {
        console.error("tts error", e);
      }
    })());
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const id = this.wsToId.get(ws);
    if (!id) return;
    const leaving = this.participants.get(id);
    const leaveName = leaving?.displayName ?? "A participant";
    this.wsToId.delete(ws);
    this.participants.delete(id);
    for (const p of this.participants.values()) {
      p.ws.send(JSON.stringify({ type: "peer-left", participantId: id }));
      p.ws.send(JSON.stringify({ type: "announcement", text: `${leaveName} left.` }));
    }
    if (this.participants.size === 0) {
      await this.ctx.storage.deleteAlarm();
      this.resetRoomState();
    }
  }
}
