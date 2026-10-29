import type { ReactNode } from "react";

type Block =
  | { kind: "heading"; level: number; text: string }
  | { kind: "quote"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "table"; rows: string[][] }
  | { kind: "paragraph"; text: string };

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
const isSeparator = (line: string) => /^\|?[\s:|-]+\|?$/.test(line.trim()) && line.includes("-");

/** Splits the markdown subset used by the templates into blocks. */
export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const item = /^\s*(?:[-*]|\d+\.)\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (line.trim() === "") flush();
    else if (heading?.[1] && heading[2] !== undefined) {
      flush();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
    } else if (line.startsWith(">")) {
      flush();
      blocks.push({ kind: "quote", text: line.replace(/^>\s?/, "") });
    } else if (item?.[1] !== undefined) {
      flush();
      if (last?.kind === "list") last.items.push(item[1]);
      else blocks.push({ kind: "list", items: [item[1]] });
    } else if (line.trim().startsWith("|")) {
      flush();
      if (isSeparator(line)) continue;
      if (last?.kind === "table") last.rows.push(cells(line));
      else blocks.push({ kind: "table", rows: [cells(line)] });
    } else paragraph.push(line.trim());
  }
  flush();
  return blocks;
}

/** Bold text and highlighted pending `{{campo}}` markers. */
export function renderInline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\{\{[^}]+\}\})/g)
    .filter(Boolean)
    .map((part, i) => {
      if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("{{"))
        return (
          <mark
            key={i}
            data-pending
            title="Campo pendiente"
            className="rounded bg-amber-200 px-1 font-mono text-amber-900 dark:bg-amber-500/30 dark:text-amber-200"
          >
            {part}
          </mark>
        );
      return part;
    });
}

const HEADING_CLASS = ["text-xl font-bold mt-2", "text-lg font-semibold mt-4", "font-semibold mt-3"];

export function Markdown({ source }: { source: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      {parseBlocks(source).map((block, i) => {
        switch (block.kind) {
          case "heading": {
            const Tag = `h${Math.min(block.level + 2, 6)}` as "h3";
            return (
              <Tag key={i} className={HEADING_CLASS[Math.min(block.level, 3) - 1]}>
                {renderInline(block.text)}
              </Tag>
            );
          }
          case "quote":
            return (
              <blockquote key={i} className="border-l-4 border-amber-400 bg-amber-50 p-2 dark:bg-amber-500/10">
                {renderInline(block.text)}
              </blockquote>
            );
          case "list":
            return (
              <ul key={i} className="list-disc pl-6">
                {block.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          case "table":
            return (
              <table key={i} className="w-full text-center">
                <tbody>
                  {block.rows.map((row, j) => (
                    <tr key={j}>
                      {row.map((cell, k) => (
                        <td key={k} className="p-1">
                          {renderInline(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            );
          default:
            return <p key={i}>{renderInline(block.text)}</p>;
        }
      })}
    </div>
  );
}
