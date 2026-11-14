// Builds the game for production and serves it, for playing and demos (far faster than `pnpm dev`).
// It builds into .next-prod, so it never overwrites the folder a running `next dev` serves from.
// Usage: pnpm play            (port 3005)
//        pnpm play -- 4000    (another port)
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const port = process.argv.find((a) => /^\d+$/.test(a)) ?? "3005";
const env = { ...process.env, NEXT_DIST_DIR: ".next-prod" };
const next = createRequire(import.meta.url).resolve("next/dist/bin/next");

const run = (args) => spawnSync(process.execPath, [next, ...args], { stdio: "inherit", env });

const build = run(["build"]);
if (build.status !== 0) process.exit(build.status ?? 1);
console.log(`\nPlaying at http://localhost:${port}\n`);
process.exit(run(["start", "-p", port]).status ?? 0);
