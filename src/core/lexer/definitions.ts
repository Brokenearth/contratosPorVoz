import type { TokenType } from "../types";
import { normalize } from "./normalize";

/**
 * Token definitions written as regular expressions in the course notation (proposal §5.1).
 * The input is normalized first (lowercase, no accents), so every regex uses unaccented words;
 * the token value keeps the accented spelling ("maiz" → "maíz").
 */
export interface TokenDefinition {
  name: string;
  type: TokenType;
  regex: string;
  spellings?: readonly { value: string; meaning: string }[];
  /** Value of a matched lexeme (`normalized` is lowercase without accents). */
  value: (normalized: string, original: string) => string | number;
}

/** Named sub-expressions that token regexes may reference. */
// Materia §5.1: estas cadenas describen lenguajes regulares, no patrones que
// el lexer entregue al RegExp nativo. NUM = DIGITO DIGITO* exige al menos un dígito.
export const NAMED_DEFINITIONS: Readonly<Record<string, string>> = {
  DIGITO: "0|1|2|3|4|5|6|7|8|9",
  LETRA: "a|b|c|d|e|f|g|h|i|j|k|l|m|n|ñ|o|p|q|r|s|t|u|v|w|x|y|z",
  NUM: "DIGITO DIGITO*",
};

type Plural = "s" | "es" | "";

interface Word {
  word: string;
  plural?: Plural;
  value?: string | number;
}

/** Builds `(w1|w2)(s|λ) | (w3)(es|λ) | w4` from a list of words. */
function wordsRegex(words: readonly Word[]): string {
  const groups: string[] = [];
  for (const suffix of ["s", "es", ""] as const) {
    const group = words.filter((w) => (w.plural ?? "") === suffix).map((w) => normalize(w.word));
    if (group.length === 0) continue;
    const alternatives = group.join("|");
    groups.push(suffix === "" ? alternatives : `(${alternatives})(${suffix}|λ)`);
  }
  return groups.join(" | ");
}

/** Value of the word whose normalized spelling is the longest prefix of the lexeme. */
function wordsValue(words: readonly Word[]): TokenDefinition["value"] {
  return (normalized) => {
    let best: Word | undefined;
    for (const w of words) {
      const base = normalize(w.word);
      if (normalized.startsWith(base) && base.length > (best === undefined ? 0 : normalize(best.word).length)) {
        best = w;
      }
    }
    return best?.value ?? best?.word ?? normalized;
  };
}

function fromWords(name: string, type: TokenType, words: readonly Word[]): TokenDefinition {
  const spellings = words.flatMap(({ word, plural, value }) => {
    const meaning = String(value ?? word);
    const singular = { value: word, meaning };
    if (!plural) return [singular];
    const pluralBase = plural === "es" ? normalize(word) : word;
    return [singular, { value: pluralBase + plural, meaning }];
  });
  return { name, type, regex: wordsRegex(words), value: wordsValue(words), spellings };
}

const forms = (plural: Plural, ...list: string[]): Word[] => list.map((word) => ({ word, plural }));

const NUMBER_WORDS = [
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
];

export const BREEDS = [
  "holstein", "gir", "normando", "brahman", "jersey", "angus", "cebú", "simmental",
  "criollo", "guzerat", "romosinuano", "girolando", "pardo",
] as const;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function digitsValue(normalized: string): number {
  let digits = "";
  for (const ch of normalized) if (ch !== ".") digits += ch;
  return Number(digits);
}

/** Definitions in priority order: on equal match length the earlier one wins. */
export const TOKEN_DEFINITIONS: readonly TokenDefinition[] = [
  { name: "NUM", type: "NUM", regex: "DIGITO DIGITO*", value: digitsValue },
  {
    name: "NUM_MILES",
    type: "NUM",
    regex: "DIGITO (DIGITO|λ) (DIGITO|λ) (\\. DIGITO DIGITO DIGITO)+",
    value: digitsValue,
  },
  fromWords(
    "NUM_PALABRA",
    "NUM",
    NUMBER_WORDS.map((word, i) => ({ word, value: i + 1 })),
  ),
  fromWords("MES", "MES", [...MONTHS.map((word, i) => ({ word, value: i + 1 })), { word: "setiembre", value: 9 }]),
  fromWords("ANIMAL", "ANIMAL", [
    ...forms("s", "vaca", "toro", "caballo", "yegua", "cabra", "oveja", "cerdo"),
    ...forms("s", "ternero", "ternera", "novillo", "novilla", "becerro", "becerra", "mula", "bovino"),
    ...forms("es", "buey", "res"),
  ]),
  fromWords("RAZA", "RAZA", forms("", ...BREEDS)),
  fromWords("UNIDAD_TIEMPO", "UNIDAD_TIEMPO", [...forms("s", "día", "año", "semana", "quincena"), ...forms("es", "mes")]),
  fromWords("UNIDAD_AREA", "UNIDAD_AREA", forms("s", "hectárea", "fanegada", "cuadra")),
  fromWords("MONEDA", "MONEDA", [...forms("s", "peso"), ...forms("es", "millón"), ...forms("", "mil")]),
  fromWords(
    "VERBO",
    "VERBO",
    forms("", "arriendo", "arrienda", "arriendan", "arrendar", "alquilo", "alquila", "alquilan"),
  ),
  fromWords("USO", "USO", [
    ...forms("", "pastoreo", "ganadería", "cultivo", "siembra", "leche", "carne", "ceba", "cría", "engorde"),
    ...forms("", "levante", "agricultura", "producción"),
  ]),
  fromWords("CULTIVO", "CULTIVO", [
    ...forms("s", "papa", "yuca", "plátano", "banano", "habichuela", "arveja", "tomate", "cebolla", "aguacate", "naranja", "mango"),
    ...forms("es", "frijol", "limón"),
    ...forms("", "maíz", "café", "cacao", "arroz", "caña", "sorgo", "algodón", "pasto"),
  ]),
  fromWords("INSUMOS", "INSUMOS", forms("s", "insumo", "semilla", "abono", "fertilizante", "fumigante")),
  fromWords("CONECTOR", "CONECTOR", forms("", "y", "e")),
  {
    ...fromWords("PALABRA_CLAVE", "PALABRA_CLAVE", [
      ...forms("s", "lote"),
      ...forms("", "en", "el", "la", "los", "las", "de", "del", "al", "a", "raza", "por", "para", "un", "una"),
      ...forms("", "valor", "desde", "hasta", "durante", "con", "se", "cuales", "fin"),
      ...forms("", "arrendador", "arrendadora", "arrendatario", "arrendataria", "nombre", "aporta", "aportan", "aporte"),
    ]),
    value: (normalized) => normalized,
  },
  { name: "COMA", type: "COMA", regex: ",", value: () => "," },
  { name: "NOMBRE", type: "NOMBRE", regex: "LETRA LETRA* ((-|') LETRA LETRA*)*", value: (_normalized, original) => original },
];
