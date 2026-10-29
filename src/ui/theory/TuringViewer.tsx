import { useEffect, useState } from "react";
import type { TuringRun } from "../../core/types";

const WINDOW = 12;

function show(cell: string): string {
  if (cell === " ") return "␣";
  if (cell === "\n") return "↵";
  return cell;
}

/** Tape cells around the head, state name and step/play/pause/reset controls over the run snapshots. */
export function TuringViewer({ run, label }: { run: TuringRun; label: string }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = run.snapshots.length - 1;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setIndex((i) => {
        if (i >= last) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 400);
    return () => clearInterval(timer);
  }, [playing, last]);

  const snapshot = run.snapshots[Math.min(index, last)];
  if (!snapshot) return <p className="text-sm">Sin pasos registrados.</p>;
  const from = Math.max(0, snapshot.head - WINDOW);
  const cells = snapshot.tape.slice(from, snapshot.head + WINDOW + 1);

  return (
    <div className="space-y-3" aria-label={label}>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          Estado: <strong data-testid="mt-estado" className="font-mono text-emerald-700 dark:text-emerald-400">{snapshot.state}</strong>
        </span>
        <span>
          Instantánea {index + 1} de {run.snapshots.length} · cabezal en {snapshot.head} · {run.steps} pasos en total ·{" "}
          {run.accepted ? "aceptada" : "no aceptada"}
        </span>
      </div>
      <div className="overflow-x-auto" role="group" aria-label="Cinta">
        <div className="flex font-mono text-sm">
          {cells.map((cell, i) => {
            const isHead = from + i === snapshot.head;
            return (
              <span
                key={from + i}
                aria-current={isHead ? "true" : undefined}
                className={`flex h-9 min-w-9 items-center justify-center border px-1 ${
                  isHead
                    ? "border-emerald-600 bg-emerald-600 font-bold text-white"
                    : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
                }`}
              >
                {show(cell)}
              </span>
            );
          })}
        </div>
      </div>
      {snapshot.note && <p className="text-xs text-slate-600 dark:text-slate-400">{snapshot.note}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" onClick={() => setIndex((i) => Math.min(i + 1, last))} disabled={index >= last}>
          Paso
        </button>
        <button type="button" className="btn-secondary" onClick={() => setPlaying((p) => !p)} disabled={index >= last && !playing}>
          {playing ? "Pausa" : "Reproducir"}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setPlaying(false);
            setIndex(0);
          }}
        >
          Reiniciar
        </button>
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-label="Instantánea"
          className="grow"
        />
      </div>
    </div>
  );
}
