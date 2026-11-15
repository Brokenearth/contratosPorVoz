import { useState } from "react";
import { composeFieldAnswers, SUPPLIERS } from "../core/fieldAnswers";
import type { ContractFields } from "../core/types";
import { FIELD_EXAMPLES, FIELD_LABELS } from "./fieldLabels";

interface Props {
  required: string[];
  optional: string[];
  fields: ContractFields;
  onSubmit: (dictation: string) => void;
  disabled?: boolean;
}

/** One box per missing field. Required ones block the contract; optional ones can stay empty. */
export function MissingFields({ required, optional, fields, onSubmit, disabled = false }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const filled = Object.values(answers).some((value) => value.trim());
  if (required.length === 0 && optional.length === 0) return null;

  function submit() {
    const composed = composeFieldAnswers(answers, fields);
    setErrors(composed.errors);
    if (Object.keys(composed.errors).length > 0 || !composed.text) return;
    onSubmit(composed.text);
  }

  function box(key: string, isRequired: boolean) {
    const id = `campo-${key}`;
    const error = errors[key];
    const label = FIELD_LABELS[key] ?? key;
    const update = (value: string) => {
      setAnswers({ ...answers, [key]: value });
      if (error) {
        setErrors((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
      }
    };
    return (
      <div className="missing-field" key={key}>
        <label htmlFor={id}>
          {label}
          <span className={`field-state ${isRequired ? "is-missing" : "is-optional"}`}>
            {isRequired ? "Obligatorio" : "Opcional"}
          </span>
        </label>
        {key === "insumos" ? (
          <select id={id} value={answers[key] ?? ""} onChange={(event) => update(event.target.value)} aria-invalid={!!error}>
            <option value="">Sin indicar</option>
            {SUPPLIERS.map((role) => (
              <option key={role} value={role}>
                El {role}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type="text"
            value={answers[key] ?? ""}
            placeholder={FIELD_EXAMPLES[key] ? `Ej.: ${FIELD_EXAMPLES[key]}` : undefined}
            onChange={(event) => update(event.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            aria-required={isRequired}
          />
        )}
        {error && (
          <p id={`${id}-error`} role="alert" className="field-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      className="missing-fields"
      aria-label="Datos por completar"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      {required.length > 0 && (
        <fieldset>
          <legend>Datos obligatorios que faltan</legend>
          <p>El contrato se genera cuando estén completos.</p>
          {required.map((key) => box(key, true))}
        </fieldset>
      )}
      {optional.length > 0 && (
        <fieldset>
          <legend>Datos opcionales</legend>
          <p>Si los deja vacíos, la cláusula correspondiente se omite del contrato.</p>
          {optional.map((key) => box(key, false))}
        </fieldset>
      )}
      <button type="submit" className="btn-primary" disabled={!filled || disabled}>
        {required.length > 0 ? "Completar datos" : "Agregar al contrato"}
      </button>
    </form>
  );
}
