import type { Token } from "../types";
import { normalize } from "./normalize";

/**
 * Synonym dictionary: canonical phrase ← phrases that mean the same in a dictation.
 * The canonical phrase uses only words the grammar knows; "" means the words are filler and are dropped.
 * Phrases are written in lowercase without accents and matched against whole tokens.
 */
export const SYNONYMS: Readonly<Record<string, readonly string[]>> = {
  arriendo: ["doy en arriendo", "entrego en arriendo", "doy en alquiler", "rento"],
  "se arrienda": ["se da en arriendo", "se entrega en arriendo", "se da en alquiler", "se renta"],
  "en el lote": ["en la finca", "en la parcela", "en la hacienda"],
  "el lote": ["la finca", "la parcela", "la hacienda"],
  lote: [
    "finca", "parcela", "hacienda", "predio", "potrero", "terreno",
    "lote denominado", "lote denominada", "lote llamado", "lote llamada", "lote conocido como", "lote conocida como",
  ],
  de: [", con una extension de", ", con un area de", "con una extension de", "con un area de", "de una extension de"],
  para: [
    "destinado al mantenimiento de", "destinada al mantenimiento de", "para el mantenimiento de",
    "destinado al", "destinada al", "destinado a", "destinada a", "destinado para", "destinada para", "con destino a",
  ],
  por: [
    "por un periodo de", "por un plazo de", "por un termino de", "por el termino de", "por el plazo de",
    "durante un periodo de", "durante un plazo de", "durante",
  ],
  "desde el": ["a partir del", "contados desde el", "contado desde el", "a contar del", "comenzando el", "iniciando el"],
  desde: ["a partir de"],
  "por un valor de": [
    "por la suma de", "por un canon de", "por un precio de", "por un monto de", "por el valor de", "por el precio de",
    "por valor de",
  ],
  pesos: ["pesos colombianos", "cop"],
  vacas: ["reses", "vacunos", "bovinos", "cabezas de ganado"],
  arrendador: ["propietario", "propietaria", "dueño", "dueña", "arrendante"],
  arrendatario: ["inquilino", "inquilina"],
  "los insumos los aporta el arrendador": [
    "los insumos corren por cuenta del arrendador", "el arrendador pone los insumos", "el arrendador suministra los insumos",
  ],
  "los insumos los aporta el arrendatario": [
    "los insumos corren por cuenta del arrendatario", "el arrendatario pone los insumos", "el arrendatario suministra los insumos",
  ],
  "": ["aproximadamente", "mas o menos", "cerca de", "alrededor de", "unas", "unos"],
};

interface Rule {
  words: string[];
  canonical: string;
}

/** Longest phrases first, so "por un plazo de" wins over "por". */
const RULES: readonly Rule[] = Object.entries(SYNONYMS)
  .flatMap(([canonical, phrases]) => phrases.map((phrase) => ({ words: normalize(phrase).split(" "), canonical })))
  .sort((a, b) => b.words.length - a.words.length);

/** Rewrites can chain ("la finca denominada" → "el lote denominada" → "el lote"); this bounds the passes. */
const MAX_PASSES = 3;

function ruleAt(tokens: Token[], i: number): Rule | undefined {
  return RULES.find((rule) => rule.words.every((word, k) => {
    const token = tokens[i + k];
    return token !== undefined && normalize(token.lexeme) === word;
  }));
}

function rewritePass(tokens: Token[], text: string, scan: (text: string) => Token[]): Token[] {
  const out: Token[] = [];
  for (let i = 0; i < tokens.length; ) {
    const rule = ruleAt(tokens, i);
    const first = tokens[i];
    const last = rule ? tokens[i + rule.words.length - 1] : undefined;
    if (first === undefined) break;
    if (rule === undefined || last === undefined) {
      out.push(first);
      i++;
      continue;
    }
    const synonymOf = text.slice(first.start, last.end);
    out.push(...scan(rule.canonical).map((t) => ({ ...t, start: first.start, end: last.end, synonymOf })));
    i += rule.words.length;
  }
  return out;
}

/**
 * Replaces dictionary phrases by their canonical tokens (scanned with the same DFAs). Each new token keeps
 * the position of the original words and records them in `synonymOf`, so the UI can show what was rewritten.
 */
export function applySynonyms(tokens: Token[], text: string, scan: (text: string) => Token[]): Token[] {
  let current = tokens;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const next = rewritePass(current, text, scan);
    const changed = next.length !== current.length || next.some((t, i) => t !== current[i]);
    current = next;
    if (!changed) break;
  }
  return current;
}
