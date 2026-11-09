import type { AnimalItem, ContractFields, ParseTree, Token } from "../types";
import { normalize } from "./predict";

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
  if (breed) item.raza = text(breed);
  const subopt = child(itemNode, "SUBOPT");
  const sub = subopt ? animalList(child(subopt, "LISTA")) : [];
  if (sub.length > 0) item.sub = sub;
  return item;
}

function amount(monto: ParseTree): { monto: number; moneda: string } {
  const tokens = leaves(monto);
  let value = tokens[0] ? num(tokens[0]) : 0;
  let currency = "pesos";
  for (const t of tokens.slice(1)) {
    const word = normalize(t.lexeme);
    if (word.startsWith("millon")) value *= 1_000_000;
    else if (word === "mil") value *= 1_000;
    else currency = text(t);
  }
  return { monto: value, moneda: currency };
}

function visit(node: ParseTree, fields: ContractFields): void {
  const tokens = leaves(node);
  switch (node.symbol) {
    case "ANIMALES":
      fields.animales = [...(fields.animales ?? []), ...animalList(child(node, "LISTA"))];
      return;
    case "LOTE": {
      const idTokens = leavesOf(node, "ID");
      const first = idTokens[0];
      if (first) fields.lote = first.type === "NUM" ? String(first.value) : properName(idTokens);
      const area = leavesOf(node, "AREAOPT").find((t) => t.type === "NUM");
      if (area) fields.hectareas = num(area);
      return;
    }
    case "VALOR": {
      const monto = child(node, "MONTO");
      if (monto) fields.valor = amount(monto);
      return;
    }
    case "FECHA": {
      const nums = tokens.filter((t) => t.type === "NUM");
      const mes = tokens.find((t) => t.type === "MES");
      if (nums[0] && mes) fields.fecha = { dia: num(nums[0]), mes: month(mes) };
      if (fields.fecha && nums[1]) fields.fecha.anio = num(nums[1]);
      return;
    }
    case "DURACION":
      if (tokens[1] && tokens[2]) fields.duracion = { cantidad: num(tokens[1]), unidad: text(tokens[2]) };
      return;
    case "USO": {
      const uso = tokens.filter((t) => t.type === "USO").map(text).join(" de ");
      // In a mixed dictation ("para ganadería de leche y para cultivo de maíz") the crop use must not
      // replace the livestock use: the crop itself goes to `cultivo`.
      if (fields.uso === undefined || !CROP_USES.includes(normalize(uso))) fields.uso = uso;
      return;
    }
    case "CULTIVO": {
      const crop = tokens[tokens.length - 1];
      if (crop) fields.cultivo = text(crop);
      return;
    }
    case "INSUMOS": {
      const role = leavesOf(node, "ROL")[0];
      if (role) fields.insumos = normalize(role.lexeme);
      return;
    }
    case "PARTES": {
      const role = leavesOf(node, "ROL")[0];
      const tail = leavesOf(node, "ROLTAIL");
      if (!role || tail.length === 0) return;
      const who = normalize(role.lexeme);
      if (tail[0] && normalize(tail[0].lexeme) === "aporta") fields.insumos = who;
      else if (who === "arrendador") fields.arrendador = properName(tail);
      else fields.arrendatario = properName(tail);
      return;
    }
    default:
      for (const c of node.children) visit(c, fields);
  }
}

/** Walks the derivation tree and collects the contract fields (proposal §5.5: lote ID vs animal count). */
// Materia: extracción semántica después del análisis sintáctico.
// Se recorre el árbol de derivación para dar significado a los tokens:
// el NUM dentro de LOTE identifica el predio; el NUM de ITEM cuenta animales.
export function extractFields(tree: ParseTree | null): ContractFields {
  const fields: ContractFields = {};
  if (tree) visit(tree, fields);
  return fields;
}
