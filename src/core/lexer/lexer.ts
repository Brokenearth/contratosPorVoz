import { type Automaton, type Dfa, compileRegex, longestMatch } from "../regex";
import type { LexResult, LexStep, Token } from "../types";
import { NAMED_DEFINITIONS, TOKEN_DEFINITIONS, type TokenDefinition } from "./definitions";
import { normalize } from "./normalize";
import { applySynonyms } from "./synonyms";

export interface TokenAutomata {
  definition: TokenDefinition;
  regex: string;
  nfa: Automaton;
  dfa: Dfa;
}

/** Characters skipped between tokens: whitespace, sentence punctuation and the "$" before an amount. */
const SKIPPED: readonly string[] = [" ", "\t", "\n", "\r", ".", ";", ":", "!", "?", "¿", "¡", '"', "'", "$"];

let compiled: TokenAutomata[] | null = null;

/** Every token definition compiled once: regex → NFA-λ (Thompson) → DFA (subsets). */
export function tokenAutomata(): TokenAutomata[] {
  compiled ??= TOKEN_DEFINITIONS.map((definition) => {
    const { nfa, dfa } = compileRegex(definition.regex, NAMED_DEFINITIONS);
    return { definition, regex: definition.regex, nfa, dfa };
  });
  return compiled;
}

/** Automata of one definition by name (e.g. "NUM", "ANIMAL") for the UI and the report. */
export function getTokenAutomata(name: string): TokenAutomata {
  const found = tokenAutomata().find((automata) => automata.definition.name === name);
  if (found === undefined) throw new Error(`No existe la definición de token ${name}`);
  return found;
}

interface Candidate {
  automata: TokenAutomata;
  length: number;
  states: string[];
}

/** Runs every DFA from `position`; the longest match wins and ties go to the earlier definition. */
function bestMatch(text: string, position: number): Candidate | null {
  let best: Candidate | null = null;
  for (const automata of tokenAutomata()) {
    const match = longestMatch(automata.dfa, text, position);
    if (match.length > (best?.length ?? 0)) best = { automata, ...match };
  }
  return best;
}

/** Scans with the DFAs only: normalized text → tokens (with original lexemes and positions) plus a DFA trace. */
function scan(text: string): LexResult {
  const normalized = normalize(text);
  const tokens: Token[] = [];
  const trace: LexStep[] = [];
  const errors: LexResult["errors"] = [];

  let position = 0;
  while (position < normalized.length) {
    const ch = normalized.charAt(position);
    if (SKIPPED.includes(ch)) {
      position++;
      continue;
    }
    const match = bestMatch(normalized, position);
    if (match === null) {
      const lexeme = text.charAt(position);
      errors.push({ position, lexeme, message: `Símbolo desconocido '${lexeme}'` });
      trace.push({ position, tokenType: null, dfaStates: [], accepted: false });
      position++;
      continue;
    }
    const end = position + match.length;
    const { definition } = match.automata;
    const lexeme = text.slice(position, end);
    tokens.push({
      type: definition.type,
      lexeme,
      value: definition.value(normalized.slice(position, end), lexeme),
      start: position,
      end,
    });
    trace.push({ position, tokenType: definition.type, dfaStates: match.states, accepted: true });
    position = end;
  }
  return { tokens, trace, errors };
}

/** Lexical analysis: DFA scan, then the synonym dictionary rewrites phrases into canonical tokens. */
export function tokenize(text: string): LexResult {
  const result = scan(text);
  return { ...result, tokens: applySynonyms(result.tokens, text, (canonical) => scan(canonical).tokens) };
}
