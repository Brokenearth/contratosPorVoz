import { describe, expect, it } from "vitest";
import type { ParseTree } from "../../../../src/core/types";
import { formatGrammar, grammar, parseContract, parseFrom } from "../../../../src/core/parser/index";
import { tokens } from "../../../helpers/tokens";

function shape(tree: ParseTree): string {
  if (tree.children.length === 0) return tree.token ? `${tree.symbol}:${tree.token.lexeme}` : tree.symbol;
  return `${tree.symbol}(${tree.children.map(shape).join(" ")})`;
}

/** Collapses the nesting-marker stack trace into its distinct consecutive states. */
function markerHistory(steps: { stack: string[] }[]): string[] {
  const history: string[] = [];
  for (const step of steps) {
    const view = step.stack.join(" ");
    if (history[history.length - 1] !== view) history.push(view);
  }
  return history;
}

describe("grammar", () => {
  it("declares every required nonterminal and prints in course notation", () => {
    for (const nt of ["CONTRATO", "CLAUSULA", "ANIMALES", "LISTA", "RESTO", "ITEM", "RAZAOPT", "SUBOPT",
      "LOTE", "VALOR", "FECHA", "DURACION", "USO", "CULTIVO", "INSUMOS", "PARTES", "VERBO"]) {
      expect(grammar.nonterminals).toContain(nt);
    }
    const text = formatGrammar(grammar);
    expect(text).toContain("CONTRATO → CLAUSULA CONTRATO | λ");
    expect(text).toContain('SUBOPT → "de" "los" "cuales" LISTA "fin" | λ');
    expect(text).toContain('RESTO → "," ITEM RESTO | "y" ITEM | λ');
  });
});

describe("§5.5 clause order flexibility", () => {
  const phrases = [
    "arriendo el lote 20 para 20 toros gir por 30 días",
    "los 20 toros gir se arriendan en el lote 20 por 30 días",
    "por 30 días , lote 20 , 20 toros gir",
  ];

  it("gives identical fields for the three sentences", () => {
    const expected = {
      lote: "20",
      animales: [{ cantidad: 20, animal: "toros", raza: "gir" }],
      duracion: { cantidad: 30, unidad: "días" },
    };
    for (const phrase of phrases) {
      const result = parseContract(tokens(phrase));
      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
      expect(result.fields).toEqual(expected);
    }
  });

  it("uses lookahead to tell 'por un valor de' from 'por NUM UNIDAD'", () => {
    const result = parseContract(tokens("por un valor de 2 millones de pesos por 6 meses"));
    expect(result.fields.valor).toEqual({ monto: 2_000_000, moneda: "pesos" });
    expect(result.fields.duracion).toEqual({ cantidad: 6, unidad: "meses" });
  });
});

describe("§5.2 nested animals and the pushdown stack", () => {
  it("pushes SUB on 'de los cuales' and pops it on 'fin'", () => {
    const result = parseContract(tokens("20 vacas de raza holstein de los cuales 5 terneras fin y 3 caballos"));
    expect(result.ok).toBe(true);
    expect(markerHistory(result.trace)).toEqual(["Z0", "Z0 SUB", "Z0"]);
    expect(result.trace.some((s) => s.action.includes("apila SUB"))).toBe(true);
    expect(result.trace[result.trace.length - 1]?.action).toBe("ACEPTA");
    expect(result.fields.animales).toEqual([
      { cantidad: 20, animal: "vacas", raza: "holstein", sub: [{ cantidad: 5, animal: "terneras" }] },
      { cantidad: 3, animal: "caballos" },
    ]);
  });

  it("records the grammar-symbol stack in each step", () => {
    const result = parseContract(tokens("20 vacas"));
    expect(result.trace[0]?.symbols).toEqual(["CONTRATO"]);
  });

  it("builds the AST of '20 vacas y 3 caballos'", () => {
    const result = parseFrom("LISTA", tokens("20 vacas y 3 caballos"));
    expect(result.ok).toBe(true);
    expect(result.tree && shape(result.tree)).toBe(
      'LISTA(ITEM(num:20 animal:vacas RAZAOPT(λ) SUBOPT(λ)) RESTO("y":y ITEM(num:3 animal:caballos RAZAOPT(λ) SUBOPT(λ))))',
    );
  });
});

describe("§6 example", () => {
  it("extracts lote name, hectares, animals, use and duration", () => {
    const result = parseContract(tokens(
      "arriendo lote La Esperanza de 5 hectáreas para 20 vacas de raza holstein para producción de leche por 12 meses",
    ));
    expect(result.errors).toEqual([]);
    expect(result.fields).toEqual({
      lote: "La Esperanza",
      hectareas: 5,
      animales: [{ cantidad: 20, animal: "vacas", raza: "holstein" }],
      uso: "producción de leche",
      duracion: { cantidad: 12, unidad: "meses" },
    });
  });
});

describe("other clauses", () => {
  it("parses dates with and without year", () => {
    expect(parseContract(tokens("desde el 15 de noviembre de 2026")).fields.fecha).toEqual({ dia: 15, mes: 11, anio: 2026 });
    expect(parseContract(tokens("el 3 de enero")).fields.fecha).toEqual({ dia: 3, mes: 1 });
  });

  it("parses crops, inputs and parties", () => {
    const result = parseContract(tokens(
      "para cultivo de maíz , el arrendatario aporta los insumos , arrendador Juan Pérez y arrendatario Ana Gómez",
    ));
    expect(result.errors).toEqual([]);
    expect(result.fields).toEqual({
      uso: "cultivo", cultivo: "maíz", insumos: "arrendatario", arrendador: "Juan Pérez", arrendatario: "Ana Gómez",
    });
  });

  it("parses 'los insumos los aporta el arrendador' and 'valor 500000 pesos'", () => {
    const result = parseContract(tokens("los insumos los aporta el arrendador valor 500000 pesos"));
    expect(result.fields).toEqual({ insumos: "arrendador", valor: { monto: 500000, moneda: "pesos" } });
  });

  it("accepts the empty input (CONTRATO → λ)", () => {
    expect(parseContract([]).ok).toBe(true);
  });
});

describe("errors", () => {
  it("rejects 'fin' without 'de los cuales'", () => {
    const result = parseContract(tokens("20 vacas fin"));
    expect(result.ok).toBe(false);
    expect(result.tree).toBeNull();
    expect(result.errors[0]).toContain("'fin' sin 'de los cuales'");
    expect(result.trace[result.trace.length - 1]?.action).toContain("RECHAZA");
  });

  it("rejects a missing 'fin'", () => {
    const result = parseContract(tokens("20 vacas de los cuales 5 terneras"));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("falta 'fin'");
  });

  it("reports the unexpected token and its position", () => {
    const result = parseContract(tokens("lote vacas"));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toBe("Token inesperado 'vacas' en la posición 5.");
  });

  it("reports an incomplete clause at the end of the input", () => {
    const result = parseContract(tokens("por 30"));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("fin de la frase");
  });
});
