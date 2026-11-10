import { normalizePartyName } from "../partyNames";
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

// Identity predicates and link words compose a relation without a list of whole phrases.
const IDENTITY_VERBS = new Set([
  "es", "son", "soy", "era", "sera", "seria", "sea", "ser", "llama", "llamado", "llamada",
  "figura", "figurara", "figuraria", "actua", "actuara", "actuaria", "queda", "quedara", "quedaria",
  "corresponde", "corresponderia", "identifica", "desempena", "desempenara",
]);
const LINKS = new Set(["a", "de", "como", "se", "va", "voy", "puede", "podria", "quien", "que", "en", "calidad", "no"]);
const TITLES = new Set(["don", "doña", "señor", "señora", "vecino", "vecina", "persona"]);
const PARTICLES = new Set(["de", "del", "la", "las", "los"]);
const ALTERNATIVES = new Set(["o", "u", "y", "e"]);
const PRONOUNS = new Set(["el", "ella", "ellos", "ellas", "yo", "tu", "usted", "alguien", "nadie"]);
const proper = (token: Token | undefined) =>
  token !== undefined && /^\p{Lu}/u.test(token.lexeme) && token.type !== "PALABRA_CLAVE" &&
  token.type !== "VERBO" && !TITLES.has(word(token));

function nameToken(tokens: Token[], start: number, end: number, text: string): Token | undefined {
  const first = tokens[start];
  const last = tokens[end - 1];
  if (!first || !last || start >= end || PRONOUNS.has(word(first)) ||
      tokens.slice(start, end).some((token) => ALTERNATIVES.has(word(token)) || word(token) === "no")) return undefined;
  const name = text.slice(first.start, last.end);
  return normalizePartyName(name)
    ? { type: "NOMBRE", lexeme: name, value: name, start: first.start, end: last.end, partyName: true }
    : undefined;
}

function beforeRole(tokens: Token[], roleIndex: number) {
  let cursor = roleIndex - 1;
  if (ARTICLES.includes(word(tokens[cursor]))) cursor--;
  let identity = false;
  let relative = false;
  let negated = false;
  while (cursor >= 0) {
    const part = word(tokens[cursor]);
    if (!LINKS.has(part) && !IDENTITY_VERBS.has(part)) break;
    identity ||= IDENTITY_VERBS.has(part) || part === "como" || part === "calidad";
    relative ||= part === "quien" || part === "que";
    negated ||= part === "no";
    cursor--;
  }
  if (!identity) return undefined;
  if (relative && tokens[cursor]?.type === "COMA") cursor--;

  const end = cursor + 1;
  while (cursor >= 0 && (proper(tokens[cursor]) || PARTICLES.has(word(tokens[cursor])) ||
    ALTERNATIVES.has(word(tokens[cursor])))) cursor--;
  let start = cursor + 1;
  if (start === end && (relative || TITLES.has(word(tokens[cursor - 1])))) {
    while (cursor >= 0 && tokens[cursor]?.type === "NOMBRE" &&
        !TITLES.has(word(tokens[cursor])) && !tokens[cursor]?.partyName) cursor--;
    start = cursor + 1;
  }
  while (start < end && (PARTICLES.has(word(tokens[start])) || ["y", "e"].includes(word(tokens[start])))) start++;
  let begin = start;
  if (TITLES.has(word(tokens[begin - 1]))) {
    begin--;
    if (ARTICLES.includes(word(tokens[begin - 1]))) begin--;
  }
  return { begin, start, end, negated };
}

function skipIntroduction(tokens: Token[], start: number) {
  let index = start;
  while (LINKS.has(word(tokens[index])) || IDENTITY_VERBS.has(word(tokens[index])) ||
      TITLES.has(word(tokens[index])) || word(tokens[index]) === "nombre" ||
      (ARTICLES.includes(word(tokens[index])) && TITLES.has(word(tokens[index + 1])))) index++;
  return index;
}

// The lexical adapter preserves spans. The PDA still consumes and validates the PARTES production.
export function groupPartyNames(tokens: Token[], text: string): { tokens: Token[]; warnings: string[] } {
  const grouped: Token[] = [];
  const warnings: string[] = [];
  const review = (token: Token) =>
    warnings.push(`El nombre asociado a «${token.lexeme}» es ambiguo. Confirme el correcto en su casilla.`);
  for (let i = 0; i < tokens.length; i++) {
    const role = tokens[i]!;
    const previous = word(tokens[i - (ARTICLES.includes(word(tokens[i - 1])) ? 2 : 1)]);
    if (!ROLE_WORDS.includes(word(role)) || SUPPLIER_VERBS.includes(previous) ||
        previous === "del" || SUPPLIER_VERBS.includes(word(tokens[i + 1]))) {
      grouped.push(role);
      continue;
    }

    const reverse = beforeRole(tokens, i);
    if (reverse) {
      const prior = tokens.slice(reverse.begin, i);
      if (prior.every((token, j) => grouped[grouped.length - prior.length + j] === token)) {
        grouped.splice(grouped.length - prior.length, prior.length, role);
        const name = reverse.negated ? undefined : nameToken(tokens, reverse.start, reverse.end, text);
        if (name) grouped.push(name);
        else review(role);
        continue;
      }
    }

    grouped.push(role);
    const start = skipIntroduction(tokens, i + 1);
    let end = start;
    while (end < tokens.length && !startsClause(tokens, end)) end++;
    let ambiguous = tokens.slice(i + 1, start).some((token) => word(token) === "no");
    if (start < end && ["y", "e"].includes(word(tokens[end])) && proper(tokens[end + 1]) &&
        !startsClause(tokens, end + 1)) {
      ambiguous = true;
      end++;
      while (end < tokens.length && !startsClause(tokens, end)) end++;
    }
    const name = ambiguous ? undefined : nameToken(tokens, start, end, text);
    if (name) grouped.push(name);
    else if (start !== i + 1 || end > start) review(role);
    i = end - 1;
  }
  return { tokens: grouped, warnings };
}
