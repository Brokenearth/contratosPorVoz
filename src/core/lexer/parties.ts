import type { Token } from "../types";
import { normalize } from "./normalize";

export const PARTY_ALIASES = {
  arrendador: ["arrendadora", "propietario", "propietaria", "dueño", "dueña", "arrendante"],
  arrendatario: ["arrendataria", "inquilino", "inquilina"],
};

const ROLES = ["arrendador", "arrendadora", "arrendatario", "arrendataria"];
const ROLE_WORDS = [...ROLES, ...Object.values(PARTY_ALIASES).flat()];
const ARTICLES = ["el", "la", "los", "las"];
const SUPPLIER_VERBS = ["aporta", "aportan", "pone", "suministra", "corre"];
const LOT_WORDS = ["lote", "finca", "parcela", "hacienda", "predio"];
const CLAUSE_WORDS = ["lote", "valor", "desde", "durante", "fin", "destinado", "destinada"];
const word = (token: Token | undefined) => normalize(token?.lexeme ?? "");

function startsClause(tokens: Token[], index: number): boolean {
  const current = tokens[index];
  const next = tokens[index + 1];
  const first = word(current);
  const second = word(next);
  return current?.type === "COMA" || current?.type === "NUM" || current?.type === "VERBO" ||
    first === "y" || first === "e" || ROLES.includes(first) || CLAUSE_WORDS.includes(first) ||
    (ROLE_WORDS.includes(first) && second === "nombre") ||
    (ARTICLES.includes(first) && (ROLE_WORDS.includes(second) || LOT_WORDS.includes(second) ||
      second === "insumos" || next?.type === "NUM")) ||
    (first === "en" && ARTICLES.includes(second)) ||
    (first === "a" && second === "partir") ||
    (first === "se" && (next?.type === "VERBO" || ["da", "entrega", "renta"].includes(second))) ||
    (["doy", "entrego"].includes(first) && second === "en") ||
    (first === "por" && (next?.type === "NUM" || ["un", "una", "la", "el"].includes(second))) ||
    (first === "para" && (["NUM", "ANIMAL", "USO", "CULTIVO"].includes(next?.type ?? "") || second === "sembrar"));
}

// AFD tokens supply boundaries. The name itself keeps the original spelling and span.
export function groupPartyNames(tokens: Token[], text: string): Token[] {
  const grouped: Token[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) break;
    grouped.push(token);
    if (!ROLE_WORDS.includes(word(token))) continue;
    const previous = word(tokens[i - (ARTICLES.includes(word(tokens[i - 1])) ? 2 : 1)]);
    if (SUPPLIER_VERBS.includes(previous) || previous === "del" || SUPPLIER_VERBS.includes(word(tokens[i + 1]))) continue;

    const marker = tokens[i + 1];
    if (marker && word(marker) === "nombre") {
      grouped.push(marker);
      i++;
    }
    const start = tokens[i + 1];
    if (!start) continue;
    let end = i + 1;
    while (end < tokens.length && !startsClause(tokens, end)) end++;
    const last = tokens[end - 1];
    if (end === i + 1 || !last) continue;
    const name = text.slice(start.start, last.end);
    grouped.push({ type: "NOMBRE", lexeme: name, value: name, start: start.start, end: last.end, partyName: true });
    i = end - 1;
  }
  return grouped;
}
