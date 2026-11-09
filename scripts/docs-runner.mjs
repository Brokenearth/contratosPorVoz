// Runs scripts/generate-docs.ts through Vite (it resolves the `?raw` template imports of the core)
// and writes the demo contracts, docs/automatas.md and the generated blocks of docs/informe.md.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { module } = await runnerImport(join(root, "scripts/generate-docs.ts"), { configFile: join(root, "config/vite.config.ts") });
const { files, fragments } = module.generateDocs();

for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}

const reportPath = join(root, "docs/informe.md");
let report = readFileSync(reportPath, "utf8");
for (const [key, content] of Object.entries(fragments)) {
  const open = `<!-- gen:${key} -->`;
  const close = `<!-- /gen:${key} -->`;
  const start = report.indexOf(open);
  const end = report.indexOf(close);
  if (start === -1 || end === -1) throw new Error(`docs/informe.md no tiene el bloque ${key}`);
  report = `${report.slice(0, start + open.length)}\n${content}\n${report.slice(end)}`;
}
writeFileSync(reportPath, report);
