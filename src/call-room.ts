import { DurableObject } from "cloudflare:workers";
import { elevenLabsTts, transcribe, translateText } from "./pipeline.js";

const IDLE_MS = 30 * 60 * 1000;

type Participant = {
  id: string;
  speakLang: string;
  hearLang: string;
};

export class CallRoom extends DurableObject<Env> {
  private participants = new Map<string, Participant & { ws: WebSocket }>();
  private wsToId = new Map<WebSocket, string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  private async bumpIdleAlarm(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + IDLE_MS);
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
  }

  async fetch(request: Request): Promise<Response> {
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
      let parsed: { type?: string; speakLang?: string; hearLang?: string; payload?: unknown };
      try {
        parsed = JSON.parse(message) as typeof parsed;
      } catch {
        return;
      }
      if (parsed.type === "join") {
        const id = crypto.randomUUID();
        const speakLang = parsed.speakLang ?? "en";
        const hearLang = parsed.hearLang ?? "en";
        this.wsToId.set(ws, id);
        this.participants.set(id, { id, ws, speakLang, hearLang });
        const others = [...this.participants.keys()].filter((k) => k !== id);
        ws.send(
          JSON.stringify({
            type: "joined",
            participantId: id,
            isHost: others.length === 0,
          })
        );
        for (const oid of others) {
          const o = this.participants.get(oid);
          o?.ws.send(JSON.stringify({ type: "peer-joined", participantId: id }));
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

    try {
      const text = await transcribe(this.env, bytes);
      if (!text) return;
      const translated = await translateText(
        this.env,
        text,
        speaker.speakLang,
        other.hearLang
      );
      if (!translated) return;
      const audio = await elevenLabsTts(this.env, translated, other.hearLang);
      if (audio && audio.byteLength > 0) {
        other.ws.send(audio);
      }
    } catch (e) {
      console.error("pipeline error", e);
      ws.send(JSON.stringify({ type: "error", message: "translation failed" }));
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const id = this.wsToId.get(ws);
    if (!id) return;
    this.wsToId.delete(ws);
    this.participants.delete(id);
    for (const p of this.participants.values()) {
      p.ws.send(JSON.stringify({ type: "peer-left", participantId: id }));
    }
    if (this.participants.size === 0) {
      await this.ctx.storage.deleteAlarm();
    }
  }
}
