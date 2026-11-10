import { useState } from "react";
import type { PipelineResult } from "../core/pipeline";
import type { PartyNames } from "../core/types";
import { DictationField } from "./DictationField";
import { Panel } from "./Panel";
import { PartyReview } from "./PartyReview";
import type { InputSource } from "./voice";

const LABELS: Record<string, string> = {
  lote: "Lote",
  hectareas: "Área del lote",
  tipo_animal: "Tipo de animal",
  cantidad_animales: "Cantidad de animales",
  raza: "Raza",
  fecha: "Fecha de inicio",
  uso: "Uso del lote",
  duracion: "Duración",
  valor: "Valor",
  cultivo: "Cultivo",
  insumos: "Quién aporta los insumos",
  arrendador: "Arrendador",
  arrendatario: "Arrendatario",
};

interface Props {
  result: PipelineResult;
  onAnswer: (answer: string) => void;
  onForce: () => void;
  onConfirmNames: (names: PartyNames) => void;
  originalInput?: string;
  onCorrect: (start: number, end: number, value: string) => void;
  source?: InputSource;
}

export function Conversation({ result, onAnswer, onForce, onConfirmNames, originalInput, onCorrect, source }: Props) {
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const { template, missing, question, contract, blocked, errors } = result;
  const complete = contract !== null && missing.length === 0;

  function submit() {
    if (!answer.trim()) return;
    onAnswer(answer);
    setAnswer("");
  }

  return (
    <Panel id="dialogo" title="Revise los datos">
      {template ? (
        <>
          <p className="review-template">
            Plantilla sugerida: <strong>{template.title}</strong>
          </p>
          <ul aria-label="Campos requeridos" className="review-fields">
            {template.required.map((key) => {
              const ok = !missing.includes(key);
              return (
                <li key={key} className={ok ? "field-detected" : "field-missing"}>
                  <span className={`field-state ${ok ? "is-complete" : "is-missing"}`}>
                    {ok ? "Detectado" : "Falta"}
                  </span>{" "}
                  {LABELS[key] ?? key}
                  <span className="sr-only">{ok ? " (detectado)" : " (falta)"}</span>
                </li>
              );
            })}
          </ul>
          <details className="mt-2 text-sm">
            <summary>Datos opcionales de esta plantilla</summary>
            <p>{template.optional.filter((key) => key !== "animales_descripcion").map((key) => LABELS[key] ?? key).join(", ")}.</p>
          </details>
        </>
      ) : null}

      {errors.length > 0 && (
        <details
          className="mt-3 text-xs text-amber-800 dark:text-amber-300"
          open={errors.some((error) => error.includes("Confirme el correcto en su casilla"))}
        >
          <summary>{errors.length} aviso(s) del análisis</summary>
          <ul className="list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      {originalInput && (
        <details className="mt-3">
          <summary>Transcripción original</summary>
          <p>{originalInput}</p>
        </details>
      )}
      {result.corrections.length > 0 && (
        <div className="pending-note">
          <p>Correcciones aplicadas al dictado</p>
          <ul className="list-disc pl-5">
            {result.corrections.map(({ original, value }, index) => (
              <li key={index}>«{original}» → «{value}»</li>
            ))}
          </ul>
        </div>
      )}
      {result.suggestions.map(({ original, start, end, candidates }) => (
        <div className="pending-note" key={start}>
          <p>Elija la palabra que quiso decir en lugar de «{original}».</p>
          {candidates.map(({ value }) => (
            <button className="btn-secondary" key={value} type="button" onClick={() => onCorrect(start, end, value)}>
              Confirmar {value.charAt(0).toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
      ))}
      <PartyReview names={result.fields} confirmed={result.confirmedNames} onConfirm={onConfirmNames} />

      {complete ? (
        <p role="status" className="completion-note">
          Todos los campos requeridos están completos. Revise el contrato generado y complete las firmas antes de
          descargarlo.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <p role="status" className="pending-note">
            {question}
          </p>
          <DictationField
            id="respuesta"
            label="Su respuesta"
            rows={2}
            value={answer}
            onChange={setAnswer}
            placeholder="Ej.: desde el 1 de diciembre de 2026 por un valor de 2 millones de pesos"
            source={source}
            onListeningChange={setListening}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={submit} disabled={!answer.trim() || listening}>
              Responder
            </button>
            {template && !contract && !blocked && (
              <button type="button" className="btn-secondary" onClick={onForce} disabled={listening}>
                Generar de todos modos
              </button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
