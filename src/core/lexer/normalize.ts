const WITHOUT_ACCENT: Readonly<Record<string, string>> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u" };

/**
 * Lowercases and strips Spanish accents (ñ is kept). The result has exactly the same length as the
 * input, so a position in the normalized text is also a position in the original text.
 */
export function normalize(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const original = text.charAt(i);
    const lower = original.toLowerCase();
    result += lower.length === 1 ? (WITHOUT_ACCENT[lower] ?? lower) : original;
  }
  return result;
}
