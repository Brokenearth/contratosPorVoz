import { useState } from "react";
import type { PipelineResult } from "../core/pipeline";
import type { PartyNames } from "../core/types";
import { DictationField } from "./DictationField";
import { Panel } from "./Panel";
import { PartyReview } from "./PartyReview";
import type { InputSource } from "./voice";

const LABELS: Record<string, string> = {
  lote: "Lote",
  hectareas: "Hectáreas",
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
  source?: InputSource;
}

export function Conversation({ result, onAnswer, onForce, onConfirmNames, source }: Props) {
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const { template, missing, question, contract, errors } = result;
  const complete = template !== null && missing.length === 0;

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
        </>
      ) : null}

      {errors.length > 0 && (
        <details className="mt-3 text-xs text-amber-800 dark:text-amber-300">
          <summary>{errors.length} aviso(s) del análisis</summary>
          <ul className="list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </details>
      )}

      <PartyReview names={result.fields} confirmed={result.confirmedNames !== undefined} onConfirm={onConfirmNames} />

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
            {template && !contract && (
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
