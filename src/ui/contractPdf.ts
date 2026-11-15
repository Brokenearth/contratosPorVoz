import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import { parseBlocks } from "./Markdown";

/** `**bold**` and pending `{{campo}}` markers as pdfmake text runs. */
function inline(text: string): Content[] {
  return text
    .split(/(\*\*[^*]+\*\*|\{\{[^}]+\}\})/g)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("**")) return { text: part.slice(2, -2), bold: true };
      if (part.startsWith("{{")) return { text: part, background: "#fde68a" };
      return { text: part };
    });
}

/** The Markdown subset of the templates (headings, quote, list, paragraphs, signature table) as a PDF. */
export function contractPdfDefinition(markdown: string, title: string): TDocumentDefinitions {
  const content: Content[] = parseBlocks(markdown).map((block): Content => {
    switch (block.kind) {
      case "heading":
        return { text: inline(block.text), style: block.level === 1 ? "title" : "section" };
      case "quote":
        return {
          table: { widths: ["*"], body: [[{ text: inline(block.text), margin: [6, 4, 6, 4] }]] },
          layout: "noBorders",
          fillColor: "#fef3c7",
          margin: [0, 0, 0, 10],
        };
      case "list":
        return { ul: block.items.map((item) => ({ text: inline(item) })), margin: [0, 0, 0, 8] };
      case "table": {
        const columns = Math.max(...block.rows.map((row) => row.length));
        return {
          table: {
            widths: Array.from({ length: columns }, () => "*"),
            body: block.rows.map((row, index) =>
              Array.from({ length: columns }, (_, k) => ({
                text: inline(row[k] ?? ""),
                alignment: "center" as const,
                bold: index === 0,
                margin: [0, index === 0 ? 0 : 14, 0, 0],
              })),
            ),
          },
          layout: "noBorders",
          margin: [0, 18, 0, 0],
          unbreakable: true,
        };
      }
      default:
        return { text: inline(block.text), style: "paragraph" };
    }
  });

  return {
    info: { title, subject: "Contrato de arrendamiento rural" },
    pageSize: "LETTER",
    pageMargins: [64, 64, 64, 64],
    content,
    footer: (page, pages) => ({
      text: `Página ${page} de ${pages}`,
      alignment: "center",
      fontSize: 8,
      color: "#6b7280",
      margin: [0, 24, 0, 0],
    }),
    defaultStyle: { font: "Roboto", fontSize: 10.5, lineHeight: 1.25 },
    styles: {
      title: { fontSize: 15, bold: true, alignment: "center", margin: [0, 0, 0, 16] },
      section: { fontSize: 11.5, bold: true, margin: [0, 10, 0, 4] },
      paragraph: { alignment: "justify", margin: [0, 0, 0, 8] },
    },
  };
}

export const contractPdfName = (fileName: string) => fileName.replace(/\.md$/, ".pdf");

/** pdfmake and its fonts (≈2 MB) load only when the user asks for the PDF. */
export async function downloadContractPdf(markdown: string, title: string, fileName: string): Promise<void> {
  const [pdfModule, fontsModule] = await Promise.all([import("pdfmake/build/pdfmake"), import("pdfmake/build/vfs_fonts")]);
  const pdfMake = ("default" in pdfModule ? pdfModule.default : pdfModule) as typeof import("pdfmake");
  const vfs = ("default" in fontsModule ? fontsModule.default : fontsModule) as Parameters<typeof pdfMake.addVirtualFileSystem>[0];
  pdfMake.addVirtualFileSystem(vfs);
  await pdfMake.createPdf(contractPdfDefinition(markdown, title)).download(fileName);
}
