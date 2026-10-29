import type { Token, TokenType } from "../types";

/**
 * Tiny token builder for parser tests. It is NOT the lexer: it splits a
 * phrase on single spaces and classifies each word with lookup tables, so the
 * parser can be tested without depending on src/core/lexer.
 * Commas must be written as separate words: "por 30 días , lote 20".
 */
const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const WORDS: Record<string, TokenType> = {
  ",": "COMA",
  y: "CONECTOR",
  gir: "RAZA", holstein: "RAZA", normando: "RAZA", brahman: "RAZA", jersey: "RAZA", angus: "RAZA",
  "días": "UNIDAD_TIEMPO", meses: "UNIDAD_TIEMPO", "años": "UNIDAD_TIEMPO",
  "hectáreas": "UNIDAD_AREA",
  pesos: "MONEDA", millones: "MONEDA",
  arriendo: "VERBO", arriendan: "VERBO", arrienda: "VERBO",
  "ganadería": "USO", pastoreo: "USO", cultivo: "USO", "producción": "USO", leche: "USO", carne: "USO",
  "maíz": "CULTIVO", "café": "CULTIVO", papa: "CULTIVO", yuca: "CULTIVO", frijol: "CULTIVO",
};

const KEYWORDS = [
  "lote", "en", "el", "la", "los", "las", "de", "raza", "por", "para", "un", "valor",
  "desde", "cuales", "fin", "arrendador", "arrendatario", "insumos", "aporta", "se",
];

const ANIMALS = ["vaca", "toro", "caballo", "cabra", "oveja", "cerdo", "ternera", "novillo"];

function isDigits(word: string): boolean {
  if (word.length === 0) return false;
  for (const ch of word) if (ch < "0" || ch > "9") return false;
  return true;
}

function classify(word: string): { type: TokenType; value: string | number } {
  const lower = word.toLowerCase();
  if (isDigits(word)) return { type: "NUM", value: Number(word) };
  const month = MONTHS.indexOf(lower);
  if (month >= 0) return { type: "MES", value: month + 1 };
  for (const animal of ANIMALS) {
    if (lower === animal || lower === `${animal}s`) return { type: "ANIMAL", value: animal };
  }
  if (KEYWORDS.includes(lower)) return { type: "PALABRA_CLAVE", value: lower };
  const type = WORDS[lower];
  if (type !== undefined) return { type, value: lower };
  return { type: "NOMBRE", value: word };
}

export function tokens(phrase: string): Token[] {
  const result: Token[] = [];
  let offset = 0;
  for (const word of phrase.split(" ")) {
    if (word.length > 0) {
      const { type, value } = classify(word);
      result.push({ type, lexeme: word, value, start: offset, end: offset + word.length });
    }
    offset += word.length + 1;
  }
  return result;
}
