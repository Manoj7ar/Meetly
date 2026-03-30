# Meetly

Meetly is a small **1:1 video calling** application built on **Cloudflare Workers**, with **real-time speech translation**. Each participant speaks in their own language; the other side hears synthesized speech in theirs. Video is carried over **WebRTC**; signaling and translated audio flow through a **Durable Object** per room.

## Features

- **Host and guest flow** — Host creates a room from the landing page and enters the call immediately. Guests use a **pre-join** screen (`/join?code=…`) to set a display name and language before joining.
- **Live translation pipeline** — **Whisper** (speech-to-text) → **m2m100** (machine translation on Workers AI) → **ElevenLabs** (text-to-speech).
- **Room metadata** — `GET /api/room/:code/meta` exposes host language preferences for guests waiting to join.
- **Progressive web app** — Installable shell with offline-friendly static assets and a bundled React UI.

## Architecture

| Layer | Role |
|--------|------|
| **Cloudflare Worker** | HTTP routing, room creation, WebSocket upgrade proxy, static assets (`run_worker_first`). |
| **Durable Object (`CallRoom`)** | One instance per room: WebSocket coordination, participant state, idle cleanup (e.g. 30-minute alarm). |
| **Workers AI** | `@cf/openai/whisper` and `@cf/meta/m2m100-1.2b` for STT and translation. |
| **ElevenLabs** | `eleven_turbo_v2` (demo-oriented voice configuration in code). |
| **Client** | React (`client/app.jsx`), built with **esbuild** to `public/app.js`; WebRTC for video, binary audio to the worker. |

Translated audio is sent as **~250 ms `audio/webm` (Opus)** chunks from the browser; the worker adapts them for Whisper as needed.

## Prerequisites

- **Node.js** 18 or newer
- A **Cloudflare** account with **Workers AI** enabled for your zone / account
- An **[ElevenLabs](https://elevenlabs.io/)** API key

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure secrets (local)

Copy the example vars file and add your API key:

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set `ELEVENLABS_KEY`. Do not commit `.dev.vars`.

### 3. Run the development server

```bash
npm run dev
```

The `predev` script runs **`npm run build:client`** so the UI bundle stays in sync with `client/app.jsx`. After changing the React app, you can rebuild manually with:

```bash
npm run build:client
```

Open the URL Wrangler prints. For a full flow test, use two browsers or devices: create a meeting on one, join with the code (or invite link) on the other. Choose complementary **I speak / I hear** languages when testing translation end-to-end.

## Deployment

Build the client and deploy the Worker and assets:

```bash
npm run deploy
```

Set production secrets with Wrangler (do **not** put production keys in `wrangler.jsonc` `vars`):

```bash
npx wrangler secret put ELEVENLABS_KEY
```

The empty `ELEVENLABS_KEY` entry in `wrangler.jsonc` exists for typing and local development only.

## HTTP and WebSocket endpoints

| Method / path | Description |
|---------------|-------------|
| `POST /api/room` | Creates a room; returns `room`, URL, and WebSocket URL hints. |
| `GET /api/room/:code/meta` | JSON metadata for the room (host languages, whether a host has joined). |
| `GET /call?room=…` (WebSocket) | Signaling and translated audio for the given room code. |

Room paths in the SPA follow `/<MEETLY-CODE>`; guests are directed through `/join?code=…` for pre-join.

## Troubleshooting

- **Empty transcriptions or AI errors** — Speak in slightly longer phrases, or increase the `MediaRecorder` chunk interval (e.g. 500–750 ms) in the client if the pipeline struggles with very short clips.
- **WebRTC video fails on some networks** — Restrictive NATs may require a **TURN** server. Typical home or same-LAN setups often work with the bundled Google **STUN** server only.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build:client` | Bundle `client/app.jsx` → `public/app.js` |
| `npm run dev` | `wrangler dev` (client built via `predev`) |
| `npm run deploy` | Build client + `wrangler deploy` |
| `npm run types` | Generate Wrangler / Worker types |

## License

This project is licensed under the [MIT License](LICENSE).
