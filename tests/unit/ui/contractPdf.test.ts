import { describe, expect, it } from "vitest";
import { runPipeline } from "../../../src/core/pipeline";
import { contractPdfDefinition, contractPdfName } from "../../../src/ui/contractPdf";

describe("contract PDF", () => {
  const result = runPipeline(
    "arriendo el lote 12 de 4 hectáreas para cultivo de café por 2 años desde el 10 de enero de 2027 por un valor de 5 millones de pesos, arrendador Juan Pérez y arrendatario Ana Gómez",
  );
  const markdown = result.contract?.output ?? "";
  const definition = contractPdfDefinition(markdown, result.template?.title ?? "");
  const text = JSON.stringify(definition.content);

  it("lays out the contract on letter pages with its title, clauses and signatures", () => {
    expect(definition.pageSize).toBe("LETTER");
    expect(definition.info?.title).toBe("Contrato de arrendamiento de lote para cultivo");
    const content = definition.content as { style?: string; table?: { body: { text: { text: string }[] }[][] } }[];
    expect(content[0]?.style).toBe("title");
    expect(content.filter((block) => block.style === "section").length).toBeGreaterThan(5);
    const signatures = content.at(-1)?.table?.body;
    expect(signatures?.[0]?.map((cell) => cell.text[0]?.text)).toEqual(["EL ARRENDADOR", "EL ARRENDATARIO"]);
    expect(signatures?.some((row) => row[0]?.text[0]?.text === "Juan Pérez")).toBe(true);
  });

  it("keeps the generated text and drops the Markdown syntax", () => {
    expect(text).toContain("$ 5.000.000 pesos");
    expect(text).toContain("café");
    expect(text).not.toContain("## ");
    expect(text).not.toContain("| ---");
  });

  it("names the file after the Markdown download", () => {
    expect(contractPdfName("contrato-cultivo.md")).toBe("contrato-cultivo.pdf");
  });
});
