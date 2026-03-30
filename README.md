# Meetly

**Real-time translated video calls.** Speak your language, they hear theirs.

Meetly is a 1:1 video calling app where each person speaks their own language and hears the other person in theirs, in real time. Built entirely on Cloudflare Workers, Durable Objects, Workers AI, and ElevenLabs text-to-speech.

**Live:** [meetly.manoj07ar.workers.dev](https://meetly.manoj07ar.workers.dev)

---

## How It Works

1. You speak into your mic in English
2. Your audio is recorded in 2.5-second chunks, converted to WAV, and sent to the server
3. **Whisper** (Workers AI) transcribes your speech to text
4. **m2m100** (Workers AI) translates the text to the other person's language
5. **ElevenLabs Flash v2.5** generates natural-sounding speech from the translated text
6. The other person hears the translated audio through their speakers
7. Both sides see a live transcription of the conversation

The entire pipeline runs in under a few seconds per utterance.

---

## Features

### Core Translation
- **32 languages** supported end-to-end (Whisper + m2m100 + ElevenLabs)
- **Male/female voice selection** — pick your voice type, and the other person hears the translation in a matching voice (Adam for male, Rachel for female)
- **Auto-detect language** — Whisper identifies the spoken language and shows it on screen if it differs from your selection
- **Hallucination filtering** — server-side blocklist prevents Whisper from producing phantom text ("you", "thank you", etc.) from silence

### Call Experience
- **WebRTC video** — peer-to-peer video with STUN-based NAT traversal
- **Screen sharing** — share your screen with one click, auto-reverts to camera when stopped
- **Meeting timer** — elapsed time displayed next to the room code
- **Connection quality indicator** — green/yellow/red dot based on WebRTC packet loss stats
- **Sound effects** — subtle chimes for connect, peer join, and peer leave

### Live Transcription
- **Chat-style transcript box** — your speech right-aligned in white, peer's translated speech left-aligned in green
- **Pronunciation guide** — non-Latin scripts (Cyrillic, Arabic, CJK, Devanagari, etc.) show a romanized English hint underneath
- **Auto-scrolling** with the last 50 messages retained

### Host/Guest Flow
- **Host** creates a room from the landing page and enters immediately
- **QR code invite** — scannable QR code displayed in the host's share panel for easy mobile join
- Share panel with room code and invite link auto-hides when a guest joins, expanding the video area
- **Guest** joins via `/join?code=...`, sees a pre-join lobby with host language info, sets their name and language

### Meeting Management
- **End meeting for all** — one button that generates an AI summary and closes the call for both participants
- **AI meeting summary** — Workers AI (llama-3.1-8b-instruct) generates a 2-3 sentence summary of the conversation
- **Meeting ended screen** — shows the AI summary and full transcript after the call

### Progressive Web App
- Installable PWA with offline-friendly static assets
- Service worker for caching
- Responsive design for desktop and mobile

---

## Supported Languages

All 32 languages are verified to work across the full pipeline (Whisper transcription, m2m100 translation, ElevenLabs TTS):

| | | | |
|---|---|---|---|
| English | Mandarin | Spanish | French |
| German | Japanese | Korean | Hindi |
| Arabic | Portuguese | Italian | Russian |
| Dutch | Turkish | Polish | Swedish |
| Indonesian | Filipino | Hungarian | Czech |
| Romanian | Ukrainian | Greek | Danish |
| Finnish | Bulgarian | Croatian | Slovak |
| Tamil | Vietnamese | Norwegian | Malay |

---

## Architecture

```
Browser A                    Cloudflare                         Browser B
---------                    ----------                         ---------
Mic audio                                                      
  --> MediaRecorder (WebM/Opus)                                
  --> blobToWav() conversion                                   
  --> WebSocket binary         --> Durable Object (CallRoom)   
                                    |                          
                                    |--> Whisper (STT)         
                                    |--> m2m100 (translate)    
                                    |--> ElevenLabs (TTS)      
                                    |                          
                               <-- WebSocket binary (MP3) -->  enqueueAudio()
                               <-- transcript JSON      -->    --> Audio playback
                                                               --> Transcript UI
```

| Component | Technology | Role |
|-----------|-----------|------|
| **Worker** | Cloudflare Workers | HTTP routing, room creation, WebSocket upgrade, static asset serving |
| **CallRoom** | Durable Object | Per-room WebSocket coordination, participant state, translation pipeline, idle cleanup |
| **Whisper** | Workers AI (`@cf/openai/whisper`) | Speech-to-text transcription |
| **m2m100** | Workers AI (`@cf/meta/m2m100-1.2b`) | Text translation between 32 languages |
| **ElevenLabs** | Flash v2.5 API (streaming) | Text-to-speech with `optimize_streaming_latency=4`, 32kbps MP3 |
| **llama-3.1** | Workers AI (`@cf/meta/llama-3.1-8b-instruct`) | End-of-meeting AI summary generation |
| **Client** | React + esbuild | SPA with WebRTC, MediaRecorder, Web Audio API, audio playback |

### Audio Pipeline Detail

The client records audio using `MediaRecorder` (WebM/Opus), then converts each chunk to **16kHz mono PCM WAV** using `OfflineAudioContext` before sending. This is necessary because Cloudflare Workers AI Whisper only accepts WAV/MP3 input, not WebM containers.

During TTS playback, the mic is automatically muted and recording is paused to prevent echo feedback loops.

---

## Prerequisites

- **Node.js** 18+
- A **Cloudflare** account with **Workers AI** enabled
- An **[ElevenLabs](https://elevenlabs.io/)** API key

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure secrets (local development)

```bash
cp .dev.vars.example .dev.vars
```

Edit `.dev.vars` and set your `ELEVENLABS_KEY`. Never commit this file.

### 3. Run the development server

```bash
npm run dev
```

This automatically builds the client bundle first. Open the URL Wrangler prints. For a full test, use two browsers/devices: create a meeting on one, join with the code on the other.

---

## Deployment

### Cloudflare Workers (recommended)

Build and deploy everything:

```bash
npm run deploy
```

Set the ElevenLabs key as an encrypted secret (not a plain-text var):

```bash
npx wrangler secret put ELEVENLABS_KEY
```

Your app will be live at `https://<worker-name>.<subdomain>.workers.dev`.

### Frontend on Vercel (optional)

The API, WebSockets, AI, and Durable Objects stay on Cloudflare. Vercel hosts only the static UI.

1. Set **Root Directory** to the repository root
2. `vercel.json` handles build command (`npm run vercel-build`) and output directory (`dist`)
3. Set the **`MEETLY_API_ORIGIN`** environment variable to your Worker URL (no trailing slash), e.g. `https://meetly.your-subdomain.workers.dev`
4. Only `/join` and `/MEETLY-...` paths are rewritten to `index.html` — do not use a catch-all rewrite or `POST /api/room` will return 405

If `MEETLY_API_ORIGIN` is unset, the UI uses `window.location.origin` (standard Cloudflare-only deploy). The build script automatically prepends `https://` if the protocol is missing.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/room` | Create a new room. Returns `{ room, url, wsUrl }` |
| `GET` | `/api/room/:code/meta` | Room metadata: host languages, whether host has joined |
| `OPTIONS` | `/api/room`, `/api/room/:code/meta` | CORS preflight (allows cross-origin from Vercel) |
| `GET` | `/call?room=...` | WebSocket upgrade for signaling and translated audio |

### WebSocket Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `join` | Client -> Server | Join room with speakLang, hearLang, displayName, voiceType |
| `joined` | Server -> Client | Confirmation with participantId, isHost, peers list |
| `peer-joined` | Server -> Client | Another participant joined |
| `peer-left` | Server -> Client | Participant disconnected |
| `signal` | Bidirectional | WebRTC SDP offers/answers and ICE candidates |
| `transcript` | Server -> Client | Transcribed/translated text with from, name, text, pronunciation |
| `lang-detected` | Server -> Client | Whisper's detected language for the speaker |
| `announcement` | Server -> Client | System text notification (join/leave events) |
| `meeting-summary` | Server -> Client | AI-generated meeting summary |
| `meeting-ended-all` | Server -> Client | Meeting ended by host, close connection |
| `end-meeting` | Client -> Server | Request to end meeting for all participants |
| Binary (ArrayBuffer) | Both | Audio data: WebM from client, MP3 from server |

---

## Project Structure

```
meetly/
  client/
    app.jsx              # React SPA (Landing, JoinLobby, CallView, MeetingEnded)
  src/
    index.ts             # Worker entry: HTTP routing, CORS, WebSocket upgrade
    call-room.ts         # Durable Object: participant mgmt, translation pipeline
    pipeline.ts          # Whisper transcription, m2m100 translation, ElevenLabs TTS
    lang.ts              # Language mappings, voice IDs, pronunciation detection
  public/
    index.html           # HTML shell with Tailwind config
    app.js               # Built client bundle (generated)
    meetly-env.js         # Runtime config (generated)
    sw.js                # Service worker
    manifest.webmanifest # PWA manifest
    favicon.svg          # App icon
  scripts/
    write-meetly-env.mjs # Generates meetly-env.js from MEETLY_API_ORIGIN env var
    sync-dist-for-vercel.mjs  # Mirrors public/ to dist/ for Vercel
  wrangler.jsonc         # Cloudflare Worker config
  vercel.json            # Vercel deployment config
  package.json
  tsconfig.json
```

---

## NPM Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start local dev server (auto-builds client first) |
| `npm run build:client` | Bundle `client/app.jsx` to `public/app.js` via esbuild |
| `npm run deploy` | Build client + deploy to Cloudflare Workers |
| `npm run vercel-build` | Build client + mirror to `dist/` for Vercel |
| `npm run types` | Generate Wrangler/Worker TypeScript types |

---

## Performance

- **ElevenLabs Flash v2.5** model: ~75ms TTS inference
- **Streaming TTS endpoint** with `optimize_streaming_latency=4` for fastest time-to-first-byte
- **32kbps MP3** output for minimal WebSocket transfer overhead
- **Non-blocking pipeline** via Durable Object `waitUntil()` — incoming audio chunks don't queue behind slow pipeline runs
- **2.5-second recording chunks** balancing latency vs. transcription accuracy
- **Mic auto-mute during playback** prevents echo feedback loops

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| No audio translation happening | Check browser console for errors. Ensure mic permissions are granted. The ELEVENLABS_KEY secret must be set on Cloudflare. |
| "ELEVENLABS_KEY not configured" error | Run `npx wrangler secret put ELEVENLABS_KEY` with your API key |
| Random "you" / "thank you" in transcription | This is a known Whisper hallucination on silence. The server-side blocklist should filter these. If persistent, check that the mic isn't picking up background noise. |
| WebRTC video fails | Restrictive NATs may need a TURN server. Home/office networks typically work with the bundled Google STUN server. |
| Vercel deploy shows 404 | Check Deployment Protection settings. Confirm the build logs show `vercel-build`. Verify `MEETLY_API_ORIGIN` is set. |
| API calls fail on Vercel | Ensure `MEETLY_API_ORIGIN` is set to your Worker URL with `https://` prefix. The app auto-adds the protocol if missing. |

---

## License

[MIT](LICENSE)
