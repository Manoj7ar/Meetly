import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";

const LANGS = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文 (Mandarin)" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "hi", label: "हिन्दी" },
  { code: "ar", label: "العربية" },
  { code: "pt", label: "Português" },
];

const ROOM_RE = /^\/(MEETLY-[A-Z0-9-]+)\/?$/;

function getPath() {
  return window.location.pathname.replace(/\/+$/, "") || "/";
}

/** When the UI is on Vercel (or any static host), set MEETLY_API_ORIGIN at build time to your Cloudflare Worker URL (no trailing slash). */
function apiOrigin() {
  const raw = typeof window !== "undefined" ? window.__MEETLY_API_ORIGIN__ : "";
  if (typeof raw === "string" && raw.trim()) return raw.trim().replace(/\/$/, "");
  return window.location.origin;
}

function langLabel(code) {
  return LANGS.find((l) => l.code === code)?.label || code;
}

function normalizeRoomParam(raw) {
  let s = String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  s = s.replace(/^MEETLY[-\u2013]?/i, "");
  s = s.replace(/[^A-Z0-9-]/g, "");
  return "MEETLY-" + s.slice(0, 12);
}

function wsUrlForRoom(room) {
  const u = new URL(apiOrigin());
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = "/call";
  u.search = "?room=" + encodeURIComponent(room);
  u.hash = "";
  return u.toString();
}

async function postCreateRoom() {
  const url = new URL("/api/room", apiOrigin()).href;
  const r = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
    cache: "no-store",
  });
  const text = await r.text();
  if (!r.ok) {
    const hint = text.trim().startsWith("<") ? "Got HTML instead of JSON — is the API route running?" : text.slice(0, 200);
    throw new Error(hint || "HTTP " + r.status);
  }
  let j;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON from server");
  }
  if (!j.room) throw new Error("No room in response");
  return String(j.room);
}

function Landing({ onRoomCreated, onGoToJoin }) {
  const [speak, setSpeak] = useState("en");
  const [hear, setHear] = useState("es");
  const [joinInput, setJoinInput] = useState("");
  const [hostName, setHostName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState("");

  const createMeeting = async () => {
    setCreateErr("");
    sessionStorage.setItem("meetly_speak", speak);
    sessionStorage.setItem("meetly_hear", hear);
    const name = hostName.trim() || "Host";
    sessionStorage.setItem("meetly_display_name", name.slice(0, 64));
    sessionStorage.setItem("meetly_role", "host");
    setCreating(true);
    try {
      const room = await postCreateRoom();
      onRoomCreated(room);
    } catch (e) {
      console.error(e);
      setCreateErr(e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const joinWithCode = () => {
    const code = normalizeRoomParam(joinInput);
    if (code.length < 10) {
      alert("Enter a valid code");
      return;
    }
    sessionStorage.setItem("meetly_speak", speak);
    sessionStorage.setItem("meetly_hear", hear);
    onGoToJoin(code);
  };

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-10">
      <h1 className="text-4xl font-semibold text-teal tracking-tight mb-2">Meetly</h1>
      <p className="text-sm text-ink/70 mb-8 text-center max-w-sm">
        Speak your language — they hear theirs. Video + translated voice.
      </p>

      <form
        className="w-full max-w-md bg-offwhite rounded-2xl shadow-sm border border-teal/10 p-6 space-y-4"
        onSubmit={(e) => e.preventDefault()}
        noValidate
      >
        <label className="block text-xs font-medium text-teal uppercase tracking-wide">
          Your name (optional)
          <input
            id="meetly-host-name"
            type="text"
            value={hostName}
            onChange={(e) => setHostName(e.target.value)}
            placeholder="Host"
            className="mt-1 w-full rounded-lg border border-teal/20 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium text-teal uppercase tracking-wide">
            I speak
            <select
              id="meetly-speak"
              value={speak}
              onChange={(e) => {
                setSpeak(e.target.value);
                sessionStorage.setItem("meetly_speak", e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-teal/20 bg-cream px-3 py-2 text-sm text-ink"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-teal uppercase tracking-wide">
            I hear
            <select
              id="meetly-hear"
              value={hear}
              onChange={(e) => {
                setHear(e.target.value);
                sessionStorage.setItem("meetly_hear", e.target.value);
              }}
              className="mt-1 w-full rounded-lg border border-teal/20 bg-cream px-3 py-2 text-sm text-ink"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {createErr && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2" role="alert">
            {createErr}
          </p>
        )}

        <button
          type="button"
          id="meetly-create-btn"
          disabled={creating}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void createMeeting();
          }}
          className="w-full rounded-xl bg-teal text-cream py-3 text-sm font-semibold hover:bg-teal-dark disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create meeting"}
        </button>

        <div className="relative py-2">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-teal/15" />
          </div>
          <div className="relative flex justify-center text-xs uppercase text-ink/50">or join</div>
        </div>

        <div className="flex gap-2">
          <input
            id="meetly-join-input"
            type="text"
            placeholder="Paste code (e.g. X7K9P2)"
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value)}
            className="flex-1 rounded-xl border border-teal/20 bg-cream px-3 py-2 text-sm placeholder:text-ink/40"
          />
          <button
            type="button"
            id="meetly-join-btn"
            onClick={(e) => {
              e.preventDefault();
              joinWithCode();
            }}
            className="rounded-xl border-2 border-teal text-teal px-4 py-2 text-sm font-semibold hover:bg-teal/5"
          >
            Join
          </button>
        </div>
      </form>
    </div>
  );
}

function JoinLobby({ onEnterRoom, onGoHome }) {
  const params = new URLSearchParams(window.location.search);
  const initialCode = normalizeRoomParam(params.get("code") || "");
  const [room, setRoom] = useState(initialCode.length >= 10 ? initialCode : "");
  const [codeInput, setCodeInput] = useState(initialCode.length >= 10 ? "" : "");
  const [displayName, setDisplayName] = useState("");
  const [speak, setSpeak] = useState("en");
  const [meta, setMeta] = useState({ hasHost: false, hostSpeakLang: null, hostHearLang: null });
  const [metaErr, setMetaErr] = useState("");

  const effectiveRoom = room || normalizeRoomParam(codeInput);

  const fetchMeta = useCallback(async () => {
    const code = room || normalizeRoomParam(codeInput);
    if (code.length < 10) return;
    try {
      const r = await fetch(new URL("/api/room/" + encodeURIComponent(code) + "/meta", apiOrigin()).href);
      const j = await r.json();
      setMeta({
        hasHost: !!j.hasHost,
        hostSpeakLang: j.hostSpeakLang,
        hostHearLang: j.hostHearLang,
      });
      setMetaErr("");
    } catch {
      setMetaErr("Could not load room info");
    }
  }, [room, codeInput]);

  useEffect(() => {
    if (effectiveRoom.length < 10) return;
    fetchMeta();
    const t = setInterval(fetchMeta, 2500);
    return () => clearInterval(t);
  }, [effectiveRoom, fetchMeta]);

  const enterRoom = () => {
    const code = effectiveRoom;
    if (code.length < 10) {
      alert("Enter a valid meeting code");
      return;
    }
    const name = displayName.trim().slice(0, 64) || "Guest";
    sessionStorage.setItem("meetly_role", "guest");
    sessionStorage.setItem("meetly_display_name", name);
    sessionStorage.setItem("meetly_speak", speak);
    sessionStorage.setItem("meetly_hear", speak);
    onEnterRoom(code);
  };

  return (
    <div className="min-h-full flex flex-col items-center px-4 py-10">
      <h1 className="text-2xl font-semibold text-teal mb-1">Join meeting</h1>
      <p className="text-sm text-ink/60 mb-6 text-center max-w-sm">Enter your name and language. You’ll hear translations in the same language you speak.</p>

      <div className="w-full max-w-md bg-offwhite rounded-2xl shadow-sm border border-teal/10 p-6 space-y-4">
        {room.length < 10 && (
          <label className="block text-xs font-medium text-teal uppercase tracking-wide">
            Meeting code
            <input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              placeholder="MEETLY-… or short code"
              className="mt-1 w-full rounded-lg border border-teal/20 bg-cream px-3 py-2 text-sm font-mono"
            />
          </label>
        )}
        {room.length >= 10 && (
          <p className="text-sm font-mono text-teal">
            Room: <strong>{room}</strong>
          </p>
        )}

        {!meta.hasHost && effectiveRoom.length >= 10 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Waiting for the host to start the meeting…
          </p>
        )}
        {meta.hasHost && (meta.hostSpeakLang || meta.hostHearLang) && (
          <div className="text-xs text-ink/80 bg-cream border border-teal/15 rounded-lg px-3 py-2 space-y-1">
            <div>
              <span className="text-teal font-medium">Host speaks:</span> {langLabel(meta.hostSpeakLang || "en")}
            </div>
            <div>
              <span className="text-teal font-medium">Host hears:</span> {langLabel(meta.hostHearLang || "en")}
            </div>
          </div>
        )}
        {metaErr && <p className="text-sm text-red-600">{metaErr}</p>}

        <label className="block text-xs font-medium text-teal uppercase tracking-wide">
          Your name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Alex"
            className="mt-1 w-full rounded-lg border border-teal/20 bg-cream px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-xs font-medium text-teal uppercase tracking-wide">
          I speak (you’ll hear translations in this language too)
          <select
            value={speak}
            onChange={(e) => setSpeak(e.target.value)}
            className="mt-1 w-full rounded-lg border border-teal/20 bg-cream px-3 py-2 text-sm"
          >
            {LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={enterRoom}
          disabled={effectiveRoom.length < 10}
          className="w-full rounded-xl bg-teal text-cream py-3 text-sm font-semibold hover:bg-teal-dark disabled:opacity-50"
        >
          Join meeting
        </button>
        <button type="button" onClick={onGoHome} className="w-full text-sm text-ink/50 underline">
          Back home
        </button>
      </div>
    </div>
  );
}

function CallView({ room, mode, onLeave }) {
  const [speak] = useState(() => sessionStorage.getItem("meetly_speak") || "en");
  const [hear] = useState(() => sessionStorage.getItem("meetly_hear") || "en");
  const [status, setStatus] = useState(mode === "host" || mode === "guest" ? "Starting…" : "");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [err, setErr] = useState("");
  const [remotePeerName, setRemotePeerName] = useState("");

  const localName = sessionStorage.getItem("meetly_display_name") || (mode === "host" ? "Host" : "Guest");

  const localV = useRef(null);
  const remoteV = useRef(null);
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const isHostRef = useRef(false);
  const iceBufRef = useRef([]);
  const remoteDescSetRef = useRef(false);
  const audioCtxRef = useRef(null);
  const playBusyRef = useRef(false);
  const playQueueRef = useRef([]);
  const micOnRef = useRef(true);
  const camOnRef = useRef(true);
  const startOnceKey = "meetly_call_started_" + room;

  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    camOnRef.current = camOn;
  }, [camOn]);

  const flushIce = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !remoteDescSetRef.current) return;
    const buf = iceBufRef.current.splice(0);
    for (const c of buf) {
      try {
        await pc.addIceCandidate(c);
      } catch (_) {}
    }
  }, []);

  const playNextInQueue = useCallback(async () => {
    if (playBusyRef.current || playQueueRef.current.length === 0) return;
    playBusyRef.current = true;
    const chunk = playQueueRef.current.shift();
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") await ctx.resume();
      const ab = chunk.slice(0);
      const audioBuf = await ctx.decodeAudioData(ab);
      const src = ctx.createBufferSource();
      src.buffer = audioBuf;
      src.connect(ctx.destination);
      src.onended = () => {
        playBusyRef.current = false;
        playNextInQueue();
      };
      src.start();
    } catch (e) {
      console.warn("audio decode", e);
      playBusyRef.current = false;
      playNextInQueue();
    }
  }, []);

  const enqueueAudio = useCallback(
    (buf) => {
      playQueueRef.current.push(buf);
      playNextInQueue();
    },
    [playNextInQueue]
  );

  const teardown = useCallback(() => {
    try {
      if (recRef.current) recRef.current.stop();
    } catch (_) {}
    recRef.current = null;
    try {
      if (wsRef.current) wsRef.current.close();
    } catch (_) {}
    wsRef.current = null;
    try {
      if (pcRef.current) pcRef.current.close();
    } catch (_) {}
    pcRef.current = null;
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    iceBufRef.current = [];
    remoteDescSetRef.current = false;
  }, []);

  const leave = useCallback(() => {
    sessionStorage.removeItem(startOnceKey);
    teardown();
    sessionStorage.removeItem("meetly_role");
    if (onLeave) onLeave();
    else window.location.href = "/";
  }, [teardown, startOnceKey, onLeave]);

  const startCall = useCallback(async () => {
    if (sessionStorage.getItem(startOnceKey)) return;
    sessionStorage.setItem(startOnceKey, "1");

    setErr("");
    setStatus("Getting camera…");

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch (e) {
      setErr("Camera/mic permission required.");
      sessionStorage.removeItem(startOnceKey);
      setStatus("");
      return;
    }
    streamRef.current = stream;
    if (localV.current) localV.current.srcObject = stream;

    const vtrack = stream.getVideoTracks()[0];
    const atrack = stream.getAudioTracks()[0];
    if (!micOnRef.current && atrack) atrack.enabled = false;
    if (!camOnRef.current && vtrack) vtrack.enabled = false;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    pcRef.current = pc;

    pc.ontrack = (ev) => {
      if (remoteV.current && ev.streams[0]) remoteV.current.srcObject = ev.streams[0];
    };

    pc.onicecandidate = (ev) => {
      const w = wsRef.current;
      if (ev.candidate && w && w.readyState === 1) {
        w.send(JSON.stringify({ type: "signal", payload: { candidate: ev.candidate.toJSON() } }));
      }
    };

    pc.addTrack(vtrack, stream);

    const wss = wsUrlForRoom(room);
    const ws = new WebSocket(wss);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const displayName =
      sessionStorage.getItem("meetly_display_name") || (mode === "host" ? "Host" : "Guest");

    const tryOffer = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: "signal", payload: { sdp: { type: offer.type, sdp: offer.sdp } } }));
    };

    ws.onopen = () => {
      setStatus("Connected");
      ws.send(
        JSON.stringify({
          type: "join",
          speakLang: speak,
          hearLang: hear,
          displayName: displayName.trim().slice(0, 64) || "Guest",
        })
      );
    };

    ws.onmessage = async (ev) => {
      if (ev.data instanceof ArrayBuffer) {
        enqueueAudio(ev.data);
        return;
      }
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "joined") {
        isHostRef.current = !!msg.isHost;
        if (msg.peers && msg.peers.length > 0 && msg.peers[0].displayName) {
          setRemotePeerName(msg.peers[0].displayName);
        }
        return;
      }
      if (msg.type === "peer-joined") {
        if (msg.displayName) setRemotePeerName(msg.displayName);
        if (isHostRef.current) {
          remoteDescSetRef.current = false;
          iceBufRef.current = [];
          try {
            await tryOffer();
          } catch (e) {
            console.error(e);
          }
        }
        return;
      }
      if (msg.type === "signal" && msg.payload) {
        const p = msg.payload;
        if (p.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(p.sdp));
          remoteDescSetRef.current = true;
          await flushIce();
          if (p.sdp.type === "offer") {
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            ws.send(JSON.stringify({ type: "signal", payload: { sdp: { type: ans.type, sdp: ans.sdp } } }));
          }
        }
        if (p.candidate) {
          const c = new RTCIceCandidate(p.candidate);
          if (!remoteDescSetRef.current || !pc.remoteDescription) {
            iceBufRef.current.push(c);
          } else {
            try {
              await pc.addIceCandidate(c);
            } catch (_) {}
          }
        }
        return;
      }
      if (msg.type === "error") {
        setErr(msg.message || "Error");
        return;
      }
      if (msg.type === "peer-left") {
        setRemotePeerName("");
        setStatus("Peer left");
      }
    };

    ws.onclose = () => setStatus("Disconnected");
    ws.onerror = () => setErr("Connection error");

    let mime = "audio/webm;codecs=opus";
    if (!MediaRecorder.isTypeSupported(mime)) mime = "audio/webm";
    const aStream = new MediaStream([atrack]);
    const rec = new MediaRecorder(aStream, { mimeType: mime });
    recRef.current = rec;
    rec.ondataavailable = (e) => {
      if (!micOnRef.current) return;
      if (e.data && e.data.size > 0 && ws.readyState === 1) ws.send(e.data);
    };
    rec.start(250);
  }, [room, speak, hear, mode, enqueueAudio, flushIce, startOnceKey]);

  useEffect(() => {
    const clearKey = () => sessionStorage.removeItem(startOnceKey);
    window.addEventListener("beforeunload", clearKey);
    return () => window.removeEventListener("beforeunload", clearKey);
  }, [startOnceKey]);

  useEffect(() => {
    startCall();
  }, [startCall]);

  useEffect(() => {
    return () => teardown();
  }, [teardown]);

  useEffect(() => {
    if (!streamRef.current) return;
    const a = streamRef.current.getAudioTracks()[0];
    if (a) a.enabled = micOn;
  }, [micOn]);

  useEffect(() => {
    if (!streamRef.current) return;
    const v = streamRef.current.getVideoTracks()[0];
    if (v) v.enabled = camOn;
  }, [camOn]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.origin + "/join?code=" + encodeURIComponent(room));
    setStatus("Invite link copied");
    setTimeout(() => setStatus("Connected"), 2000);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(room);
    setStatus("Code copied");
    setTimeout(() => setStatus("Connected"), 2000);
  };

  const remoteLabel = remotePeerName || "Guest";

  return (
    <div className="min-h-full flex flex-col px-3 py-4 pb-8 max-w-3xl mx-auto w-full">
      {mode === "host" && (
        <div className="mb-4 rounded-2xl border border-teal/20 bg-offwhite p-4 text-center">
          <p className="text-xs uppercase tracking-wide text-teal font-medium mb-1">Share with friends</p>
          <p className="text-lg font-mono font-semibold text-ink break-all">{room}</p>
          <div className="flex flex-wrap gap-2 justify-center mt-3">
            <button
              type="button"
              onClick={copyCode}
              className="rounded-full border border-teal text-teal px-4 py-2 text-xs font-semibold"
            >
              Copy code
            </button>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-full bg-teal text-cream px-4 py-2 text-xs font-semibold"
            >
              Copy invite link
            </button>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-mono text-teal truncate max-w-[55%]">{room}</span>
        <span className="text-xs text-ink/50">{status}</span>
      </div>
      {err && <p className="text-sm text-red-600 mb-2">{err}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 min-h-0">
        <div className="relative rounded-2xl overflow-hidden bg-offwhite border border-teal/15 aspect-video shadow-sm">
          <video ref={localV} autoPlay playsInline muted className="w-full h-full bg-black/10" />
          <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wide bg-teal/90 text-cream px-2 py-0.5 rounded max-w-[90%] truncate">
            You · {localName} · {langLabel(speak)}
          </span>
        </div>
        <div className="relative rounded-2xl overflow-hidden bg-offwhite border border-teal/15 aspect-video shadow-sm">
          <video ref={remoteV} autoPlay playsInline className="w-full h-full bg-black/5" />
          <span className="absolute bottom-2 left-2 text-[10px] uppercase tracking-wide bg-teal/90 text-cream px-2 py-0.5 rounded max-w-[90%] truncate">
            {remoteLabel} · {langLabel(hear)} voice
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center mt-4">
        <button
          type="button"
          onClick={() => setMicOn((m) => !m)}
          className={`rounded-full px-4 py-2 text-sm font-medium ${micOn ? "bg-teal text-cream" : "bg-ink/10 text-ink"}`}
        >
          {micOn ? "Mic on" : "Mic off"}
        </button>
        <button
          type="button"
          onClick={() => setCamOn((c) => !c)}
          className={`rounded-full px-4 py-2 text-sm font-medium ${camOn ? "bg-teal text-cream" : "bg-ink/10 text-ink"}`}
        >
          {camOn ? "Camera on" : "Camera off"}
        </button>
        {mode === "host" && (
          <button
            type="button"
            onClick={copyLink}
            className="rounded-full border border-teal text-teal px-4 py-2 text-sm font-medium"
          >
            Copy invite link
          </button>
        )}
        <button
          type="button"
          onClick={leave}
          className="rounded-full bg-red-700 text-white px-4 py-2 text-sm font-semibold"
        >
          Leave
        </button>
      </div>
    </div>
  );
}

function App() {
  const [path, setPath] = useState(getPath);

  useEffect(() => {
    const sync = () => setPath(getPath());
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const go = useCallback((href) => {
    window.history.pushState(null, "", href);
    setPath(getPath());
  }, []);

  if (path === "/join") {
    return (
      <JoinLobby
        onEnterRoom={(code) => go("/" + code)}
        onGoHome={() => go("/")}
      />
    );
  }

  const m = path.match(ROOM_RE);
  if (m) {
    const room = m[1];
    const role = sessionStorage.getItem("meetly_role");
    if (!role) {
      window.location.replace("/join?code=" + encodeURIComponent(room));
      return null;
    }
    return (
      <CallView
        room={room}
        mode={role === "host" ? "host" : "guest"}
        onLeave={() => go("/")}
      />
    );
  }

  return (
    <Landing
      onRoomCreated={(room) => go("/" + room)}
      onGoToJoin={(code) => go("/join?code=" + encodeURIComponent(code))}
    />
  );
}

const el = document.getElementById("root");
if (el) {
  createRoot(el).render(<App />);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    const h = location.hostname;
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      } catch (e) {
        console.warn("SW unregister", e);
      }
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
