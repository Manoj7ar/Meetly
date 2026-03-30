/** m2m100-1.2b expects lowercase full language names (Workers AI docs). */
export const LANG_TO_M2M: Record<string, string> = {
  en: "english",
  zh: "chinese",
  es: "spanish",
  fr: "french",
  de: "german",
  ja: "japanese",
  ko: "korean",
  hi: "hindi",
  ar: "arabic",
  pt: "portuguese",
};

export function toM2mLang(code: string): string {
  return LANG_TO_M2M[code] ?? "english";
}

/** Hackathon demo: two ElevenLabs voices (English vs Mandarin-style output). */
export const VOICE_ENGLISH = "TX3LPjm3pTSxNOyVWf8s";
export const VOICE_MANDARIN = "pNInz6obpgDQGcFmaJgB";

export function voiceIdForHearLang(hearCode: string): string {
  if (hearCode === "zh" || hearCode === "ja" || hearCode === "ko") {
    return VOICE_MANDARIN;
  }
  return VOICE_ENGLISH;
}
