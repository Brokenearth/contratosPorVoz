import type { TemplateDef } from "../types";
import cultivo from "./cultivo.md?raw";
import mixta from "./mixta.md?raw";
import pastoreo from "./pastoreo.md?raw";
import { parseTemplate } from "./parse";

export { extractedFieldNames, formatDate, formatDuration, formatMoney, toValueMap, type ValueMap } from "./format";
export { parseTemplate } from "./parse";

/** All available templates, in preference order (used to break ties). */
export const TEMPLATES: TemplateDef[] = [pastoreo, cultivo, mixta].map(parseTemplate);

export function getTemplate(id: TemplateDef["id"]): TemplateDef {
  const template = TEMPLATES.find((t) => t.id === id);
  if (!template) throw new Error(`Plantilla no encontrada: ${id}`);
  return template;
}
