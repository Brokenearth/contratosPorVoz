import { useState } from "react";
import type { PipelineResult } from "../core/pipeline";
import { DictationField } from "./DictationField";
import { Panel } from "./Panel";
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
  source?: InputSource;
}

export function Conversation({ result, onAnswer, onForce, source }: Props) {
  const [answer, setAnswer] = useState("");
  const { template, missing, question, contract, errors } = result;
  const complete = template !== null && missing.length === 0;

  function submit() {
    if (!answer.trim()) return;
    onAnswer(answer);
    setAnswer("");
  }

  return (
    <Panel id="dialogo" title="Campos detectados">
      {template ? (
        <>
          <p className="mb-2 text-sm">
            Plantilla sugerida: <strong>{template.title}</strong>
          </p>
          <ul aria-label="Campos requeridos" className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
            {template.required.map((key) => {
              const ok = !missing.includes(key);
              return (
                <li key={key} className={ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
                  <span aria-hidden="true">{ok ? "✔" : "✘"}</span> {LABELS[key] ?? key}
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

      {complete ? (
        <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">
          Todos los campos requeridos están completos. El contrato ya está generado en el panel «Contrato generado».
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          <p role="status" className="rounded-lg bg-amber-50 p-3 text-sm font-medium text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
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
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={submit} disabled={!answer.trim()}>
              Responder
            </button>
            {template && !contract && (
              <button type="button" className="btn-secondary" onClick={onForce}>
                Generar de todos modos
              </button>
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
