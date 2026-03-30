import { toM2mLang, voiceIdForSpeaker, ANNOUNCE_VOICE } from "./lang.js";

export async function transcribe(env: Env, audioBytes: Uint8Array): Promise<string> {
  if (audioBytes.byteLength < 200) return "";
  const audio = Array.from(audioBytes);
  const res = (await env.AI.run("@cf/openai/whisper", {
    audio,
  })) as { text?: string };
  const text = (res.text ?? "").trim();
  if (text.length < 2) return "";
  return text;
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

export async function elevenLabsTts(
  env: Env,
  text: string,
  voiceType: string
): Promise<ArrayBuffer | null> {
  if (!text || !env.ELEVENLABS_KEY) return null;
  const voice_id = voiceIdForSpeaker(voiceType);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) {
    console.error("ElevenLabs error", res.status, await res.text());
    return null;
  }
  return res.arrayBuffer();
}

export async function announceTts(
  env: Env,
  text: string
): Promise<ArrayBuffer | null> {
  if (!text || !env.ELEVENLABS_KEY) return null;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ANNOUNCE_VOICE}`, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_turbo_v2_5",
      voice_settings: {
        stability: 0.7,
        similarity_boost: 0.9,
        style: 0,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) {
    console.error("Announce TTS error", res.status, await res.text());
    return null;
  }
  return res.arrayBuffer();
}
