import { useState } from "react";
import type { TemplateDef } from "../core/types";
import { Markdown } from "./Markdown";
import { Panel } from "./Panel";

interface Props {
  markdown: string;
  template: TemplateDef;
}

export function contractFileName(template: TemplateDef): string {
  return `contrato-${template.id.toLowerCase()}.md`;
}

function download(markdown: string, fileName: string) {
  const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ContractPanel({ markdown, template }: Props) {
  const [copied, setCopied] = useState(false);
  const pending = (markdown.match(/\{\{[^}]+\}\}/g) ?? []).length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Panel
      title="Contrato generado"
      id="contrato"
      actions={
        <div className="flex gap-2">
          <button type="button" className="btn-primary" onClick={() => download(markdown, contractFileName(template))}>
            Descargar .md
          </button>
          <button type="button" className="btn-secondary" onClick={() => void copy()}>
            {copied ? "¡Copiado!" : "Copiar"}
          </button>
        </div>
      }
    >
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Plantilla: <strong>{template.title}</strong>
        {pending > 0 && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
            {pending} campo(s) pendiente(s) resaltado(s)
          </span>
        )}
      </p>
      <article aria-label="Contrato" className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
        <Markdown source={markdown} />
      </article>
    </Panel>
  );
}
