# Meetly

1:1 video calls on Cloudflare Workers with real-time translation: **Whisper** (STT) → **m2m100** (Workers AI) → **ElevenLabs** (TTS). Signaling and translated audio go through a **Durable Object** per room; **WebRTC** carries video only.

## Prerequisites

- Node 18+
- Cloudflare account with **Workers AI** enabled
- [ElevenLabs](https://elevenlabs.io/) API key

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars — set ELEVENLABS_KEY
npx wrangler dev
```

Open the printed URL in two browsers (or devices). Create a meeting on one, open the link on the other. Pick complementary languages (e.g. Speak English / Hear Chinese on one device and the inverse on the other).

## Deploy

```bash
npx wrangler secret put ELEVENLABS_KEY
npx wrangler deploy
```

Do not put real API keys in `wrangler.jsonc` `vars` in production; use secrets. The empty `ELEVENLABS_KEY` in config is only a typed placeholder for local `.dev.vars`.

## Audio pipeline notes

The client sends **~250ms `audio/webm` (Opus)** chunks. Workers AI Whisper expects raw audio bytes; if transcriptions are empty or errors appear in logs, try:

- Speaking in slightly longer phrases
- Increasing the `MediaRecorder` interval (e.g. 500–750 ms) in `public/index.html`

## Stack

- Worker + **Durable Object** (`CallRoom`) — WebSockets, room state, 30-minute idle alarm
- **Workers AI** — `@cf/openai/whisper`, `@cf/meta/m2m100-1.2b`
- **ElevenLabs** — `eleven_turbo_v2` with hackathon demo voice IDs
- **PWA** — `manifest.webmanifest`, `sw.js`, cream/teal UI in `public/index.html`

## Room URLs

- Create room: `POST /api/room` → `{ room, url, wsUrl }`
- WebSocket: `wss://<host>/call?room=MEETLY-XXXXXX`

NAT-heavy networks may need a TURN server for WebRTC video; same-LAN or typical home Wi‑Fi usually works with the bundled Google STUN server.
