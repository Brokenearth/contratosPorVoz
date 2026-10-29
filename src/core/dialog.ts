import type { ContractFields, TemplateDef } from "./types";
import { normalize } from "./parser/predict";

/** Field declaration of a template (proposal §5.6): the dialog never hardcodes which fields are required. */
export type FieldDeclaration = Pick<TemplateDef, "required" | "optional">;

interface FieldInfo {
  /** Line shown in the guide. */
  guide: string;
  /** Phrase used in "Falta ..." questions. */
  question: string;
  isPresent: (fields: ContractFields) => boolean;
}

const animals = (f: ContractFields) => [...(f.animales ?? []), ...(f.animales ?? []).flatMap((a) => a.sub ?? [])];

/** Known field keys (accents ignored). Unknown keys fall back to the key itself. */
const FIELDS: Record<string, FieldInfo> = {
  animal: { guide: "Tipo de animal (y raza, si aplica)", question: "el tipo de animal", isPresent: (f) => animals(f).length > 0 },
  cantidad: { guide: "cantidad de animales", question: "la cantidad de animales", isPresent: (f) => animals(f).some((a) => a.cantidad !== undefined) },
  tipo_animal: { guide: "Tipo de animal (y raza, si aplica)", question: "el tipo de animal", isPresent: (f) => animals(f).length > 0 },
  cantidad_animales: { guide: "Cantidad de animales", question: "la cantidad de animales", isPresent: (f) => animals(f).some((a) => a.cantidad !== undefined) },
  raza: { guide: "raza", question: "la raza", isPresent: (f) => animals(f).some((a) => a.raza !== undefined) },
  lote: { guide: "Número de lote", question: "el número o nombre del lote", isPresent: (f) => f.lote !== undefined },
  hectareas: { guide: "hectáreas del lote", question: "las hectáreas del lote", isPresent: (f) => f.hectareas !== undefined },
  fecha: { guide: "Fecha", question: "la fecha", isPresent: (f) => f.fecha !== undefined },
  valor: { guide: "Valor del arrendamiento", question: "el valor del arrendamiento", isPresent: (f) => f.valor !== undefined },
  uso: { guide: "Para qué se usará (uso)", question: "para qué se usará el lote", isPresent: (f) => f.uso !== undefined },
  duracion: { guide: "duración", question: "la duración", isPresent: (f) => f.duracion !== undefined },
  cultivo: { guide: "Cultivo", question: "el cultivo", isPresent: (f) => f.cultivo !== undefined },
  insumos: { guide: "quién aporta los insumos", question: "quién aporta los insumos", isPresent: (f) => f.insumos !== undefined },
  arrendador: { guide: "Nombre del arrendador", question: "el nombre del arrendador", isPresent: (f) => f.arrendador !== undefined },
  arrendatario: { guide: "Nombre del arrendatario", question: "el nombre del arrendatario", isPresent: (f) => f.arrendatario !== undefined },
};

function infoOf(key: string): FieldInfo | undefined {
  return FIELDS[normalize(key)];
}

/** "a", "a y b", "a, b y c". */
function joinSpanish(parts: string[]): string {
  if (parts.length <= 1) return parts.join("");
  return `${parts.slice(0, -1).join(", ")} y ${parts[parts.length - 1]}`;
}

/** Initial guide (proposal §5.6) built from the template declaration. */
export function guideText(declaration: FieldDeclaration): string {
  const lines = ["Para redactar su contrato, mencione:"];
  for (const key of declaration.required) lines.push(`✔ ${infoOf(key)?.guide ?? key}`);
  if (declaration.optional.length > 0) {
    lines.push(`Opcional: ${declaration.optional.map((k) => (infoOf(k)?.guide ?? k).toLowerCase()).join(", ")}`);
  }
  lines.push("Puede decirlo en el orden que prefiera.");
  return lines.join("\n");
}

/** Required keys that are not present in `fields`, in declaration order. */
export function missingFields(fields: ContractFields, required: string[]): string[] {
  return required.filter((key) => !(infoOf(key)?.isPresent(fields) ?? false));
}

/** Question for the missing fields, e.g. "Falta la fecha y para qué se usará el lote."; "" when nothing is missing. */
export function questionFor(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Falta ${joinSpanish(missing.map((key) => infoOf(key)?.question ?? key))}.`;
}

/** Combines what was already detected with the parsed answer; values in `next` win. */
export function mergeFields(previous: ContractFields, next: ContractFields): ContractFields {
  const merged: ContractFields = { ...previous };
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined) Object.assign(merged, { [key]: value });
  }
  return merged;
}
