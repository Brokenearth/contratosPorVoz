import { useEffect, useRef, useState } from "react";
import { speechInput, type InputSource } from "./voice";

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  source?: InputSource;
}

function join(base: string, extra: string): string {
  return [base.trim(), extra.trim()].filter(Boolean).join(" ");
}

/** Editable textarea with a microphone button: recognized text lands in the box and can be corrected (§9). */
export function DictationField({ id, label, value, onChange, placeholder, rows = 4, source = speechInput }: Props) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const stopRef = useRef<(() => void) | null>(null);
  const baseRef = useRef("");

  useEffect(() => () => stopRef.current?.(), []);

  function toggle() {
    if (listening) {
      stopRef.current?.();
      return;
    }
    setError("");
    baseRef.current = value;
    setListening(true);
    stopRef.current = source.start({
      onInterim: (text) => onChange(join(baseRef.current, text)),
      onFinal: (text) => {
        baseRef.current = join(baseRef.current, text);
        onChange(baseRef.current);
      },
      onError: setError,
      onEnd: () => {
        setListening(false);
        stopRef.current = null;
      },
    });
  }

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="flex gap-2">
        <textarea
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm shadow-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/40 focus:outline-none dark:border-slate-600 dark:bg-slate-900"
        />
        {source.supported && (
          <button
            type="button"
            onClick={toggle}
            aria-pressed={listening}
            aria-label={listening ? "Detener dictado" : "Dictar por voz"}
            title={listening ? "Detener dictado" : "Dictar por voz"}
            className={`h-12 w-12 shrink-0 rounded-full text-xl shadow transition ${
              listening ? "animate-pulse bg-red-600 text-white" : "bg-emerald-600 text-white hover:bg-emerald-700"
            }`}
          >
            {listening ? "■" : "🎤"}
          </button>
        )}
      </div>
      {listening && (
        <p role="status" className="text-sm text-red-600 dark:text-red-400">
          Escuchando… hable ahora. El texto reconocido aparece arriba y puede corregirlo.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
