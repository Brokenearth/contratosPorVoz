import type { TemplateDef } from "../types";

const IDS: TemplateDef["id"][] = ["PASTOREO", "CULTIVO", "MIXTA"];
const FENCE = "---";

/**
 * Parses a template file:
 *
 *   ---
 *   id: PASTOREO
 *   titulo: Contrato de …
 *   requeridos: lote, hectareas, …
 *   opcionales: fecha, …
 *   ---
 *   body with {{campo}} markers and [[?campo]] … [[/campo]] optional sections
 */
export function parseTemplate(source: string): TemplateDef {
  const lines = source.split("\n");
  const end = lines.indexOf(FENCE, 1);
  if (lines[0]?.trim() !== FENCE || end === -1) throw new Error("La plantilla no tiene bloque de declaración ---");

  const entries = new Map<string, string>();
  for (const line of lines.slice(1, end)) {
    const colon = line.indexOf(":");
    if (colon !== -1) entries.set(line.slice(0, colon).trim(), line.slice(colon + 1).trim());
  }
  const id = IDS.find((candidate) => candidate === entries.get("id"));
  if (!id) throw new Error(`Id de plantilla desconocido: ${entries.get("id") ?? "(vacío)"}`);

  return {
    id,
    title: entries.get("titulo") ?? id,
    required: splitList(entries.get("requeridos")),
    optional: splitList(entries.get("opcionales")),
    body: lines
      .slice(end + 1)
      .join("\n")
      .trim(),
  };
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}
