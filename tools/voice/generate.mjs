// Runs tools/voice/generate.mts with tsx (the generator shares voiceKey.ts with the game).
//   node tools/voice/generate.mjs [--dry-run] [--only-role=narrator] [--limit=5]
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const tsx = resolve(root, `apps/server/node_modules/.bin/tsx${process.platform === "win32" ? ".cmd" : ""}`);
const r = spawnSync(tsx, ["--tsconfig", resolve(root, "apps/web/tsconfig.json"), resolve(root, "tools/voice/generate.mts"), ...process.argv.slice(2)], { stdio: "inherit", shell: process.platform === "win32" });
process.exit(r.status ?? 1);
