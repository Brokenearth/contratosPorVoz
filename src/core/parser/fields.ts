import type { AnimalItem, ContractFields, ParseTree, PartyNames, Token } from "../types";
import { normalize } from "./predict";
import { normalizePartyName } from "../partyNames";

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Uses that only say "a crop goes here" (the crop is a separate field). */
const CROP_USES = ["cultivo", "siembra", "agricultura"];

/** All tokens under `node`, left to right. */
function leaves(node: ParseTree): Token[] {
  if (node.token) return [node.token];
  return node.children.flatMap(leaves);
}

function child(node: ParseTree, symbol: string): ParseTree | undefined {
  return node.children.find((c) => c.symbol === symbol);
}

function tokenOf(node: ParseTree, symbol: string): Token | undefined {
  return child(node, symbol)?.token;
}

function leavesOf(node: ParseTree, symbol: string): Token[] {
  const found = child(node, symbol);
  return found ? leaves(found) : [];
}

const text = (token: Token): string => token.lexeme.toLowerCase();
const num = (token: Token): number => Number(token.value);
const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
const properName = (tokens: Token[]): string => tokens.map((t) => capitalize(t.lexeme)).join(" ");

function month(token: Token): number {
  const n = Number(token.value);
  return Number.isNaN(n) ? MONTHS.indexOf(normalize(token.lexeme)) + 1 : n;
}

/** LISTA → ITEM RESTO, RESTO → , ITEM RESTO | y ITEM | λ  ⇒ flat list of items (with nested `sub`). */
function animalList(lista: ParseTree | undefined): AnimalItem[] {
  if (lista === undefined) return [];
  return lista.children.flatMap((c) => {
    if (c.symbol === "ITEM") return [animalItem(c)];
    if (c.symbol === "RESTO") return animalList(c);
    return [];
  });
}

function animalItem(itemNode: ParseTree): AnimalItem {
  const animal = tokenOf(itemNode, "animal");
  const item: AnimalItem = { animal: animal ? text(animal) : "" };
  const count = tokenOf(itemNode, "num");
  if (count) item.cantidad = num(count);
  const breed = leavesOf(itemNode, "RAZAOPT").find((t) => t.type === "RAZA");
  if (breed) item.raza = String(breed.value);
  const subopt = child(itemNode, "SUBOPT");
  const sub = subopt ? animalList(child(subopt, "LISTA")) : [];
  if (sub.length > 0) item.sub = sub;
  return item;
}

function amount(monto: ParseTree): { monto: number; moneda: string } {
  const tokens = leaves(monto);
  let value = tokens[0] ? num(tokens[0]) : 0;
  for (const t of tokens.slice(1)) {
    const word = normalize(t.lexeme);
    if (word.startsWith("millon")) value *= 1_000_000;
    else if (word === "mil") value *= 1_000;
  }
  return { monto: value, moneda: "pesos" };
}

const CLAUSE_LABELS: Readonly<Record<string, string>> = {
  VALOR: "valor", FECHA: "fecha", DURACION: "duración", LOTE: "lote",
  ANIMALES: "animales", CULTIVO: "cultivo", INSUMOS: "insumos",
  USO: "uso del lote", PARTES: "partes",
};

interface Review {
  issues: string[];
  partyConflicts: Map<keyof PartyNames, Set<string>>;
  lastClause?: string;
}

function addIssue(review: Review, message: string): void {
  if (!review.issues.includes(message)) review.issues.push(message);
}

function visit(node: ParseTree, fields: ContractFields, review: Review): void {
  if (node.symbol === "CLAUSULA") {
    const clause = node.children[0];
    if (clause?.symbol === "descartado" && clause.token) {
      const where = review.lastClause ? " después de la cláusula de " + review.lastClause : "";
      addIssue(review, "No se interpretó «" + clause.token.lexeme + "»" + where +
        ". Corrija el dictado y vuelva a analizarlo.");
      return;
    }
    if (clause && CLAUSE_LABELS[clause.symbol]) review.lastClause = CLAUSE_LABELS[clause.symbol];
  }
  const setField = <K extends keyof ContractFields>(key: K, value: ContractFields[K], label: string): void => {
    const previous = fields[key];
    if (previous === undefined) fields[key] = value;
    else if (JSON.stringify(previous) !== JSON.stringify(value)) {
      addIssue(review, "Hay datos distintos para " + label + ". Corrija el dictado para dejar un solo dato.");
    }
  };
  const tokens = leaves(node);
  switch (node.symbol) {
    case "ANIMALES":
      fields.animales = [...(fields.animales ?? []), ...animalList(child(node, "LISTA"))];
      return;
    case "LOTE": {
      const idTokens = leavesOf(node, "ID");
      const first = idTokens[0];
      if (first) {
        const id = first.type !== "NUM" ? properName(idTokens)
          : /^[0-9]/.test(first.lexeme) ? first.lexeme : String(first.value);
        setField("lote", id, "el lote");
      }
      const [area, unit] = leavesOf(node, "AREAOPT").filter((token) => token.type !== "PALABRA_CLAVE");
      if (area && unit) {
        const unitName = unit.value;
        if (unitName === "fanegada" || unitName === "cuadra") {
          setField("areaLocal", { cantidad: num(area), unidad: unitName }, "el área del lote");
        } else {
          setField("hectareas", num(area), "el área del lote");
        }
        if (fields.hectareas !== undefined && fields.areaLocal) {
          addIssue(review, "Hay dos unidades para el área del lote. Indique una sola extensión.");
        }
      }
      return;
    }
    case "VALOR": {
      const monto = child(node, "MONTO");
      if (monto) {
        const words = leaves(monto).slice(1).map((token) => normalize(token.lexeme));
        // The grammar recognizes currency tokens. Their order still has to describe a single total.
        const units = words.join(" ").replace(/^de /, "");
        if (!/^(?:(?:mil|millon(?:es)?)(?: (?:de )?pesos?)?|pesos?|mil millones(?: de pesos?| pesos?)?)$/.test(units)) {
          addIssue(review, "Indique un solo valor total en pesos, por ejemplo «900 mil pesos».");
        } else {
          setField("valor", amount(monto), "el valor");
        }
      }
      return;
    }
    case "FECHA": {
      const nums = tokens.filter((t) => t.type === "NUM");
      const mes = tokens.find((t) => t.type === "MES");
      if (nums[0] && mes) {
        const date = { dia: num(nums[0]), mes: month(mes) };
        setField("fecha", nums[1] ? { ...date, anio: num(nums[1]) } : date, "la fecha de inicio");
      }
      return;
    }
    case "DURACION":
      if (tokens[1] && tokens[2]) setField("duracion", { cantidad: num(tokens[1]), unidad: text(tokens[2]) }, "la duración");
      return;
    case "USO": {
      const uso = tokens.filter((t) => t.type === "USO").map(text).join(" de ");
      // In a mixed dictation ("para ganadería de leche y para cultivo de maíz") the crop use must not
      // replace the livestock use: the crop itself goes to `cultivo`.
      const current = fields.uso;
      const isCropUse = CROP_USES.includes(normalize(uso));
      const currentIsCropUse = current !== undefined && CROP_USES.includes(normalize(current));
      if (current === undefined || (currentIsCropUse && !isCropUse)) {
        fields.uso = uso;
      } else if (currentIsCropUse === isCropUse && normalize(current) !== normalize(uso)) {
        setField("uso", uso, "el uso del lote");
      }
      return;
    }
    case "CULTIVO": {
      const crop = tokens[tokens.length - 1];
      if (crop) setField("cultivo", String(crop.value), "el cultivo");
      return;
    }
    case "INSUMOS": {
      const role = leavesOf(node, "ROL")[0];
      if (role) setField("insumos", normalize(role.lexeme), "quién aporta los insumos");
      return;
    }
    case "PARTES": {
      const role = leavesOf(node, "ROL")[0];
      const tail = leavesOf(node, "ROLTAIL");
      if (!role || tail.length === 0) return;
      const who = normalize(role.lexeme);
      if (tail[0] && normalize(tail[0].lexeme) === "aporta") setField("insumos", who, "quién aporta los insumos");
      else {
        const name = normalizePartyName(tail.filter((token) => token.type === "NOMBRE").map((token) => token.lexeme).join(" "));
        if (!name) return;
        const key = who === "arrendador" ? "arrendador" : "arrendatario";
        const conflict = review.partyConflicts.get(key);
        const previous = fields[key];
        if (conflict) conflict.add(name);
        else if (previous && previous !== name) {
          review.partyConflicts.set(key, new Set([previous, name]));
          delete fields[key];
        } else fields[key] = name;
      }
      return;
    }
    default:
      for (const c of node.children) visit(c, fields, review);
  }
}

/** Walks the derivation tree and collects the contract fields (proposal §5.5: lote ID vs animal count). */
// Materia: extracción semántica después del análisis sintáctico.
// Se recorre el árbol de derivación para dar significado a los tokens:
// el NUM dentro de LOTE identifica el predio; el NUM de ITEM cuenta animales.
export function extractFields(tree: ParseTree | null, warnings: string[] = [], issues: string[] = []): ContractFields {
  const fields: ContractFields = {};
  const review: Review = { issues, partyConflicts: new Map() };
  if (tree) visit(tree, fields, review);
  for (const [role, names] of review.partyConflicts) {
    warnings.push(`Hay varios nombres para ${role}: ${[...names].join(", ")}. Confirme el correcto en su casilla.`);
  }
  return fields;
}
