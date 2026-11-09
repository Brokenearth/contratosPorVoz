import { useState } from "react";
import type { TemplateDef } from "../core/types";
import { Icon } from "./Icon";
import { Markdown, headingId, parseBlocks } from "./Markdown";
import { Panel } from "./Panel";

interface Props {
  markdown: string;
  template: TemplateDef;
}
export const contractFileName = (template: TemplateDef) => `contrato-${template.id.toLowerCase()}.md`;
function download(markdown: string, name: string) {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ContractPanel({ markdown, template }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const pending = (markdown.match(/\{\{[^}]+\}\}/g) ?? []).length;
  const sections = parseBlocks(markdown).filter((b) => b.kind === "heading" && b.level === 2);
  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setCopyError(false);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <Panel
      title="Contrato generado"
      id="contrato"
      actions={<span className="status-tag">{template.id.toLowerCase()}</span>}
    >
      <div className="document-actions">
        <button type="button" className="btn-primary" onClick={() => download(markdown, contractFileName(template))}>
          <Icon name="download" />
          Descargar .md
        </button>
        <button type="button" className="btn-secondary" onClick={() => void copy()}>
          <Icon name="copy" />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      {copyError && (
        <p role="alert" className="field-error">
          No se pudo copiar. Puede descargar el documento.
        </p>
      )}
      {pending > 0 && (
        <p className="pending-note">
          {pending} {pending === 1 ? "campo pendiente" : "campos pendientes"}. Revise los espacios resaltados en el
          documento.
        </p>
      )}
      <details className="contract-index">
        <summary>Orden del documento</summary>
        <nav aria-label="Secciones del contrato">
          <ol>
            {sections.map(
              (s) =>
                s.kind === "heading" && (
                  <li key={s.text}>
                    <a href={`#${headingId(s.text)}`}>{s.text}</a>
                  </li>
                ),
            )}
          </ol>
        </nav>
      </details>
      <article aria-label="Contrato" tabIndex={0} className="contract-paper">
        <Markdown source={markdown} />
      </article>
    </Panel>
  );
}
