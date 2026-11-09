import { useEffect, useId, useMemo, useRef } from "react";
import type { Automaton } from "../../core/regex";

/** A layered view of the actual states and transitions supplied by the engine. */
export function StateGraph({
  automaton,
  active,
  edge,
  label,
}: {
  automaton: Automaton;
  active?: string;
  edge?: [string, string];
  label: string;
}) {
  const viewport = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, "");
  const layout = useMemo(() => {
    const rank = new Map<string, number>([[automaton.initial, 0]]);
    const queue = [automaton.initial];
    for (let i = 0; i < queue.length; i++)
      for (const t of automaton.transitions) {
        if (t.from === queue[i] && !rank.has(t.to)) {
          rank.set(t.to, (rank.get(t.from) ?? 0) + 1);
          queue.push(t.to);
        }
      }
    for (const state of automaton.states) if (!rank.has(state)) rank.set(state, 0);
    const columns = new Map<number, string[]>();
    for (const s of automaton.states) {
      const r = rank.get(s) ?? 0;
      columns.set(r, [...(columns.get(r) ?? []), s]);
    }
    const long = automaton.states.some((s) => s.length > 5);
    const columnWidth = long ? 235 : 145;
    const height = Math.max(220, ...[...columns.values()].map((c) => c.length * 112 + 80));
    const positions = new Map<string, { x: number; y: number }>();
    for (const [col, states] of columns)
      states.forEach((s, i) =>
        positions.set(s, { x: 100 + col * columnWidth, y: (height - (states.length - 1) * 112) / 2 + i * 112 }),
      );
    const grouped = new Map<string, { from: string; to: string; symbols: string[] }>();
    for (const t of automaton.transitions) {
      const key = `${t.from}:${t.to}`;
      const entry = grouped.get(key) ?? { from: t.from, to: t.to, symbols: [] };
      if (!entry.symbols.includes(t.symbol)) entry.symbols.push(t.symbol);
      grouped.set(key, entry);
    }
    return {
      positions,
      edges: [...grouped.values()],
      width: Math.max(400, 200 + Math.max(...columns.keys()) * columnWidth),
      height,
      long,
    };
  }, [automaton]);
  useEffect(() => {
    const view = viewport.current;
    const point = active ? layout.positions.get(active) : undefined;
    if (view && point) {
      view.scrollTop = Math.max(0, point.y - view.clientHeight / 2);
      view.scrollLeft = Math.max(0, point.x - view.clientWidth / 2);
    }
  }, [active, layout]);
  const radius = layout.long ? 76 : 28;
  const shorten = (symbols: string[]) =>
    symbols.length === 10 && [...symbols].sort().join("") === "0123456789" ? "0–9" : symbols.join(", ");
  return (
    <figure className="state-graph">
      <div ref={viewport} className="graph-scroll" tabIndex={0} aria-label={`Desplazar ${label}`}>
        <svg
          role="img"
          aria-label={label}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          style={{ width: layout.width, height: layout.height }}
        >
          <title>{label}</title>
          <defs>
            <marker
              id={`${id}-arrow`}
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
            </marker>
          </defs>
          {layout.edges.map(({ from, to, symbols }) => {
            const a = layout.positions.get(from)!;
            const b = layout.positions.get(to)!;
            const self = from === to;
            const backwards = b.x <= a.x;
            const d = self
              ? `M ${a.x - 15} ${a.y - 27} C ${a.x - 60} ${a.y - 95}, ${a.x + 60} ${a.y - 95}, ${a.x + 15} ${a.y - 27}`
              : backwards
                ? `M ${a.x} ${a.y + 29} C ${a.x} ${a.y + 100}, ${b.x} ${b.y + 100}, ${b.x} ${b.y + 29}`
                : `M ${a.x + radius} ${a.y} C ${a.x + radius + 35} ${a.y}, ${b.x - radius - 35} ${b.y}, ${b.x - radius} ${b.y}`;
            const text = shorten(symbols);
            const lx = self ? a.x : (a.x + b.x) / 2;
            const ly = self ? a.y - 75 : backwards ? (a.y + b.y) / 2 + 74 : (a.y + b.y) / 2 - 12;
            return (
              <g
                key={`${from}-${to}`}
                className={edge?.[0] === from && edge?.[1] === to ? "graph-edge is-current" : "graph-edge"}
              >
                <title>
                  {from} → {to}: {text}
                </title>
                <path d={d} markerEnd={`url(#${id}-arrow)`} />
                <text x={lx} y={ly} textAnchor="middle">
                  {text.length > 22 ? `${text.slice(0, 20)}…` : text}
                </text>
              </g>
            );
          })}
          {automaton.states.map((state) => {
            const p = layout.positions.get(state)!;
            const accepting = automaton.accepting.includes(state);
            return (
              <g
                key={state}
                transform={`translate(${p.x},${p.y})`}
                className={`graph-node ${active === state ? "is-current" : ""}`}
              >
                <title>
                  {state}
                  {accepting ? ": aceptación" : ""}
                </title>
                {layout.long ? (
                  <>
                    <rect x={-radius} y={-28} width={radius * 2} height={56} rx={10} />
                    {accepting && <rect x={-radius + 5} y={-23} width={radius * 2 - 10} height={46} rx={7} />}
                  </>
                ) : (
                  <>
                    <circle r={28} />
                    {accepting && <circle r={22} />}
                  </>
                )}
                {state === automaton.initial && (
                  <path
                    className="initial-arrow"
                    d={`M ${-radius - 30} 0 H ${-radius - 3}`}
                    markerEnd={`url(#${id}-arrow)`}
                  />
                )}
                <text textAnchor="middle" dominantBaseline="middle">
                  {state}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption>
        <span className="legend-dot" />
        Estado actual <span className="legend-circle" />
        Aceptación <span className="legend-arrow">→</span>Inicio · Desplace el gráfico para explorar todos los estados.
      </figcaption>
    </figure>
  );
}
