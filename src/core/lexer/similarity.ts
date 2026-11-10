import type { Token, TokenType } from "../types";
import { TOKEN_DEFINITIONS } from "./definitions";
import { tokenize } from "./lexer";
import { normalize } from "./normalize";

export interface TranscriptionSuggestion {
  original: string;
  start: number;
  end: number;
  candidates: { value: string; distance: number }[];
}

export function levenshtein(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i++) {
    const row = [i];
    for (let j = 1; j <= right.length; j++) {
      row[j] = Math.min(
        previous[j]! + 1,
        row[j - 1]! + 1,
        previous[j - 1]! + Number(left[i - 1] !== right[j - 1]),
      );
    }
    previous = row;
  }
  return previous[right.length]!;
}

const word = (token: Token | undefined) => normalize(token?.lexeme ?? "");
const NON_ANIMAL_COUNTS = new Set(["lote", "valor", "por", "de", "el", "al", "desde", "hasta"]);
const MULTIPLIERS = new Set(["mil", "millon"]);

function amountPosition(tokens: Token[], index: number): boolean {
  const amount = word(tokens[index - 1]) === "de" ? index - 2 : index - 1;
  if (tokens[amount]?.type !== "NUM") return false;
  const marker = word(tokens[amount - 1]) === "de" ? amount - 2 : amount - 1;
  return word(tokens[marker]) === "valor";
}

function expectedTypes(tokens: Token[], index: number): TokenType[] {
  const previous = tokens[index - 1];
  const before = tokens[index - 2];
  if (amountPosition(tokens, index)) return ["MONEDA"];
  if (previous?.type === "ANIMAL" ||
      (word(previous) === "raza" && word(before) === "de" && tokens[index - 3]?.type === "ANIMAL")) return ["RAZA"];
  if (word(previous) === "de" && ["cultivo", "siembra"].includes(word(before))) return ["CULTIVO"];
  if (word(previous) === "para") return ["ANIMAL", "CULTIVO", "USO"];
  if (previous?.type === "NUM" && !NON_ANIMAL_COUNTS.has(word(before))) return ["ANIMAL"];
  return [];
}

function suggestionsFor(tokens: Token[]): TranscriptionSuggestion[] {
  return tokens.flatMap((token, index) => {
    if (token.type !== "NOMBRE" || token.partyName) return [];
    const source = normalize(token.lexeme);
    if (source.length < 3) return [];
    const expected = expectedTypes(tokens, index);
    if (!expected.length) return [];
    const threshold = source.length < 6 ? 1 : source.length < 11 ? 2 : 3;
    const meanings = new Map<string, { value: string; distance: number }>();
    for (const definition of TOKEN_DEFINITIONS) {
      if (!expected.includes(definition.type)) continue;
      for (const entry of definition.spellings ?? []) {
        if (definition.type === "MONEDA" && !MULTIPLIERS.has(normalize(entry.meaning))) continue;
        const distance = levenshtein(source, normalize(entry.value));
        // A nearby alternative scale deserves confirmation even just outside the normal threshold.
        const radius = definition.type === "MONEDA" ? threshold + 1 : threshold;
        if (distance === 0 || distance > radius) continue;
        const key = definition.type + ":" + entry.meaning;
        const current = meanings.get(key);
        if (!current || distance < current.distance) meanings.set(key, { value: entry.value, distance });
      }
    }
    const ranked = [...meanings.values()].sort((a, b) => a.distance - b.distance);
    const best = ranked[0];
    if (!best || best.distance > threshold) return [];
    const candidates = ranked.filter(({ distance }) => distance <= best.distance + 1);
    return [{ original: token.lexeme, start: token.start, end: token.end, candidates }];
  });
}

export interface AppliedCorrection {
  original: string;
  value: string;
}

// Re-scan the corrected spelling through the same DFAs. A repaired animal can expose a breed on the next pass.
export function correctTranscription(input: string) {
  let text = input;
  let lex = tokenize(text);
  let suggestions = suggestionsFor(lex.tokens);
  const corrections: AppliedCorrection[] = [];

  for (let pass = 0; pass < 3; pass++) {
    const clear = suggestions.filter(({ candidates }) => candidates.length === 1);
    if (clear.length === 0) break;
    for (const item of clear) corrections.push({ original: item.original, value: item.candidates[0]!.value });
    for (const item of clear.sort((a, b) => b.start - a.start)) {
      text = text.slice(0, item.start) + item.candidates[0]!.value + text.slice(item.end);
    }
    lex = tokenize(text);
    suggestions = suggestionsFor(lex.tokens);
  }
  return { text, lex, suggestions, corrections };
}
