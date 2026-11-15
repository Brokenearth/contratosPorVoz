const WITHOUT_ACCENT: Readonly<Record<string, string>> = { á: "a", é: "e", í: "i", ó: "o", ú: "u", ü: "u" };

/**
 * Lowercases and strips Spanish accents (ñ is kept), treating composed and decomposed accents equally.
 */
export function normalize(text: string): string {
  const composed = text.normalize("NFC");
  let result = "";
  for (let i = 0; i < composed.length; i++) {
    const original = composed.charAt(i);
    const lower = original.toLowerCase();
    result += lower.length === 1 ? (WITHOUT_ACCENT[lower] ?? lower) : original;
  }
  return result;
}

/** Maps normalized boundaries back to UTF-16 offsets in the original transcription. */
export function normalizationOffsets(original: string, normalized: string): number[] | undefined {
  if (original.length === normalized.length && original.normalize("NFC").length === original.length) return undefined;

  const offsets = [0];
  for (const match of original.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
    const part = match[0];
    const length = part.normalize("NFC").length;
    for (let i = 1; i < length; i++) offsets.push(match.index + i);
    offsets.push(match.index + part.length);
  }
  return offsets;
}
