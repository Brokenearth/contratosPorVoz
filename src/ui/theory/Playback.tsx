import { useEffect, useState } from "react";

export function usePlayback(count: number, delay = 650) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = Math.max(0, count - 1);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(
      () =>
        setIndex((current) => {
          const next = Math.min(current + 1, last);
          if (next === last) setPlaying(false);
          return next;
        }),
      delay,
    );
    return () => clearInterval(timer);
  }, [playing, last, delay]);
  function seek(value: number) {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(value, last)));
  }
  return { index: Math.min(index, last), last, playing, seek, toggle: () => setPlaying((p) => !p) };
}

export function Playback({
  playback,
  label = "Paso del proceso",
}: {
  playback: ReturnType<typeof usePlayback>;
  label?: string;
}) {
  const { index, last, playing, seek, toggle } = playback;
  return (
    <div className="playback" role="group" aria-label="Controles de reproducción">
      <div className="playback-buttons">
        <button type="button" className="btn-secondary" onClick={() => seek(index - 1)} disabled={index === 0}>
          Anterior
        </button>
        <button type="button" className="btn-primary" onClick={toggle} disabled={index >= last && !playing}>
          {playing ? "Pausa" : "Reproducir"}
        </button>
        <button type="button" className="btn-secondary" onClick={() => seek(index + 1)} disabled={index >= last}>
          Paso
        </button>
        <button type="button" className="btn-text" onClick={() => seek(0)}>
          Reiniciar
        </button>
      </div>
      <div className="playback-range">
        <input
          type="range"
          min={0}
          max={last}
          value={index}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={label}
        />
        <span>
          {index + 1} / {last + 1}
        </span>
      </div>
    </div>
  );
}
