import { toM2mLang, voiceIdForSpeaker, ANNOUNCE_VOICE } from "./lang.js";

const FLASH_MODEL = "eleven_flash_v2_5";

export interface TranscribeResult {
  text: string;
  detectedLang: string;
}

const HALLUCINATION_EXACT = new Set([
  "you", "thank you", "thanks", "thanks for watching", "thank you for watching",
  "bye", "goodbye", "okay", "oh", "uh", "um", "hmm", "ah", "huh",
  "yeah", "yes", "no", "so", "the end", "bye bye", "see you",
  "subscribe", "like and subscribe", "please subscribe",
  "silence", "music", "applause", "laughter",
]);

function isHallucination(text: string): boolean {
  const lower = text.toLowerCase().replace(/[.,!?]+$/g, "");
  if (HALLUCINATION_EXACT.has(lower)) return true;
  if (/^[.!?,\s]+$/.test(text)) return true;
  if (/^(.)\1+$/.test(lower)) return true;
  return false;
}

export async function transcribe(env: Env, audioBytes: Uint8Array): Promise<TranscribeResult> {
  if (audioBytes.byteLength < 5000) return { text: "", detectedLang: "" };
  const res = (await env.AI.run("@cf/openai/whisper", {
    audio: [...audioBytes],
  })) as { text?: string; language?: string };
  const text = (res.text ?? "").trim();
  if (text.length < 3) return { text: "", detectedLang: "" };
  if (isHallucination(text)) return { text: "", detectedLang: "" };
  return { text, detectedLang: res.language ?? "" };
}

export async function translateText(
  env: Env,
  text: string,
  sourceLangCode: string,
  targetLangCode: string
): Promise<string> {
  if (!text) return "";
  const source_lang = toM2mLang(sourceLangCode);
  const target_lang = toM2mLang(targetLangCode);
  if (source_lang === target_lang) return text;
  const res = (await env.AI.run("@cf/meta/m2m100-1.2b", {
    text,
    source_lang,
    target_lang,
  })) as { translated_text?: string };
  return (res.translated_text ?? text).trim();
}

async function ttsRequest(
  env: Env,
  voiceId: string,
  text: string,
  stability: number,
  similarityBoost: number,
): Promise<ArrayBuffer | null> {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?optimize_streaming_latency=4&output_format=mp3_22050_32`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: FLASH_MODEL,
      voice_settings: { stability, similarity_boost: similarityBoost, style: 0, use_speaker_boost: false },
    }),
  });
  if (!res.ok) {
    console.error("ElevenLabs error", res.status, await res.text());
    return null;
  }
  return res.arrayBuffer();
}

export async function elevenLabsTts(
  env: Env,
  text: string,
  voiceType: string
): Promise<ArrayBuffer | null> {
  if (!text || !env.ELEVENLABS_KEY) return null;
  return ttsRequest(env, voiceIdForSpeaker(voiceType), text, 0.5, 0.8);
}

export async function announceTts(
  env: Env,
  text: string
): Promise<ArrayBuffer | null> {
  if (!text || !env.ELEVENLABS_KEY) return null;
  return ttsRequest(env, ANNOUNCE_VOICE, text, 0.7, 0.9);
}
