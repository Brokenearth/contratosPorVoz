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
  animal: {
    guide: "Tipo de animal (y raza, si aplica)",
    question: "el tipo de animal",
    isPresent: (f) => animals(f).length > 0,
  },
  cantidad: {
    guide: "cantidad de animales",
    question: "la cantidad de animales",
    isPresent: (f) => animals(f).some((a) => a.cantidad !== undefined),
  },
  tipo_animal: {
    guide: "Tipo de animal (y raza, si aplica)",
    question: "el tipo de animal",
    isPresent: (f) => animals(f).length > 0,
  },
  cantidad_animales: {
    guide: "Cantidad de animales",
    question: "la cantidad de animales",
    isPresent: (f) => animals(f).some((a) => a.cantidad !== undefined),
  },
  raza: { guide: "raza", question: "la raza", isPresent: (f) => animals(f).some((a) => a.raza !== undefined) },
  lote: { guide: "Número de lote", question: "el número o nombre del lote", isPresent: (f) => f.lote !== undefined },
  hectareas: {
    guide: "hectáreas del lote",
    question: "las hectáreas del lote",
    isPresent: (f) => f.hectareas !== undefined || f.areaLocal !== undefined,
  },
  fecha: { guide: "Fecha", question: "la fecha", isPresent: (f) => f.fecha !== undefined },
  valor: {
    guide: "Valor del arrendamiento",
    question: "el valor del arrendamiento",
    isPresent: (f) => f.valor !== undefined,
  },
  uso: {
    guide: "Para qué se usará (uso)",
    question: "para qué se usará el lote",
    isPresent: (f) => f.uso !== undefined,
  },
  duracion: { guide: "duración", question: "la duración", isPresent: (f) => f.duracion !== undefined },
  cultivo: { guide: "Cultivo", question: "el cultivo", isPresent: (f) => f.cultivo !== undefined },
  insumos: {
    guide: "quién aporta los insumos",
    question: "quién aporta los insumos",
    isPresent: (f) => f.insumos !== undefined,
  },
  arrendador: {
    guide: "Nombre del arrendador",
    question: "el nombre del arrendador",
    isPresent: (f) => f.arrendador !== undefined,
  },
  arrendatario: {
    guide: "Nombre del arrendatario",
    question: "el nombre del arrendatario",
    isPresent: (f) => f.arrendatario !== undefined,
  },
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
  for (const key of declaration.required) lines.push(`• ${capitalize(infoOf(key)?.guide ?? key)}`);
  if (declaration.optional.length > 0) {
    lines.push(`Opcional: ${declaration.optional.map((k) => (infoOf(k)?.guide ?? k).toLowerCase()).join(", ")}`);
  }
  lines.push("Puede decirlo en el orden que prefiera.");
  return lines.join("\n");
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Required keys that are not present in `fields`, in declaration order. */
// Propuesta §5.6: diálogo por datos faltantes. Es lógica de aplicación;
// no constituye por sí misma otro autómata ni una prueba de corrección gramatical.
export function missingFields(fields: ContractFields, required: string[]): string[] {
  return required.filter((key) => !(infoOf(key)?.isPresent(fields) ?? false));
}

/** Question for the missing fields, e.g. "Falta la fecha y para qué se usará el lote."; "" when nothing is missing. */
export function questionFor(missing: string[]): string {
  if (missing.length === 0) return "";
  return `Falta ${joinSpanish(missing.map((key) => infoOf(key)?.question ?? key))}.`;
}

export function validateFields(fields: ContractFields): string[] {
  const errors: string[] = [];
  const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
  const area = fields.areaLocal?.cantidad ?? fields.hectareas;
  if (area !== undefined && !positive(area)) errors.push("Indique un área positiva.");
  if (fields.duracion && !positive(fields.duracion.cantidad)) errors.push("Indique una duración positiva.");
  if (fields.valor && !positive(fields.valor.monto)) errors.push("Indique un valor positivo y representable.");
  if (animals(fields).some(({ cantidad }) => cantidad !== undefined && !positive(cantidad))) {
    errors.push("Indique cantidades positivas de animales.");
  }
  if (fields.fecha) {
    const { dia, mes, anio } = fields.fecha;
    const leap = anio === undefined || (anio % 4 === 0 && (anio % 100 !== 0 || anio % 400 === 0));
    const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const maxDay = monthDays[mes - 1] ?? 0;
    if (!positive(dia) || dia > maxDay || (anio !== undefined && (!positive(anio) || anio > 9999))) {
      errors.push("Indique una fecha válida del calendario.");
    }
  }
  return errors;
}

/** Combines what was already detected with the parsed answer; values in `next` win. */
export function mergeFields(previous: ContractFields, next: ContractFields): ContractFields {
  const merged: ContractFields = { ...previous };
  if (next.areaLocal !== undefined || (next.lote !== undefined && next.lote !== previous.lote)) delete merged.hectareas;
  if (next.hectareas !== undefined || (next.lote !== undefined && next.lote !== previous.lote)) delete merged.areaLocal;
  for (const [key, value] of Object.entries(next)) {
    if (value !== undefined) Object.assign(merged, { [key]: value });
  }
  return merged;
}
