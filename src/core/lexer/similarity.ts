import type { Token } from "../types";
import { BREEDS } from "./definitions";
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

// The explicit ANIMAL "de raza" context is intentionally narrower than the full grammar.
export function suggestBreedCorrections(tokens: Token[]): TranscriptionSuggestion[] {
  return tokens.flatMap((token, index) => {
    if (token.type !== "NOMBRE" || token.partyName || tokens[index - 3]?.type !== "ANIMAL" ||
        normalize(tokens[index - 2]?.lexeme ?? "") !== "de" || normalize(tokens[index - 1]?.lexeme ?? "") !== "raza") {
      return [];
    }
    const source = normalize(token.lexeme);
    if (source.length < 5) return [];
    const threshold = source.length < 9 ? 1 : 2;
    const ranked = BREEDS.map((breed) => ({ value: breed, distance: levenshtein(source, normalize(breed)) }))
      .sort((a, b) => a.distance - b.distance);
    const best = ranked[0];
    if (!best || best.distance > threshold) return [];
    const candidates = ranked.filter(({ distance }) => distance <= threshold && distance < best.distance + 2);
    return [{ original: token.lexeme, start: token.start, end: token.end, candidates }];
  });
}
