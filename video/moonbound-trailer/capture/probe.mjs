// Probe: seed the saved checkpoint, open /play, screenshot each step after it settles.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
const steps = (process.argv[2] ?? "mission-control-scene,ascent-scene,translunar-scene,lunar-descent-scene,weather-decision,end").split(",");
const out = new URL("./probe/", import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"],
});
for (const stepId of steps) {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((id) => {
    localStorage.setItem("moonbound.progress", JSON.stringify({ state: { stepId: id }, version: 1 }));
  }, stepId);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push(e.message));
  const t0 = Date.now();
  await page.goto(`${BASE}/play`, { waitUntil: "load", timeout: 180000 });
  await page.waitForTimeout(12000);
  await page.screenshot({ path: `${out}${stepId}.png` });
  console.log(stepId, `${((Date.now() - t0) / 1000).toFixed(1)}s`, errs.slice(0, 2).join(" | "));
  await ctx.close();
}
await browser.close();
