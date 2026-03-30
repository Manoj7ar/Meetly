const LANG_LABELS: Record<string, string> = {
  en: "English", zh: "Mandarin", es: "Spanish", fr: "French", de: "German",
  ja: "Japanese", ko: "Korean", hi: "Hindi", ar: "Arabic", pt: "Portuguese",
};

export function langLabel(code: string): string {
  return LANG_LABELS[code] ?? code;
}

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

/**
 * ElevenLabs multilingual voice: "Rachel" — clear, natural, works well
 * across all 32 languages supported by eleven_turbo_v2_5.
 */
const VOICE_DEFAULT = "21m00Tcm4TlvDq8ikWAM";

/** Distinct voice for system announcements so they're clearly "the AI". */
export const ANNOUNCE_VOICE = "jqcCZkN6Knx8BJ5TBdYR";

export function voiceIdForHearLang(_hearCode: string): string {
  return VOICE_DEFAULT;
}
