import type { AnimalItem, ContractFields } from "../types";

/** Field name → text written by the fill machine in place of `{{campo}}`. */
export type ValueMap = Record<string, string>;

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

/** Animals with feminine gender (for "destinadas"/"destinados"). */
const FEMININE_ANIMALS = ["vaca", "ternera", "novilla", "cabra", "oveja", "yegua", "cerda"];

/** Uses that read as "producción de …". */
const PRODUCTION_USES = ["leche", "carne", "lana", "doble proposito", "doble propósito"];

/** Field names extracted from the dictation (used by the selection machine). */
export function extractedFieldNames(fields: ContractFields): string[] {
  const values = toValueMap(fields);
  delete values.destinados;
  delete values.animales_descripcion;
  return Object.keys(values);
}

/** Turns the parser's fields into the formatted values of the templates (§6). */
export function toValueMap(fields: ContractFields): ValueMap {
  // "destinados" is grammar, not data: it always has a value so it never stays pending.
  const values: ValueMap = { destinados: "destinados" };
  if (fields.lote) values.lote = fields.lote;
  if (fields.hectareas !== undefined) values.hectareas = plural(fields.hectareas, "hectárea", "hectáreas");
  if (fields.animales && fields.animales.length > 0) Object.assign(values, animalValues(fields.animales));
  if (fields.uso) values.uso = formatUse(fields.uso);
  if (fields.cultivo) values.cultivo = fields.cultivo.toLowerCase();
  if (fields.insumos) values.insumos = formatSupplier(fields.insumos);
  if (fields.duracion) values.duracion = formatDuration(fields.duracion.cantidad, fields.duracion.unidad);
  if (fields.fecha) values.fecha = formatDate(fields.fecha.dia, fields.fecha.mes, fields.fecha.anio);
  if (fields.valor) values.valor = formatMoney(toPesos(fields.valor.monto, fields.valor.moneda));
  if (fields.arrendador) values.arrendador = fields.arrendador;
  if (fields.arrendatario) values.arrendatario = fields.arrendatario;
  return values;
}

/** 1200000 → "$ 1.200.000 pesos". */
export function formatMoney(pesos: number): string {
  const digits = String(Math.round(pesos));
  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    const fromEnd = digits.length - i;
    grouped += digits.charAt(i) + (fromEnd > 1 && fromEnd % 3 === 1 ? "." : "");
  }
  return `$ ${grouped} pesos`;
}

/** (15, 11, 2026) → "15 de noviembre de 2026"; without year → "15 de noviembre". */
export function formatDate(day: number, month: number, year?: number): string {
  const name = MONTHS[month - 1] ?? String(month);
  return year === undefined ? `${day} de ${name}` : `${day} de ${name} de ${year}`;
}

export function formatDuration(amount: number, unit: string): string {
  const u = unit.toLowerCase();
  if (u.startsWith("mes")) return plural(amount, "mes", "meses");
  if (u.startsWith("a")) return plural(amount, "año", "años");
  if (u.startsWith("d")) return plural(amount, "día", "días");
  if (u.startsWith("semana")) return plural(amount, "semana", "semanas");
  return `${amount} ${u}`;
}

function animalValues(items: AnimalItem[]): ValueMap {
  const values: ValueMap = {};
  const total = sumAmounts(items);
  if (total !== null) values.cantidad_animales = String(total);
  const breeds = unique(items.flatMap((item) => (item.raza ? [capitalize(item.raza)] : [])));
  if (breeds.length > 0) values.raza = joinSpanish(breeds);
  const first = items[0];
  const single = items.length === 1 && first !== undefined && !first.sub?.length;
  if (single && first) {
    values.tipo_animal = animalName(first.animal, first.cantidad ?? 2);
  } else {
    values.tipo_animal = "animales";
    values.animales_descripcion = describeAnimals(items);
  }
  const feminine = items.every((item) => FEMININE_ANIMALS.includes(singular(item.animal.toLowerCase())));
  values.destinados = feminine ? "destinadas" : "destinados";
  return values;
}

/** "20 vacas de raza Gir (de los cuales 5 terneras) y 2 toros de raza Brahman". */
function describeAnimals(items: AnimalItem[]): string {
  return joinSpanish(
    items.map((item) => {
      const amount = item.cantidad === undefined ? "" : `${item.cantidad} `;
      const breed = item.raza ? ` de raza ${capitalize(item.raza)}` : "";
      const sub = item.sub?.length ? ` (de los cuales ${describeAnimals(item.sub)})` : "";
      return `${amount}${animalName(item.animal, item.cantidad ?? 2)}${breed}${sub}`;
    }),
  );
}

function sumAmounts(items: AnimalItem[]): number | null {
  let total = 0;
  for (const item of items) {
    if (item.cantidad === undefined) return null;
    total += item.cantidad;
  }
  return total;
}

function animalName(animal: string, amount: number): string {
  const base = singular(animal.toLowerCase());
  return amount === 1 ? base : `${base}s`;
}

function singular(word: string): string {
  return word.endsWith("s") ? word.slice(0, -1) : word;
}

function formatUse(use: string): string {
  const u = use.toLowerCase();
  if (u.startsWith("producci")) return u;
  return PRODUCTION_USES.includes(u) ? `producción de ${u}` : `actividad de ${u}`;
}

function formatSupplier(supplies: string): string {
  const s = supplies.toLowerCase();
  if (s.includes("arrendatario")) return "el ARRENDATARIO";
  if (s.includes("arrendador")) return "el ARRENDADOR";
  return supplies;
}

function toPesos(amount: number, currency: string): number {
  return currency.toLowerCase().startsWith("millon") ? amount * 1_000_000 : amount;
}

function plural(amount: number, one: string, many: string): string {
  return `${amount} ${amount === 1 ? one : many}`;
}

function capitalize(word: string): string {
  return word
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function unique(list: string[]): string[] {
  return list.filter((item, index) => list.indexOf(item) === index);
}

/** ["a", "b", "c"] → "a, b y c". */
function joinSpanish(list: string[]): string {
  if (list.length <= 1) return list.join("");
  return `${list.slice(0, -1).join(", ")} y ${list.at(-1) ?? ""}`;
}
