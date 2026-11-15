import { fieldQuestion, missingFields, validateFields } from "./dialog";
import { correctTranscription } from "./lexer/similarity";
import { parseContract } from "./parser";
import type { AnimalItem, ContractFields, TemplateDef } from "./types";

/** What the user typed in each individual box, keyed by template field. */
export type FieldAnswers = Readonly<Record<string, string | undefined>>;

export interface ComposedAnswer {
  /** Dictation built from the boxes; it goes through the same pipeline as a spoken answer. */
  text: string;
  /** Message per field whose box could not be analyzed. */
  errors: Record<string, string>;
}

/** Party names have their own review boxes and the animal description is derived from the list. */
const NOT_ASKED = new Set(["animales_descripcion", "arrendador", "arrendatario"]);
const ANIMAL_KEYS = ["tipo_animal", "cantidad_animales", "raza"];
export const SUPPLIERS = ["arrendador", "arrendatario"] as const;

/**
 * Each box is turned into a clause of the grammar. The raw text is tried first, so a full phrase
 * ("desde el 15 de noviembre") is kept; otherwise the keyword that opens the clause is added.
 */
const CANDIDATES: Record<string, (text: string) => string[]> = {
  lote: (t) => [t, `lote ${t}`],
  fecha: (t) => [t, `desde el ${t}`],
  uso: (t) => [t, `para ${t}`],
  duracion: (t) => [t, `por ${t}`],
  valor: (t) => [t, `por un valor de ${t}`, `por un valor de ${t} pesos`],
  cultivo: (t) => [t, `para ${t}`, `para cultivo de ${t}`],
  insumos: (t) => (SUPPLIERS.some((role) => role === t) ? [`los insumos los aporta el ${t}`] : []),
};

/** Fields each box may set: a box cannot change other data of the contract ("2 millones y lote 9"). */
const SCOPE: Record<string, readonly (keyof ContractFields)[]> = {
  lote: ["lote", "hectareas", "areaLocal"],
  hectareas: ["lote", "hectareas", "areaLocal"],
  tipo_animal: ["animales"],
  cantidad_animales: ["animales"],
  raza: ["animales"],
  fecha: ["fecha"],
  uso: ["uso"],
  duracion: ["duracion"],
  valor: ["valor"],
  cultivo: ["cultivo", "uso"],
  insumos: ["insumos"],
};

/** Keys outside the box's scope; the cultivo clause also sets `uso: "cultivo"`, which is allowed. */
function outOfScope(fields: ContractFields, key: string): string[] {
  const scope = SCOPE[key] ?? [];
  return (Object.keys(fields) as (keyof ContractFields)[]).filter(
    (field) =>
      (fields[field] !== undefined && !scope.includes(field)) ||
      (key === "cultivo" && field === "uso" && fields.uso !== "cultivo"),
  );
}

/** Order of the clauses in the composed answer. */
const ORDER = ["lote", "hectareas", ...ANIMAL_KEYS, "uso", "cultivo", "fecha", "duracion", "valor", "insumos"];

/** The animal list can be completed box by box only when it has at most one item without subgroups. */
function singleAnimal(fields: ContractFields): AnimalItem | null | undefined {
  const animals = fields.animales ?? [];
  if (animals.length === 0) return null;
  const [first] = animals;
  return animals.length === 1 && first && !first.sub?.length ? first : undefined;
}

/** Fields the boxes ask for: the missing required ones and the optional ones the template prints. */
export function missingOptional(fields: ContractFields, template: TemplateDef): string[] {
  const animal = singleAnimal(fields);
  return missingFields(fields, template.optional).filter(
    (key) => !NOT_ASKED.has(key) && (!ANIMAL_KEYS.includes(key) || animal !== undefined),
  );
}

type Analysis = { fields: ContractFields; text: string } | { error: string };

/** Lexer (DFAs) + PDA over one fragment. Skipped words or doubtful spellings count as errors. */
function analyze(fragment: string, key: string): Analysis {
  const { lex, suggestions } = correctTranscription(fragment);
  const [doubt] = suggestions;
  if (doubt) {
    const options = doubt.candidates.map(({ value }) => value).join(" o ");
    return { error: `«${doubt.original}» puede ser ${options}. Escriba la palabra que corresponde.` };
  }
  const parse = parseContract(lex.tokens);
  if (!parse.ok && parse.issues[0]) return { error: parse.issues[0] };
  if (lex.errors.length > 0 || !parse.ok) {
    return { error: `No se reconoció ${fieldQuestion(key)}.` };
  }
  const [invalid] = validateFields(parse.fields);
  if (invalid) return { error: invalid };
  if (missingFields(parse.fields, [key]).length > 0) return { error: `No se reconoció ${fieldQuestion(key)}.` };
  if (outOfScope(parse.fields, key).length > 0) {
    return { error: `Escriba solo ${fieldQuestion(key)}; los demás datos van en su propio cuadro.` };
  }
  if (parse.issues[0]) return { error: parse.issues[0] };
  if (parse.warnings.length > 0) return { error: `No se reconoció ${fieldQuestion(key)}.` };
  // The uncorrected fragment is kept so the final pipeline run reports its corrections ("perros" → "cerdos").
  return { fields: parse.fields, text: fragment };
}

/** First candidate the grammar accepts; otherwise the most specific error. */
function firstAccepted(candidates: string[], key: string): Analysis {
  let result: Analysis = { error: `No se reconoció ${fieldQuestion(key)}.` };
  for (const candidate of candidates) {
    const attempt = analyze(candidate, key);
    if ("fields" in attempt) return attempt;
    if (!attempt.error.startsWith("No se reconoció")) result = attempt;
  }
  return result;
}

/** Builds one dictation from the boxes. A box is accepted only if its clause passes the lexer and the PDA. */
// Materia: cada casilla se convierte en una cláusula de la gramática y pasa por los AFD y el AP.
// La respuesta final vuelve a recorrer el pipeline completo, igual que una respuesta dictada.
export function composeFieldAnswers(answers: FieldAnswers, fields: ContractFields): ComposedAnswer {
  const filled = new Map(
    Object.entries(answers).flatMap(([key, value]) => (value?.trim() ? [[key, value.trim()] as const] : [])),
  );
  const fragments = new Map<string, string>();
  const errors: Record<string, string> = {};
  const accept = (key: string, result: Analysis): ContractFields | undefined => {
    if ("error" in result) {
      errors[key] = result.error;
      return undefined;
    }
    fragments.set(key, result.text);
    return result.fields;
  };

  let lote = fields.lote;
  for (const [key, text] of filled) {
    const candidates = CANDIDATES[key];
    const parsed = candidates ? accept(key, firstAccepted(candidates(text), key)) : undefined;
    if (key === "lote" && parsed?.lote) lote = parsed.lote;
  }

  // AREAOPT only exists inside LOTE, so the area is dictated together with the lot identifier.
  const area = filled.get("hectareas");
  if (area && !lote) errors.hectareas = "Indique primero el lote.";
  else if (area && lote) {
    const candidates = [area, `lote ${lote} de ${area}`, `lote ${lote} de ${area} hectáreas`];
    if (accept("hectareas", firstAccepted(candidates, "hectareas"))) fragments.delete("lote");
  }

  if (ANIMAL_KEYS.some((key) => filled.has(key))) composeAnimals(filled, fields, fragments, errors);

  const text = ORDER.flatMap((key) => fragments.get(key) ?? []).join(", ");
  return { text, errors };
}

function composeAnimals(
  filled: Map<string, string>,
  fields: ContractFields,
  fragments: Map<string, string>,
  errors: Record<string, string>,
): void {
  const typed = filled.get("tipo_animal");
  const count = filled.get("cantidad_animales");
  const breed = filled.get("raza");
  let base = singleAnimal(fields) ?? undefined;

  if (typed) {
    const result = firstAccepted([typed, `para ${typed}`], "tipo_animal");
    if ("error" in result) {
      errors.tipo_animal = result.error;
      return;
    }
    const animals = result.fields.animales ?? [];
    const [first] = animals;
    if (animals.length !== 1 || !first || first.sub?.length) {
      if (count || breed) {
        const message = "Con varios animales, escriba la cantidad y la raza en «Tipo de animal».";
        if (count) errors.cantidad_animales = message;
        if (breed) errors.raza = message;
        return;
      }
      fragments.set("tipo_animal", result.text);
      return;
    }
    base = first;
  }
  if (!base) {
    const message = "Indique primero el tipo de animal.";
    if (count) errors.cantidad_animales = message;
    if (breed) errors.raza = message;
    return;
  }
  // The count box accepts digits or number words: the lexer decides, not a JS pattern.
  const amount = count ?? (base.cantidad === undefined ? "" : String(base.cantidad));
  if (count) {
    const counted = analyze(`${count} ${base.animal}`, "cantidad_animales");
    if ("error" in counted || counted.fields.animales?.length !== 1) {
      errors.cantidad_animales = "Escriba solo la cantidad de animales, por ejemplo 20.";
      return;
    }
  }
  const race = breed ?? base.raza;
  const phrase = [amount, base.animal, race && `de raza ${race}`].filter(Boolean).join(" ");
  const key = breed ? "raza" : count ? "cantidad_animales" : "tipo_animal";
  const result = analyze(phrase, key);
  if ("error" in result) errors[key] = result.error;
  else fragments.set("tipo_animal", result.text);
}
