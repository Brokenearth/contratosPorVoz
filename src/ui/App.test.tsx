import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App";
import type { InputSource, ListenHandlers } from "./voice";

afterEach(cleanup);

const contract = () => screen.getByRole("article", { name: "Contrato" });

describe("App", () => {
  it("shows the title, disclaimer and guide", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "Contratos rurales por voz" })).toBeInTheDocument();
    expect(screen.getByText(/Borrador informativo; no reemplaza la asesoría de un abogado/)).toBeInTheDocument();
    expect(screen.getByLabelText("Guía")).toHaveTextContent("Para redactar su contrato, mencione:");
    expect(screen.getByRole("button", { name: "Analizar" })).toBeDisabled();
  });

  it("demo phrase → analyze → contract and theory panels", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Pastoreo (leche)" }));
    expect((screen.getByLabelText("Texto del contrato") as HTMLTextAreaElement).value).toContain("La Esperanza");
    await user.click(screen.getByRole("button", { name: "Analizar" }));

    expect(screen.getByText(/Todos los campos requeridos están completos/)).toBeInTheDocument();
    expect(contract()).toHaveTextContent("CLÁUSULA SEGUNDA. El ARRENDATARIO podrá mantener en el lote La Esperanza");
    expect(screen.getByRole("button", { name: "Descargar .md" })).toBeInTheDocument();

    const tokens = screen.getByRole("tabpanel");
    expect(within(tokens).getAllByText("ANIMAL").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: "Pila" }));
    expect(within(screen.getByRole("tabpanel")).getAllByText("Z0").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("tab", { name: "Árbol de derivación" }));
    expect(screen.getByRole("list", { name: "Árbol de derivación" })).toHaveTextContent("CONTRATO");
    await user.click(screen.getByRole("tab", { name: "Selección" }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("PASTOREO ✔");
    await user.click(screen.getByRole("tab", { name: "Autómata del léxico" }));
    expect(screen.getByText(/AFD \(construcción de subconjuntos\)/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Máquina de Turing" }));
    expect(screen.getByTestId("mt-estado")).toHaveTextContent("q_buscar");
    await user.click(screen.getByRole("button", { name: "Paso" }));
    expect(screen.getByText(/Instantánea 2 de/)).toBeInTheDocument();
  });

  it("asks for missing fields and merges the answer", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(
      screen.getByLabelText("Texto del contrato"),
      "arriendo el lote El Porvenir de 3 hectáreas para cultivo de maíz por 6 meses, los insumos los aporta el arrendatario",
    );
    await user.click(screen.getByRole("button", { name: "Analizar" }));
    expect(screen.getByText("Falta la fecha y el valor del arrendamiento.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Campos requeridos" })).toHaveTextContent("✘ Fecha de inicio");
    expect(screen.queryByRole("article", { name: "Contrato" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Su respuesta"), "desde el 1 de diciembre de 2026 por un valor de 2 millones de pesos");
    await user.click(screen.getByRole("button", { name: "Responder" }));
    expect(contract()).toHaveTextContent("maíz");
    expect(contract()).toHaveTextContent("$ 2.000.000 pesos");
    expect(contract()).not.toHaveTextContent("{{");
  });

  it("generates anyway with pending markers highlighted", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.type(screen.getByLabelText("Texto del contrato"), "arriendo lote La Esperanza para 20 vacas de raza holstein");
    await user.click(screen.getByRole("button", { name: "Analizar" }));
    await user.click(screen.getByRole("button", { name: "Generar de todos modos" }));
    expect(contract().querySelectorAll("mark[data-pending]").length).toBeGreaterThan(0);
    expect(contract()).toHaveTextContent("{{valor}}");
  });

  it("puts dictated text in the editable textarea", async () => {
    const user = userEvent.setup();
    let handlers: ListenHandlers | undefined;
    const source: InputSource = {
      supported: true,
      start: (h) => {
        handlers = h;
        return () => h.onEnd();
      },
    };
    render(<App source={source} />);
    await user.click(screen.getAllByRole("button", { name: "Dictar por voz" })[0]!);
    expect(screen.getByRole("status")).toHaveTextContent("Escuchando");
    const field = screen.getByLabelText("Texto del contrato");
    await act(() => handlers?.onInterim("arriendo el lote"));
    expect(field).toHaveValue("arriendo el lote");
    await act(() => {
      handlers?.onFinal("arriendo el lote 20");
      handlers?.onEnd();
    });
    expect(field).toHaveValue("arriendo el lote 20");
    await user.type(field, " de 8 hectáreas");
    expect(field).toHaveValue("arriendo el lote 20 de 8 hectáreas");
  });
});
