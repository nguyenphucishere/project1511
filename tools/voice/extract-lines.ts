// Collects every line the game says aloud, with the role that says it, straight from the game's
// own data (so nothing is retyped), and writes tools/voice/lines.json.
//
// Run from apps/web:   ../server/node_modules/.bin/tsx --tsconfig tsconfig.json ../../tools/voice/extract-lines.ts
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

type L = { en: string; vi: string };
interface Line {
  role: string;
  en: string;
  vi: string;
  /** The text exists only in English: the Vietnamese player hears the English voice read it. */
  viAsEn?: boolean;
  /** An emotion tag for the performed (crisis) recording of this line, e.g. "(gasps) ". */
  tag?: string;
  src: string;
}

const SRC = resolve(process.cwd(), "src").replace(/\\/g, "/");
const OUT = resolve(process.cwd(), "../../tools/voice/lines.json");
const load = (p: string) => import(`file:///${SRC}/${p}`);

async function main() {
  const { BRIEFINGS } = await load("game/script.ts");
  const { DECISIONS } = await load("game/decisions.ts");
  const { CONSEQUENCES, getConsequence, getCallbackLines } = await load("game/consequences.ts");
  const { ENDINGS_CATALOG } = await load("game/endings.ts");
  const { CHARACTERS } = await load("game/characters.ts");
  const { INTERLUDES } = await load("game/interludes.ts");
  const { SAY, PA_LINES, TOOL_NAME, STATION_NAME } = await load("scenes/workshop/content.ts");
  const { BOLT_LABEL, STAR_ORDER, FUEL_LINES } = await load("scenes/workshop/handworkRules.ts");
  const { ROCKET_PARTS } = await load("mocks/rocket-parts.ts");
  const { FAULTS } = await load("scenes/workshop/faults.ts");
  const { VITAL_STATIONS } = await load("mocks/vitals.ts");
  const { CALLOUTS } = await load("scenes/mission-control/callouts.ts");
  const { ORBITS, WIND_LIMIT_KMH } = await load("mocks/launch-options.ts");
  const story = await load("scenes/translunar/story.ts");
  const { DESCENT_STEPS } = await load("mocks/descent.ts");
  const { dictionaries, format } = await load("i18n/index.ts");
  const en = dictionaries.en as any;
  const vi = dictionaries.vi as any;

  const ROLE_OF: Record<string, string> = {
    armstrong: "armstrong", astronaut: "armstrong", aldrin: "aldrin", collins: "collins",
    kranz: "kranz", "flight-director": "kranz", bales: "bales", garman: "garman", engineer: "garman",
    doctor: "doctor", "workshop-chief": "rudolph", pa: "pa",
  };
  const rows: Line[] = [];
  const add = (role: string, t: L, src: string, extra: Partial<Line> = {}) => {
    if (!t || typeof t.en !== "string" || typeof t.vi !== "string") throw new Error(`bad text from ${src}`);
    rows.push({ role, en: t.en, vi: t.vi, src, ...extra });
  };
  const both = (path: string[]): L => {
    const get = (d: any) => path.reduce((o, k) => (o == null ? o : o[k]), d);
    return { en: String(get(en)), vi: String(get(vi)) };
  };
  const fmt = (path: string[], values: Record<string, string | number>): L => {
    const t = both(path);
    return { en: format(t.en, values), vi: format(t.vi, values) };
  };
  const roleOf = (id: string): string => {
    const r = ROLE_OF[id];
    if (!r) throw new Error(`no voice role for character "${id}"`);
    return r;
  };

  // 1. Chapter briefings: each line is said by its speaker.
  for (const [id, b] of Object.entries(BRIEFINGS) as [string, any][]) {
    b.lines.forEach((l: any) => add(roleOf(l.speaker), l.text, `briefing:${id}`));
  }

  // The spoken interlude before a chapter's briefing.
  for (const [id, it] of Object.entries(INTERLUDES) as [string, any][]) {
    it.lines.forEach((l: L) => add(roleOf(it.speaker), l, `interlude:${id}`));
  }

  // 2. Decisions: the person asking the question, the second opinion, and what happens after.
  for (const d of Object.values(DECISIONS) as any[]) add(roleOf(d.speaker), d.prompt, `decision:${d.id}`);
  for (const [k, c] of Object.entries(CONSEQUENCES) as [string, any][]) {
    c.lines.forEach((l: any) => {
      const flightToBooster = /^Flight, Booster\b/.test(l.text.en); // the data credits the flight director, but Booster is speaking
      add(flightToBooster ? "booster" : l.speaker ? roleOf(l.speaker) : "narrator", l.text, `consequence:${k}`);
    });
  }
  // Lines the consequence functions add depending on earlier choices.
  for (const point of ["agc_alarm", "landing_approach"]) {
    getCallbackLines(point, { decisions: { inspection: "rushed", trajectory: "direct" } }).forEach((t: L) => add("narrator", t, `callback:${point}`));
  }
  const abortWithDirect = getConsequence("agc_alarm", "abort_stage", { decisions: { trajectory: "direct" } });
  abortWithDirect.lines.forEach((l: any) => add(l.speaker ? roleOf(l.speaker) : "narrator", l.text, "consequence:agc_alarm:abort_stage+direct"));
  const lowMargin = getConsequence("landing_approach", "p66_redesignation", { decisions: { inspection: "rushed", trajectory: "direct", landing_approach: "p66_redesignation" } });
  lowMargin.lines.forEach((l: any) => add(l.speaker ? roleOf(l.speaker) : "narrator", l.text, "consequence:landing_approach:p66_low_margin"));

  // 3. Medical bay.
  VITAL_STATIONS.forEach((v: any) => add("doctor", v.why, `medical:${v.id}`));
  VITAL_STATIONS.forEach((v: any) => add("doctor", v.verdict, `medical:${v.id}:verdict`));
  add("doctor", both(["medical", "doorPrompt"]), "medical:doorPrompt");
  add("doctor", { en: format(en.medical.greeting, { name: CHARACTERS.doctor.name.en }), vi: format(vi.medical.greeting, { name: CHARACTERS.doctor.name.vi }) }, "medical:greeting");
  add("doctor", both(["medical", "guide"]), "medical:guide");
  add("doctor", { en: format(en.medical.clearedBody, { name: CHARACTERS.doctor.name.en }), vi: format(vi.medical.clearedBody, { name: CHARACTERS.doctor.name.vi }) }, "medical:cleared");

  // 4. Assembly hall: Rudolph and Garman on the floor, the loudspeaker, the part and fault explanations.
  const samples: Record<string, any[][]> = {
    wrongTool: (Object.keys(TOOL_NAME) as string[]).filter((t) => t !== "torque").map((t) => [TOOL_NAME[t]]),
    boltWrongOrder: [...BOLT_LABEL].map((l: string) => [l]),
    boltTight: [...STAR_ORDER].map((idx: number, i: number) => [BOLT_LABEL[idx], STAR_ORDER.length - 1 - i]),
    couplingHit: (FUEL_LINES as string[]).map((f) => [f]),
    wrongOrder: (Object.keys(STATION_NAME) as string[]).map((s) => [s]),
  };
  const addSay = (line: any, src: string) => add(line.who === "pa" ? "pa" : roleOf(line.who), line.text, src);
  for (const [key, v] of Object.entries(SAY) as [string, any][]) {
    if (typeof v === "function") (samples[key] ?? []).forEach((args, i) => addSay(v(...args), `workshop:${key}#${i}`));
    else if (Array.isArray(v)) v.forEach((line, i) => addSay(line, `workshop:${key}#${i}`));
    else if (v?.text) addSay(v, `workshop:${key}`);
    else if (v && typeof v === "object") for (const [k2, line] of Object.entries(v) as [string, any][]) addSay(line, `workshop:${key}.${k2}`);
  }
  (PA_LINES as L[]).forEach((t, i) => add("pa", t, `workshop:pa#${i}`));
  ROCKET_PARTS.forEach((p: any) => add("rudolph", p.role, `workshop:part:${p.id}`));
  // The workshop says a found fault as "<name>. <explanation>" (see WorkshopScene), so record exactly that.
  FAULTS.forEach((f: any) =>
    add("rudolph", { en: `${f.name.en}. ${f.explain.en}`, vi: `${f.name.vi}. ${f.explain.vi}` }, `workshop:fault:${f.id}`),
  );

  // 5. Mission control and the climb to orbit.
  (await load("scenes/mission-control/callouts.ts")).COUNT_VOICE.forEach((t: L, i: number) => add("kranz", t, `launch-count#${i + 1}`));
  const { SCRIPT: FAIL_SCRIPT } = await load("scenes/ascent/failureScript.ts");
  // The crew in the cabin are performed: shouted and breathless, or shaken and low when the line is quiet.
  const crewTag = (t: L) => (/[!]/.test(t.en) ? "(gasps) " : "(breath) ");
  for (const [code, cues] of Object.entries(FAIL_SCRIPT) as [string, any[]][])
    cues.forEach((c, i) => c.line && add(c.who, c.line, `failure-cabin:${code}#${i}`, { tag: crewTag(c.line) }));
  const { ROOM_SCRIPT_ALL } = await load("scenes/mission-control/controlRoomScript.ts");
  // The calls from the room: shouted and cracking while the panic runs, plain once the order to hold is given.
  (ROOM_SCRIPT_ALL as any[]).forEach((b, i) =>
    add(b.voice, b.line, `launch-room#${i}`, b.panic >= 0.9 ? { tag: "(gasps) (pant) " } : b.panic >= 0.6 ? { tag: "(gasps) " } : {}),
  );
  const { LAUNCH_ENDINGS } = await load("scenes/mission-control/launchEndings.ts");
  for (const e of Object.values(LAUNCH_ENDINGS) as any[]) {
    add("kranz", e.call, `launch-ending:${e.id}:call`);
    e.lines.forEach((t: L, i: number) => add("narrator", t, `launch-ending:${e.id}#${i}`));
  }
  CALLOUTS.forEach((c: any, i: number) => add(c.voice, c.line, `launch-callout#${i}`));
  add("kranz", fmt(["missionControl", "pollIntro"], { name: CHARACTERS["flight-director"].name.en }), "mission-control:poll");
  rows[rows.length - 1].vi = format(vi.missionControl.pollIntro, { name: CHARACTERS["flight-director"].name.vi });
  for (const o of ORBITS as any[]) add("kranz", fmt(["missionControl", "orbitBody"], { km: o.km }), `mission-control:orbit:${o.km}`);
  for (const k of ["anomalyBody", "adviceOverweight", "adviceFuel", "replacement"]) add("narrator", both(["missionControl", k]), `mission-control:${k}`);
  for (const k of Object.keys(en.ascent.callouts)) add("capcom", both(["ascent", "callouts", k]), `ascent:callout:${k}`);
  for (const k of Object.keys(en.ascent.warnDetail)) add("capcom", both(["ascent", "warnDetail", k]), `ascent:warn:${k}`);

  // The orbit card after the climb says the parking orbit it reached (the player's choice, 185 km by default).
  for (const km of new Set<number>([...(ORBITS as any[]).map((o) => o.km), 185])) {
    add("narrator", fmt(["ascent", "doneBody"], { km }), `ascent:done:${km}`);
  }
  // The assembly hall card: the chief signs the rocket off.
  {
    const { UI } = await load("scenes/workshop/content.ts");
    add("rudolph", { en: format(UI.done.body.en, { name: CHARACTERS["workshop-chief"].name.en }), vi: format(UI.done.body.vi, { name: CHARACTERS["workshop-chief"].name.vi }) }, "workshop:done");
  }

  // 6. Moon trip and flight home: the narrator.
  (story.PHASES as any[]).forEach((c, i) => add("narrator", c.text, `translunar:phase#${i}`));
  (story.READING as any[]).forEach((c, i) => add("narrator", c.text, `translunar:reading#${i}`));
  add("narrator", both(["translunar", "doneBody"]), "translunar:done");
  add("narrator", both(["translunar", "returnDoneBody"]), "translunar:return-done");
  // The real air-to-ground traffic of the entry and recovery, each in its speaker's voice.
  (story.RADIO_LOG as any[]).forEach((c, i) => add(c.role, c.text, `translunar:radio#${i}`));

  // 7. Lunar descent: Armstrong's calls and the narrator's outcomes.
  DESCENT_STEPS.forEach((d: any) => add("armstrong", d.cue, `descent:cue:${d.id}`));
  for (const k of Object.keys(en.lunarDescent.call)) {
    const voiced = en.lunarDescent.callVoice?.[k] ? both(["lunarDescent", "callVoice", k]) : both(["lunarDescent", "call", k]);
    add("armstrong", voiced, `descent:call:${k}`);
  }
  for (const k of Object.keys(en.lunarDescent.crash)) add("narrator", both(["lunarDescent", "crash", k]), `descent:crash:${k}`);
  add("narrator", both(["lunarDescent", "touchdownBody"]), "descent:touchdown");

  // 8. Endings.
  const quoteRole = (attr: string) => (attr.startsWith("Neil A. Armstrong") ? "armstrong" : attr.startsWith("William Safire") ? "nixon" : "booster");
  const seen = new Set<string>();
  for (const e of Object.values(ENDINGS_CATALOG) as any[]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    add("narrator", e.subtitle, `ending:${e.id}:subtitle`);
    add(quoteRole(e.quoteAttribution), { en: e.quote, vi: e.quote }, `ending:${e.id}:quote`, { viAsEn: true });
    if (e.contingencySpeechText) add("nixon", e.contingencySpeechText, `ending:${e.id}:speech`);
    e.debriefReport.forEach((t: L, i: number) => add("narrator", t, `ending:${e.id}:debrief#${i}`));
  }

  // ---- tidy up: collapse repeats (the same words in the same voice record once)
  const out: Line[] = [];
  const keyOf = (l: Line) => `${l.role}|${l.en}|${l.vi}`;
  const index = new Map<string, Line>();
  const byText = new Map<string, string>();
  for (const l of rows) {
    const k = keyOf(l);
    if (index.has(k)) continue;
    const prior = byText.get(l.en);
    if (prior && prior !== l.role) console.warn(`  note: "${l.en.slice(0, 50)}…" is spoken by both ${prior} and ${l.role}; the game will use whichever recording it finds first (${prior})`);
    byText.set(l.en, prior ?? l.role);
    index.set(k, l);
    out.push(l);
  }
  const leftovers = out.filter((l) => /\{[a-zA-Z]+\}/.test(l.en + l.vi));
  leftovers.forEach((l) => console.warn(`  WARNING unfilled placeholder in ${l.src}: ${l.en.slice(0, 80)}`));
  const empty = out.filter((l) => !l.en.trim() || !l.vi.trim());
  empty.forEach((l) => console.warn(`  WARNING empty text in ${l.src}`));

  writeFileSync(OUT, JSON.stringify({ generatedBy: "tools/voice/extract-lines.ts", lines: out }, null, 2) + "\n", "utf8");
  const perRole: Record<string, { lines: number; chars: number }> = {};
  for (const l of out) {
    const r = (perRole[l.role] ??= { lines: 0, chars: 0 });
    r.lines++;
    r.chars += l.en.length + l.vi.length;
  }
  console.log(`${rows.length} rows -> ${out.length} unique lines`);
  console.table(perRole);
  console.log("total characters (en+vi):", out.reduce((n, l) => n + l.en.length + l.vi.length, 0));
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
