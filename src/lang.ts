const LANG_LABELS: Record<string, string> = {
  en: "English",    zh: "Mandarin",   es: "Spanish",    fr: "French",
  de: "German",     ja: "Japanese",   ko: "Korean",     hi: "Hindi",
  ar: "Arabic",     pt: "Portuguese", it: "Italian",    ru: "Russian",
  nl: "Dutch",      tr: "Turkish",    pl: "Polish",     sv: "Swedish",
  id: "Indonesian", tl: "Filipino",   hu: "Hungarian",  cs: "Czech",
  ro: "Romanian",   uk: "Ukrainian",  el: "Greek",      da: "Danish",
  fi: "Finnish",    bg: "Bulgarian",  hr: "Croatian",   sk: "Slovak",
  ta: "Tamil",      vi: "Vietnamese", no: "Norwegian",  ms: "Malay",
};

export function langLabel(code: string): string {
  return LANG_LABELS[code] ?? code;
}

/** m2m100-1.2b expects lowercase full language names (Workers AI docs). */
export const LANG_TO_M2M: Record<string, string> = {
  en: "english",    zh: "chinese",    es: "spanish",    fr: "french",
  de: "german",     ja: "japanese",   ko: "korean",     hi: "hindi",
  ar: "arabic",     pt: "portuguese", it: "italian",    ru: "russian",
  nl: "dutch",      tr: "turkish",    pl: "polish",     sv: "swedish",
  id: "indonesian", tl: "tagalog",    hu: "hungarian",  cs: "czech",
  ro: "romanian",   uk: "ukrainian",  el: "greek",      da: "danish",
  fi: "finnish",    bg: "bulgarian",  hr: "croatian",   sk: "slovak",
  ta: "tamil",      vi: "vietnamese", no: "norwegian",  ms: "malay",
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

const NON_LATIN_RE = /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0980-\u09FF\u0B80-\u0BFF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF\u0370-\u03FF\u0E00-\u0E7F]/;

export function hasNonLatinChars(text: string): boolean {
  return NON_LATIN_RE.test(text);
}
