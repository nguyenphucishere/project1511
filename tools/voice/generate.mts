// Records every line in tools/voice/lines.json with the voices in tools/voice/voices.json (AIMAX
// Studio API) and writes the mp3 files plus a manifest the game reads. Only lines that are missing,
// or whose text / voice / speed changed, are recorded again.
//
//   node tools/voice/generate.mjs                 (wrapper: runs this file with tsx)
//   --dry-run          count what would be recorded, spend nothing
//   --only-role=armstrong   re-record one role (after changing its voice in voices.json)
//   --limit=5          record at most 5 lines (a quick test)
//   --no-batch         one request per line instead of batches (slow: about two minutes per request)
//   --concurrency=10   requests in flight at once
//
// The API key comes from AIMAX_API_KEY in the environment or in the gitignored .env.local.
//
// A request costs about two minutes whatever its length, so lines are recorded in batches: all the
// lines of one voice go in one request (an SRT, one cue per line), the server returns one audio
// file plus the time of every sentence, and ffmpeg cuts it into one small m4a per line. A line the
// cutter cannot match falls back to its own request. Needs ffmpeg on the PATH (or FFMPEG=path)
// (its built-in aac encoder is used; output is small mono .m4a files).
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { voiceKey, type VoiceLocale } from "../../apps/web/src/game/voiceKey";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../..");
const OUT_DIR = resolve(ROOT, "apps/web/public/assets/voice");
const BASE = "https://www.aimaxstudio.com/api/v1";
const args = new Map(process.argv.slice(2).map((a) => [a.replace(/^--/, "").split("=")[0], a.split("=")[1] ?? "true"]));
const DRY = args.has("dry-run");
const ONLY_ROLE = args.get("only-role");
const LIMIT = args.has("limit") ? Number(args.get("limit")) : Infinity;
const CONCURRENCY = args.has("concurrency") ? Number(args.get("concurrency")) : 10;
const NO_BATCH = args.has("no-batch");
/** A batch is at most this many characters and cues. */
const BATCH_CHARS = 1500;
const BATCH_CUES = 40;
const FFMPEG = process.env.FFMPEG || "ffmpeg";
/** Speech needs little: mono AAC at 48 kbps is about 6 KB a second and plays in every current browser. */
const AAC_BITRATE = process.env.VOICE_BITRATE || "48k";
const HAVE_FFMPEG = !DRY && spawnSync(FFMPEG, ["-version"], { encoding: "utf8" }).status === 0;
/** Without ffmpeg (single requests only) the API's own mp3 is stored as it comes. */
const EXT = HAVE_FFMPEG || DRY ? "m4a" : "mp3";

function readKey(): string {
  if (process.env.AIMAX_API_KEY) return process.env.AIMAX_API_KEY.trim();
  for (const f of [resolve(ROOT, ".env.local"), resolve(ROOT, "apps/web/.env.local")]) {
    if (existsSync(f)) {
      const m = /AIMAX_API_KEY=(.+)/.exec(readFileSync(f, "utf8"));
      if (m) return m[1].trim();
    }
  }
  throw new Error("AIMAX_API_KEY not found (set it in the environment or in .env.local)");
}
const KEY = DRY ? "" : readKey();
const H = { "X-API-Key": KEY };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function rfetch(url: string, init?: RequestInit, tries = 5): Promise<Response> {
  for (let i = 1; ; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      if (i >= tries) throw e;
      await sleep(800 * i);
    }
  }
}
const asJson = async (r: Response) => {
  const t = await r.text();
  try {
    return JSON.parse(t);
  } catch {
    return t.slice(0, 300);
  }
};

// ---- voices
/**
 * How the lines performed in a state (panic, terror) are recorded: the same voice pushed faster, higher
 * and louder, with an interjection tag in front of the words, "(gasps)" or "(breath)", which MiniMax
 * speech 2.8 acts out. (ElevenLabs v3 emotion tags would do more, but that backend fails on this account.)
 */
interface CrisisConfig { provider: string; model: string; speed?: number; pitch?: number; vol?: number; stability?: number; similarity?: number; style_exaggeration?: number; en?: { voice: string }; vi?: { voice: string } }
interface RoleConfig { label: string; radio: boolean; speed?: number; crisis?: CrisisConfig; en: { voice: string }; vi: { voice: string } }
const cfg = JSON.parse(readFileSync(resolve(HERE, "voices.json"), "utf8")) as { model: string; roles: Record<string, RoleConfig> };
const lines = (JSON.parse(readFileSync(resolve(HERE, "lines.json"), "utf8")) as { lines: { role: string; en: string; vi: string; viAsEn?: boolean; tag?: string; src: string }[] }).lines;

const voiceCache = new Map<string, { voice_id: string; name: string }>();
async function resolveVoice(name: string, locale: VoiceLocale, provider = "minimax"): Promise<{ voice_id: string; name: string }> {
  const k = `${provider}|${locale}|${name}`;
  const hit = voiceCache.get(k);
  if (hit) return hit;
  if (DRY) return { voice_id: `dry:${name}`, name };
  const scope = provider === "minimax" ? "" : `provider=${provider}&`;
  for (const q of [`language=${locale}&${scope}search=${encodeURIComponent(name)}`, `${scope}search=${encodeURIComponent(name)}`]) {
    for (let page = 0; page < 4; page++) {
      const r = await asJson(await rfetch(`${BASE}/voices?limit=100&page=${page}&${q}`, { headers: H }));
      const found = (r.voices ?? []).find((v: any) => v.name.toLowerCase() === name.toLowerCase() && String(v.provider).toLowerCase().startsWith(provider));
      if (found) {
        voiceCache.set(k, found);
        return found;
      }
      if (!r.has_more) break;
    }
  }
  throw new Error(`voice not found: "${name}" (${locale}). Check the exact name in tools/voice/voices.json`);
}

// ---- jobs
interface Job { crisis?: boolean; tag?: string; role: string; locale: VoiceLocale; text: string; voiceLocale: VoiceLocale; key: string; file: string; hash: string }
const manifestPath = resolve(OUT_DIR, "manifest.json");
const prev = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, "utf8")) : { lines: {} };
const manifest: { version: 1; model: string; roles: Record<string, { radio: boolean }>; lines: Record<string, { f: string; role: string; h: string }> } = {
  version: 1, model: cfg.model, roles: {}, lines: { ...prev.lines },
};
for (const [role, c] of Object.entries(cfg.roles)) manifest.roles[role] = { radio: c.radio };

const jobs: Job[] = [];
for (const l of lines) {
  const role = cfg.roles[l.role];
  if (!role) throw new Error(`line from ${l.src} uses role "${l.role}" which is not in voices.json`);
  if (ONLY_ROLE && l.role !== ONLY_ROLE) continue;
  for (const locale of ["en", "vi"] as VoiceLocale[]) {
    const text = locale === "vi" && l.viAsEn ? l.en : l[locale];
    const voiceLocale: VoiceLocale = locale === "vi" && l.viAsEn ? "en" : locale;
    const key = voiceKey(locale, l[locale]); // the game looks the line up by the words it shows
    const crisis = l.tag && role.crisis ? role.crisis : null;
    const voiceName = crisis ? (crisis[voiceLocale]?.voice ?? role[voiceLocale].voice) : role[voiceLocale].voice;
    const hash = createHash("sha1")
      .update([text, voiceName, crisis ? crisis.model : cfg.model, crisis ? `${l.tag}|${crisis.provider}|${crisis.speed}|${crisis.pitch}|${crisis.vol}` : role.speed ?? 1, voiceLocale].join("|"))
      .digest("hex")
      .slice(0, 10);
    const file = `${locale}/${key}.${EXT}`;
    const known = manifest.lines[key];
    if (known && known.h === hash && existsSync(resolve(OUT_DIR, file))) continue;
    jobs.push({ role: l.role, locale, text, voiceLocale, key, file, hash, crisis: !!crisis, tag: crisis ? l.tag : undefined });
  }
}
// Drop recordings of lines that no longer exist (text changed, role changed), so the manifest and the folder stay clean.
if (!ONLY_ROLE) {
  const wanted = new Set(lines.flatMap((l) => (["en", "vi"] as VoiceLocale[]).map((loc) => voiceKey(loc, l[loc]))));
  for (const key of Object.keys(manifest.lines)) {
    if (wanted.has(key)) continue;
    if (!DRY) {
      try {
        unlinkSync(resolve(OUT_DIR, manifest.lines[key].f));
      } catch {
        /* already gone */
      }
    }
    delete manifest.lines[key];
  }
}
const chars = jobs.reduce((n, j) => n + j.text.length, 0);
console.log(`${lines.length} lines x 2 languages: ${jobs.length} to record (${chars} characters), ${lines.length * 2 - jobs.length} already up to date`);
if (DRY) process.exit(0);
mkdirSync(resolve(OUT_DIR, "en"), { recursive: true });
mkdirSync(resolve(OUT_DIR, "vi"), { recursive: true });

// ---- one request per line (the fallback, and --no-batch)
async function record(job: Job): Promise<{ audio: Buffer; chars: number }> {
  const role = cfg.roles[job.role];
  const crisis = job.crisis ? role.crisis! : null;
  const voice = crisis
    ? await resolveVoice(crisis[job.voiceLocale]?.voice ?? role[job.voiceLocale].voice, job.voiceLocale, crisis.provider)
    : await resolveVoice(role[job.voiceLocale].voice, job.voiceLocale);
  let lastError = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const fd = new FormData();
    if (crisis) {
      // A performed line: the same voice, faster and higher, with the interjection tag in front of the words.
      fd.append("provider", crisis.provider);
      fd.append("voice_id", voice.voice_id);
      fd.append("text", `${job.tag}${job.text}`);
      fd.append("model", crisis.model);
      fd.append("language", job.voiceLocale === "vi" ? "Vietnamese" : "English");
      fd.append("speed", String(crisis.speed ?? 1));
      if (crisis.pitch !== undefined) fd.append("pitch", String(crisis.pitch));
      if (crisis.vol !== undefined) fd.append("vol", String(crisis.vol));
    } else {
      fd.append("provider", "minimax");
      fd.append("voice_id", voice.voice_id);
      fd.append("text", job.text);
      fd.append("model", cfg.model);
      fd.append("language", job.voiceLocale === "vi" ? "Vietnamese" : "English");
      fd.append("speed", String(role.speed ?? 1));
    }
    const sub = await rfetch(`${BASE}/tts/generate`, { method: "POST", headers: H, body: fd });
    const created = await asJson(sub);
    if (!created?.job_id) {
      lastError = `submit ${sub.status} ${JSON.stringify(created).slice(0, 160)}`;
      await sleep(1500 * attempt);
      continue;
    }
    for (let i = 0; i < 200; i++) {
      await sleep(1200);
      const st = await asJson(await rfetch(`${BASE}/tts/jobs/${created.job_id}`, { headers: H }));
      if (st.audio_url) {
        const url = st.audio_url.startsWith("http") ? st.audio_url : new URL(st.audio_url, BASE).toString();
        const a = await rfetch(url, { headers: H });
        if (!a.ok) { lastError = `download ${a.status}`; break; }
        return { audio: Buffer.from(await a.arrayBuffer()), chars: st.chars_deducted ?? job.text.length };
      }
      // "processing" and "merging" are intermediate states; only a terminal failure ends the wait.
      if (["failed", "error", "cancelled", "canceled"].includes(st.status)) { lastError = st.error_message || st.status; break; }
    }
    await sleep(1500 * attempt);
  }
  throw new Error(lastError || "failed");
}

// ---- batching
interface Seg { start: number; end: number; text: string }
const toSec = (t: string) => {
  const m = /(\d+):(\d+):(\d+)[,.](\d+)/.exec(t)!;
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, "0").slice(0, 3) / 1000;
};
function parseSrt(text: string): Seg[] {
  return text.replace(/\r/g, "").split(/\n\n+/).flatMap((block) => {
    const rows = block.trim().split("\n");
    const t = rows.find((l) => l.includes("-->"));
    if (!t) return [];
    const [a, b] = t.split("-->");
    return [{ start: toSec(a), end: toSec(b), text: rows.slice(rows.indexOf(t) + 1).join(" ") }];
  });
}
const norm = (s: string) => s.toLowerCase().replace(/[\s.,;:!?'"“”‘’()\-–—…]/g, "");
/** Turns the sentence timings back into one time range per cue (a cue may have been split into several sentences). */
function mapCues(cues: string[], segs: Seg[]): ({ start: number; end: number } | null)[] {
  const out: ({ start: number; end: number } | null)[] = [];
  let i = 0;
  let broken = false;
  for (const cue of cues) {
    const target = norm(cue);
    const first = i;
    let acc = "";
    while (!broken && i < segs.length && acc.length < target.length) acc += norm(segs[i++].text);
    if (!broken && acc === target && i > first) out.push({ start: segs[first].start, end: segs[i - 1].end });
    else {
      out.push(null);
      broken = true; // once out of step the rest cannot be trusted
    }
  }
  return out;
}
function cut(src: string, start: number, end: number, dest: string): boolean {
  const r = spawnSync(
    FFMPEG,
    ["-y", "-hide_banner", "-loglevel", "error", "-ss", start.toFixed(3), "-t", (end - start + 0.12).toFixed(3), "-i", src, "-ac", "1", "-af", "afade=t=in:d=0.012", "-c:a", "aac", "-b:a", AAC_BITRATE, dest],
    { encoding: "utf8" },
  );
  return r.status === 0 && existsSync(dest);
}
const srtTime = (s: number) => {
  const ms = Math.round(s * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};

interface Batch { role: string; voiceLocale: VoiceLocale; items: { text: string; jobs: Job[] }[] }
function makeBatches(list: Job[]): Batch[] {
  const groups = new Map<string, Map<string, Job[]>>();
  for (const j of list) {
    const k = `${j.role}|${j.voiceLocale}`;
    const g = groups.get(k) ?? new Map<string, Job[]>();
    g.set(j.text, [...(g.get(j.text) ?? []), j]); // the same words under two keys (an English quote read to a Vietnamese player) are recorded once
    groups.set(k, g);
  }
  const out: Batch[] = [];
  for (const [k, texts] of groups) {
    const [role, voiceLocale] = k.split("|") as [string, VoiceLocale];
    let cur: Batch = { role, voiceLocale, items: [] };
    let size = 0;
    for (const [text, jobsForText] of texts) {
      if (cur.items.length && (size + text.length > BATCH_CHARS || cur.items.length >= BATCH_CUES)) {
        out.push(cur);
        cur = { role, voiceLocale, items: [] };
        size = 0;
      }
      cur.items.push({ text, jobs: jobsForText });
      size += text.length;
    }
    if (cur.items.length) out.push(cur);
  }
  return out;
}

async function recordBatch(b: Batch, tmp: string, n: number): Promise<{ failedItems: Batch["items"]; chars: number }> {
  const role = cfg.roles[b.role];
  const voice = await resolveVoice(role[b.voiceLocale].voice, b.voiceLocale);
  let t = 0;
  const srt = b.items.map((it, i) => `${i + 1}\n${srtTime(t)} --> ${srtTime((t += 4))}\n${it.text}\n`).join("\n");
  for (let attempt = 1; attempt <= 3; attempt++) {
    const fd = new FormData();
    fd.append("provider", "minimax");
    fd.append("voice_id", voice.voice_id);
    fd.append("model", cfg.model);
    fd.append("language", b.voiceLocale === "vi" ? "Vietnamese" : "English");
    fd.append("speed", String(role.speed ?? 1));
    fd.append("enable_srt", "true");
    fd.append("text_file", new Blob([srt], { type: "text/plain" }), "lines.srt");
    const created = await asJson(await rfetch(`${BASE}/tts/generate`, { method: "POST", headers: H, body: fd }));
    if (!created?.job_id) {
      await sleep(2000 * attempt);
      continue;
    }
    for (let i = 0; i < 400; i++) {
      await sleep(3000);
      const st = await asJson(await rfetch(`${BASE}/tts/jobs/${created.job_id}`, { headers: H }));
      if (["failed", "error", "cancelled", "canceled"].includes(st.status)) break;
      if (!st.audio_url || !st.srt_url) continue;
      const get = (u: string) => rfetch(u.startsWith("http") ? u : new URL(u, BASE).toString(), { headers: H });
      const audio = Buffer.from(await (await get(st.audio_url)).arrayBuffer());
      const segs = parseSrt(await (await get(st.srt_url)).text());
      const whole = resolve(tmp, `batch-${n}.mp3`);
      writeFileSync(whole, audio);
      const ranges = mapCues(b.items.map((x) => x.text), segs);
      const failedItems: Batch["items"] = [];
      b.items.forEach((it, idx) => {
        const r = ranges[idx];
        const first = it.jobs[0];
        const dest = resolve(OUT_DIR, first.file);
        if (!r || !cut(whole, r.start, r.end, dest)) {
          failedItems.push(it);
          return;
        }
        for (const j of it.jobs) {
          if (j !== first) copyFileSync(dest, resolve(OUT_DIR, j.file));
          manifest.lines[j.key] = { f: j.file, role: j.role, h: j.hash };
        }
      });
      return { failedItems, chars: st.chars_deducted ?? 0 };
    }
    await sleep(2000 * attempt);
  }
  return { failedItems: b.items, chars: 0 };
}

let done = 0;
let spent = 0;
let queue = jobs.slice(0, LIMIT);

if (!NO_BATCH && queue.length) {
  if (!HAVE_FFMPEG) throw new Error("ffmpeg not found: install it, or set FFMPEG=path/to/ffmpeg(.exe), or use --no-batch");
  const tmp = mkdtempSync(resolve(tmpdir(), "voice-"));
  const batches = makeBatches(queue.filter((j) => !j.crisis));
  console.log(`${batches.length} batches for ${queue.length} lines`);
  const leftovers: Job[] = [];
  let finished = 0;
  const pending = batches.map((b, i) => ({ b, i }));
  const batchWorker = async () => {
    while (pending.length) {
      const { b, i } = pending.shift()!;
      try {
        const r = await recordBatch(b, tmp, i);
        spent += r.chars;
        for (const it of r.failedItems) leftovers.push(...it.jobs);
        done += b.items.reduce((n, it) => n + (r.failedItems.includes(it) ? 0 : it.jobs.length), 0);
      } catch (e: any) {
        for (const it of b.items) leftovers.push(...it.jobs);
        console.log(`\n  batch ${b.role}/${b.voiceLocale} failed: ${e.message}`);
      }
      process.stdout.write(`\r${++finished}/${batches.length} batches done, ${done} lines recorded   `);
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, batchWorker));
  rmSync(tmp, { recursive: true, force: true });
  console.log(`\nbatches finished: ${done} lines recorded, ${leftovers.length} need their own request`);
  queue = [...leftovers, ...queue.filter((j) => j.crisis)]; // performed lines are always one request each
}

const failed: string[] = [];
const total = queue.length;
let single = 0;
async function worker() {
  while (queue.length) {
    const job = queue.shift()!;
    try {
      const { audio, chars: c } = await record(job);
      if (EXT === "m4a") {
        // The same small AAC as the batch path (the API returns ~190 kbps mp3).
        const tmpFile = resolve(OUT_DIR, `${job.key}.src.mp3`);
        writeFileSync(tmpFile, audio);
        const ok = cut(tmpFile, 0, 600, resolve(OUT_DIR, job.file));
        rmSync(tmpFile, { force: true });
        if (!ok) throw new Error("ffmpeg could not convert the recording");
      } else {
        writeFileSync(resolve(OUT_DIR, job.file), audio);
      }
      manifest.lines[job.key] = { f: job.file, role: job.role, h: job.hash };
      spent += c;
    } catch (e: any) {
      failed.push(`${job.role} [${job.locale}] "${job.text.slice(0, 50)}": ${e.message}`);
    }
    process.stdout.write(`\r${++single}/${total} single requests, ${failed.length} failed   `);
    if (single % 10 === 0) writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
  }
}
if (total) await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
writeFileSync(manifestPath, JSON.stringify(manifest, null, 1) + "\n");
// Remove recordings nothing refers to any more (an older format, a reworded line).
if (!ONLY_ROLE && !Number.isFinite(LIMIT) === true) {
  const used = new Set(Object.values(manifest.lines).map((l) => l.f));
  for (const loc of ["en", "vi"]) {
    for (const name of readdirSync(resolve(OUT_DIR, loc))) if (!used.has(`${loc}/${name}`)) unlinkSync(resolve(OUT_DIR, loc, name));
  }
}
console.log(`\nfinished:${done + (total - failed.length)} lines recorded, ${failed.length} failed, ~${spent} characters used`);
failed.forEach((f) => console.log("  FAILED", f));
process.exit(failed.length ? 1 : 0);
