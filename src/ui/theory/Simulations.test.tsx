import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEMO_PHRASES, runPipeline } from "../../core/pipeline";
import { contractValues } from "../../core/templates";
import { fillMachine } from "../../core/turing/fill";
import { LexerAutomata } from "./LexerAutomata";
import { StackViewer } from "./StackViewer";
import { TheoryTabs } from "./TheoryTabs";
import { TuringViewer } from "./TuringViewer";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const result = runPipeline(DEMO_PHRASES[2]!);

describe("interactive computation models", () => {
  it("steps through the actual DFA and explains a rejected character", async () => {
    const user = userEvent.setup();
    render(<LexerAutomata />);
    await user.clear(screen.getByLabelText("Cadena de prueba"));
    await user.type(screen.getByLabelText("Cadena de prueba"), "2x");
    await user.click(screen.getByRole("button", { name: "Paso" }));
    expect(screen.getByRole("status")).toHaveTextContent("Se leyó «2»: D0 → D3");
    await user.click(screen.getByRole("button", { name: "Paso" }));
    expect(screen.getByRole("status")).toHaveTextContent("No existe una transición para «x» desde D3");
    expect(screen.getByText("Cadena rechazada")).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("img", { name: "Grafo completo del AFD" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(screen.getByRole("status")).toHaveTextContent("El recorrido comienza en D0");
  });
  it("draws nested SUB markers, removes them on fin and empties the grammar stack at acceptance", () => {
    render(<StackViewer result={result} />);
    const nested = result.parse.trace.findIndex(
      (s) => s.action.includes("apila SUB") && !s.action.includes("desapila"),
    );
    fireEvent.change(screen.getByRole("slider"), { target: { value: nested } });
    expect(
      within(screen.getByRole("list", { name: "Pila de anidamiento" }))
        .getAllByRole("listitem")
        .map((s) => s.textContent),
    ).toEqual(["SUB", "Z0"]);
    const closed = result.parse.trace.findIndex((s) => s.action.includes("desapila SUB"));
    fireEvent.change(screen.getByRole("slider"), { target: { value: closed } });
    expect(screen.getByRole("list", { name: "Pila de anidamiento" })).not.toHaveTextContent("SUB");
    fireEvent.change(screen.getByRole("slider"), { target: { value: result.parse.trace.length - 1 } });
    expect(screen.getByText("Entrada aceptada")).toBeInTheDocument();
    expect(screen.getByText("Pila vacía")).toBeInTheDocument();
  });
  it("keeps the Turing head, state and next transition synchronized with recorded snapshots", async () => {
    const user = userEvent.setup();
    const run = result.contract!;
    render(
      <TuringViewer
        run={run}
        label="Máquina de Turing de llenado"
        machine={fillMachine(contractValues(result.fields))}
      />,
    );
    expect(screen.getByTestId("mt-estado")).toHaveTextContent("q_buscar");
    await user.click(screen.getByRole("button", { name: "Paso" }));
    const snapshot = run.snapshots[1]!;
    expect(screen.getByTestId("mt-estado")).toHaveTextContent(snapshot.state);
    expect(screen.getByTestId("tape-head")).toHaveTextContent(snapshot.tape[snapshot.head]!);
    expect(screen.getByText(new RegExp(`transición ${snapshot.step} de`))).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Grafo de la máquina de Turing" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("slider"), { target: { value: run.snapshots.length - 1 } });
    expect(screen.getByText("Ejecución aceptada")).toBeInTheDocument();
    expect(screen.getByLabelText("Próxima transición")).toHaveTextContent("Estado de aceptación");
  });
  it("plays automatically, pauses at the end and can return to the start", () => {
    vi.useFakeTimers();
    render(<StackViewer result={result} />);
    fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole("slider")).toHaveValue("1");
    fireEvent.click(screen.getByRole("button", { name: "Pausa" }));
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.getByRole("slider")).toHaveValue("1");
    fireEvent.change(screen.getByRole("slider"), { target: { value: result.parse.trace.length - 2 } });
    fireEvent.click(screen.getByRole("button", { name: "Reproducir" }));
    act(() => vi.advanceTimersByTime(650));
    expect(screen.getByRole("button", { name: "Reproducir" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Reiniciar" }));
    expect(screen.getByRole("slider")).toHaveValue("0");
  });
  it("supports keyboard tab navigation and identifies analysis of an answer", async () => {
    const user = userEvent.setup();
    render(<TheoryTabs result={result} runId={2} input="desde el 1 de diciembre" isAnswer />);
    screen.getByRole("tab", { name: "Tokens" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Autómata del léxico" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{End}");
    expect(screen.getByRole("tabpanel")).toHaveAccessibleName("Máquina de Turing");
    expect(screen.getByText(/Última respuesta analizada/)).toBeInTheDocument();
  });
});
