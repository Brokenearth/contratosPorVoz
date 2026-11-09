import { useMemo } from "react";
import type { Automaton } from "../../core/regex";
import type { TuringRun } from "../../core/types";
import { BLANK, stateFamily, type TuringMachine } from "../../core/turing/machine";
import { Playback, usePlayback } from "./Playback";
import { StateGraph } from "./StateGraph";

function show(cell: string) {
  return cell === " " ? "␣" : cell === "\n" ? "↵" : cell;
}
const DESCRIPTIONS: Record<string, string> = {
  q_buscar: "Recorre la plantilla hasta encontrar un campo o el final del documento.",
  q_leer: "Lee el nombre del campo que debe completar.",
  q_borrar: "Borra el marcador del campo y vuelve al inicio del espacio disponible.",
  q_escribir: "Escribe el valor detectado y continúa recorriendo la plantilla.",
  q_seccion: "Lee el nombre de una sección opcional y comprueba si tiene un valor.",
  q_saltar: "Elimina una sección opcional que no tiene datos.",
  q_cerrar: "Elimina los marcadores de cierre de una sección opcional.",
  q_inicio: "Busca el separador entre los datos detectados y los campos de las plantillas.",
  q_siguiente: "Busca el siguiente campo requerido de las plantillas.",
  q_volver: "Regresa al bloque de datos detectados para comparar un campo.",
  q_comparar: "Comprueba si el campo requerido aparece entre los datos detectados.",
  q_encontrado: "Marca como presente un campo requerido.",
  q_ausente: "Marca como ausente un campo requerido.",
  q_contar_ini: "Regresa al inicio de las plantillas para contar las coincidencias.",
  q_contar: "Recorre los campos marcados y cuenta las coincidencias de cada plantilla.",
  q_anotar: "Añade una marca al conteo de coincidencias al final de la cinta.",
  q_retorno: "Vuelve al último campo contado para continuar.",
  q_fin: "La ejecución terminó en un estado de aceptación.",
};

export function TuringViewer({ run, label, machine }: { run: TuringRun; label: string; machine: TuringMachine }) {
  const playback = usePlayback(run.snapshots.length);
  const graph = useMemo<Automaton>(() => {
    const states = [...new Set(run.snapshots.map((s) => stateFamily(s.state)))];
    const pairs = new Map<string, { from: string; to: string; symbol: string }>();
    run.snapshots.slice(1).forEach((s, i) => {
      const from = stateFamily(run.snapshots[i]!.state);
      const to = stateFamily(s.state);
      pairs.set(`${from}:${to}`, { from, to, symbol: "" });
    });
    return {
      states,
      initial: states[0] ?? "",
      accepting: states.filter((s) => machine.accept.includes(s)),
      alphabet: [],
      transitions: [...pairs.values()],
    };
  }, [run, machine.accept]);
  const snapshot = run.snapshots[playback.index];
  if (!snapshot) return <p>Sin pasos registrados.</p>;
  const family = stateFamily(snapshot.state);
  const from = Math.max(0, snapshot.head - 6);
  const cells = snapshot.tape.slice(from, snapshot.head + 7);
  const read = snapshot.tape[snapshot.head] ?? BLANK;
  const transition = machine.delta(snapshot.state, read);
  const previous = run.snapshots[Math.max(0, playback.index - 1)]!;
  const final = playback.index === playback.last;
  return (
    <div className="simulation" aria-label={label}>
      <div className="simulation-heading">
        <div>
          <p className="eyebrow">{label.toUpperCase()}</p>
          <h3>Leer, escribir y mover el cabezal</h3>
        </div>
        <span className={`status-tag ${final && !run.accepted ? "is-warning" : ""}`}>
          {final ? (run.accepted ? "Ejecución aceptada" : "Ejecución detenida") : "Ejecución en curso"}
        </span>
      </div>
      <p className="theory-description">
        La cinta guarda símbolos y datos. El estado decide qué leer, qué escribir y hacia dónde mover el cabezal. Las
        instantáneas muestran cambios de familia de estados; una instantánea puede abarcar varias transiciones.
      </p>
      <div className="machine-state">
        <span>Estado actual</span>
        <strong data-testid="mt-estado">{snapshot.state}</strong>
        <p>{DESCRIPTIONS[family] ?? snapshot.note}</p>
      </div>
      <div className="tape-label">
        <span className="eyebrow">CINTA DE TRABAJO</span>
        <span>Cabezal en el índice {snapshot.head}</span>
      </div>
      <div className="tape-scroll" role="group" aria-label="Cinta">
        <div className="tape-cells">
          {cells.map((cell, i) => (
            <div
              key={from + i}
              className={`tape-cell ${from + i === snapshot.head ? "is-head" : ""}`}
              aria-current={from + i === snapshot.head ? "true" : undefined}
              data-testid={from + i === snapshot.head ? "tape-head" : undefined}
            >
              <small>{from + i}</small>
              <span title={cell}>{show(cell)}</span>
              {from + i === snapshot.head && <b aria-hidden="true">↑</b>}
            </div>
          ))}
        </div>
      </div>
      <div className="transition-readout" aria-label="Próxima transición">
        {transition ? (
          <>
            <div>
              <span>Lee</span>
              <code>{show(read)}</code>
            </div>
            <div>
              <span>Escribe</span>
              <code>{show(transition.write)}</code>
            </div>
            <div>
              <span>Mueve</span>
              <strong>
                {transition.move === "R" ? "Derecha (R)" : transition.move === "L" ? "Izquierda (L)" : "Quieto (S)"}
              </strong>
            </div>
            <div>
              <span>Siguiente estado</span>
              <code>{transition.next}</code>
            </div>
          </>
        ) : (
          <p>
            {machine.accept.includes(snapshot.state)
              ? "Estado de aceptación: no hay una próxima transición."
              : "No hay una transición definida para este estado y símbolo."}
          </p>
        )}
      </div>
      <p className="simulation-note">
        Instantánea {playback.index + 1} de {run.snapshots.length} · transición {snapshot.step} de {run.steps}.
      </p>
      {snapshot.note && <p className="simulation-note">{snapshot.note}</p>}
      <Playback playback={playback} label="Instantánea" />
      <div className="graph-section-heading">
        <h4>Grafo de familias de estados visitadas</h4>
        <p>
          Los parámetros se agrupan: q_leer[raza] pertenece a q_leer. Las conexiones corresponden al recorrido
          registrado.
        </p>
      </div>
      <StateGraph
        automaton={graph}
        active={family}
        edge={playback.index > 0 ? [stateFamily(previous.state), family] : undefined}
        label="Grafo de la máquina de Turing"
      />
    </div>
  );
}
