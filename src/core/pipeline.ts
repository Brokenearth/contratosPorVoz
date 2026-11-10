import { mergeFields, missingFields, questionFor, validateFields } from "./dialog";
import { tokenize } from "./lexer";
import { suggestBreedCorrections, type TranscriptionSuggestion } from "./lexer/similarity";
import { parseContract, type ParseOutcome } from "./parser";
import { normalizePartyName, PARTY_ROLES } from "./partyNames";
import { contractValues, extractedFieldNames, getTemplate, TEMPLATES } from "./templates";
import { fillTemplate, selectTemplate } from "./turing";
import type { ContractFields, LexResult, PartyNames, SelectionResult, TemplateDef, TuringRun } from "./types";

export interface PipelineOptions {
  /** Generate the contract even if required fields are missing (they stay as `{{campo}}`). */
  force?: boolean;
  confirmedNames?: PartyNames;
}

export interface PipelineResult {
  lex: LexResult;
  parse: ParseOutcome;
  /** Fields of this utterance merged over `previousFields`. */
  fields: ContractFields;
  confirmedNames?: PartyNames;
  selection: SelectionResult;
  template: TemplateDef | null;
  /** Required fields of the selected template that are still missing. */
  missing: string[];
  /** Question for the user (§5.6); "" when nothing is missing. */
  question: string;
  /** Fill-machine run; null until the required fields are complete (or `force`). */
  contract: TuringRun | null;
  fill: TuringRun | null;
  blocked: boolean;
  suggestions: TranscriptionSuggestion[];
  /** Lexical and syntax errors, plus words skipped by the parser's error recovery, as readable messages. */
  errors: string[];
}

const NO_TEMPLATE_QUESTION =
  "No se reconoció el tipo de contrato. Mencione los animales o el cultivo, el lote, la fecha, el valor y el uso.";

/** Text → tokens → derivation (PDA) → fields → template (selection TM) → contract (fill TM). */
// Materia: punto de entrada de la exposición. Siga las llamadas en este orden:
// tokenize → parseContract → selectTemplate → fillTemplate.
// La voz ya se convirtió a texto antes de llegar aquí; no es parte del léxico.
export function runPipeline(
  text: string,
  previousFields: ContractFields = {},
  options: PipelineOptions = {},
): PipelineResult {
  const lex = tokenize(text);
  const parse = parseContract(lex.tokens);
  const canMerge = parse.ok && lex.errors.length === 0;
  const fields = mergeFields(previousFields, canMerge ? parse.fields : {});
  const partyWarnings: string[] = [];
  const confirmedNames = options.confirmedNames;
  for (const role of PARTY_ROLES) {
    if (!confirmedNames || !Object.hasOwn(confirmedNames, role)) continue;
    const confirmed = normalizePartyName(confirmedNames[role] ?? "");
    const detected = parse.fields[role];
    if (confirmed && detected && confirmed !== detected) {
      partyWarnings.push(`El dictado propone «${detected}» para ${role}. Se conservó «${confirmed}».`);
    }
    fields[role] = confirmed;
  }
  const selection = selectTemplate(extractedFieldNames(fields), TEMPLATES, { requireDomain: true });
  const template = selection.templateId === null ? null : getTemplate(selection.templateId);
  const missing = template ? missingFields(fields, template.required) : [];
  const missingQuestion = questionFor(missing);
  const failures = [
    ...lex.errors.map((error) => `${error.message} en la posición ${error.position}.`),
    ...parse.errors,
    ...validateFields(fields),
  ];
  const ready = template !== null && failures.length === 0 && (missing.length === 0 || options.force === true);
  const pending = missingQuestion.replace(/^Falta /, "");
  const fill = ready ? fillTemplate(template.body, contractValues(fields, pending)).run : null;
  if (fill && !fill.accepted) failures.push(`No se completó el llenado. ${fill.snapshots.at(-1)?.note ?? ""}`);
  const blocked = failures.length > 0;
  const contract = fill?.accepted ? fill : null;
  const question = failures[0] ?? (template ? missingQuestion : NO_TEMPLATE_QUESTION);
  const errors = [...failures, ...parse.warnings, ...partyWarnings];
  const suggestions = parse.ok ? [] : suggestBreedCorrections(lex.tokens);
  return { lex, parse, fields, confirmedNames, selection, template, missing, question, contract, fill, blocked, errors, suggestions };
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
