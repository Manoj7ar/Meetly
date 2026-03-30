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

const VOICE_FEMALE = "21m00Tcm4TlvDq8ikWAM"; // Rachel
const VOICE_MALE = "pNInz6obpgDQGcFmaJgB";   // Adam

/** Distinct voice for system announcements so they're clearly "the AI". */
export const ANNOUNCE_VOICE = "jqcCZkN6Knx8BJ5TBdYR";

export function voiceIdForSpeaker(voiceType: string): string {
  return voiceType === "male" ? VOICE_MALE : VOICE_FEMALE;
}
