import { mergeFields, missingFields, questionFor } from "./dialog";
import { tokenize } from "./lexer";
import { parseContract, type ParseOutcome } from "./parser";
import { contractValues, extractedFieldNames, getTemplate, TEMPLATES } from "./templates";
import { fillTemplate, selectTemplate } from "./turing";
import type { ContractFields, LexResult, SelectionResult, TemplateDef, TuringRun } from "./types";

export interface PipelineOptions {
  /** Generate the contract even if required fields are missing (they stay as `{{campo}}`). */
  force?: boolean;
}

export interface PipelineResult {
  lex: LexResult;
  parse: ParseOutcome;
  /** Fields of this utterance merged over `previousFields`. */
  fields: ContractFields;
  selection: SelectionResult;
  template: TemplateDef | null;
  /** Required fields of the selected template that are still missing. */
  missing: string[];
  /** Question for the user (§5.6); "" when nothing is missing. */
  question: string;
  /** Fill-machine run; null until the required fields are complete (or `force`). */
  contract: TuringRun | null;
  /** Lexical and syntax errors as readable messages. */
  errors: string[];
}

const NO_TEMPLATE_QUESTION =
  "No se reconoció el tipo de contrato. Mencione los animales o el cultivo, el lote, la fecha, el valor y el uso.";

/** Text → tokens → derivation (PDA) → fields → template (selection TM) → contract (fill TM). */
export function runPipeline(
  text: string,
  previousFields: ContractFields = {},
  options: PipelineOptions = {},
): PipelineResult {
  const lex = tokenize(text);
  const parse = parseContract(lex.tokens);
  const fields = mergeFields(previousFields, parse.fields);
  const selection = selectTemplate(extractedFieldNames(fields), TEMPLATES);
  const template = selection.templateId === null ? null : getTemplate(selection.templateId);
  const missing = template ? missingFields(fields, template.required) : [];
  const question = template ? questionFor(missing) : NO_TEMPLATE_QUESTION;
  const ready = template !== null && (missing.length === 0 || options.force === true);
  const contract = ready ? fillTemplate(template.body, contractValues(fields)).run : null;
  const errors = [...lex.errors.map((e) => `${e.message} en la posición ${e.position}.`), ...parse.errors];
  return { lex, parse, fields, selection, template, missing, question, contract, errors };
}

/** Example dictations for the UI, covering the three templates. */
export const DEMO_PHRASES: readonly string[] = [
  "arriendo lote La Esperanza de 5 hectáreas para 20 vacas de raza holstein para producción de leche por 12 meses desde el 15 de noviembre de 2026 por un valor de 6 millones de pesos",
  "los 20 toros gir se arriendan en el lote 20 de 8 hectáreas por 30 días desde el 1 de diciembre para ceba por un valor de 900 mil pesos",
  "20 vacas de raza holstein de los cuales 5 terneras fin y 3 caballos criollo en el lote 7 de 10 hectáreas para ganadería de leche desde el 2 de enero de 2027 por 6 meses por un valor de 4 millones de pesos",
  "arriendo el lote El Porvenir de 3 hectáreas para cultivo de maíz desde el 1 de diciembre de 2026 por un valor de 2 millones de pesos, los insumos los aporta el arrendatario por 6 meses",
  "arriendo el lote 12 de 4 hectáreas para cultivo de café por 2 años desde el 10 de enero de 2027 por un valor de 5 millones de pesos, el arrendador aporta los insumos, arrendador Juan Pérez y arrendatario Ana Gómez",
  "arriendo el lote 4 de 10 hectáreas para 15 vacas de raza gir para ganadería de leche y para cultivo de maíz por 1 año desde el 1 de marzo de 2027 por un valor de 8 millones de pesos, los insumos los aporta el arrendador",
];
