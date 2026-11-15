// Runs scripts/generate-docs.ts through Vite (it resolves the `?raw` template imports of the core)
// and writes the demo contracts and docs/automatas.md.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runnerImport } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { module } = await runnerImport(join(root, "scripts/generate-docs.ts"), { configFile: join(root, "config/vite.config.ts") });
const files = module.generateDocs();

for (const [path, content] of Object.entries(files)) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), content);
}
