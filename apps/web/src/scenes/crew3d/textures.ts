import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

/**
 * Surface detail drawn at runtime, so the crew and the cabin have fabric weave, scuffs, stencilled
 * labels and patches without a single image file to download.
 */
function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function finish(c: HTMLCanvasElement, repeat = 1, color = false): Texture {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 8;
  if (color) t.colorSpace = SRGBColorSpace;
  return t;
}

/** Beta-cloth weave: a fine crosshatch with slow lumps, used as a bump map on the suits. */
export function fabricBump(): Texture {
  const { c, g } = canvas(256, 256);
  const r = seeded(7);
  g.fillStyle = "#808080";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    g.fillStyle = i % 4 === 0 ? "#9a9a9a" : "#6a6a6a";
    g.fillRect(i, 0, 1, 256);
    g.fillStyle = i % 4 === 0 ? "#8c8c8c" : "#767676";
    g.fillRect(0, i, 256, 1);
  }
  for (let i = 0; i < 400; i++) {
    g.fillStyle = `rgba(${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},${r() > 0.5 ? 255 : 0},0.025)`;
    g.beginPath();
    g.arc(r() * 256, r() * 256, 6 + r() * 22, 0, Math.PI * 2);
    g.fill();
  }
  return finish(c, 6);
}

/** Soft dirt and wear: darker in blotches and creases, a bit warmer. Multiplies the suit colour. */
export function suitGrime(): Texture {
  const { c, g } = canvas(512, 512);
  const r = seeded(21);
  g.fillStyle = "#f2efe8";
  g.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 260; i++) {
    const a = 0.02 + r() * 0.07;
    g.fillStyle = `rgba(${90 + r() * 40},${70 + r() * 30},${50 + r() * 20},${a})`;
    g.beginPath();
    g.ellipse(r() * 512, r() * 512, 8 + r() * 60, 5 + r() * 26, r() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // Creases: long thin darker streaks.
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(80,70,60,${0.05 + r() * 0.08})`;
    g.lineWidth = 1 + r() * 2;
    g.beginPath();
    const x = r() * 512;
    const y = r() * 512;
    g.moveTo(x, y);
    g.bezierCurveTo(x + 30, y + 20, x + 60 - r() * 40, y + 50, x + 80 * (r() - 0.3), y + 110);
    g.stroke();
  }
  return finish(c, 1, true);
}

/** Scratched, stencilled instrument panel: dark metal, white silkscreen boxes, rules and tiny labels. */
export function panelFace(): { map: Texture; rough: Texture } {
  const W = 2048;
  const H = 1024;
  const { c, g } = canvas(W, H);
  const rough = canvas(W, H);
  const r = seeded(99);
  g.fillStyle = "#23272f";
  g.fillRect(0, 0, W, H);
  rough.g.fillStyle = "#9a9a9a";
  rough.g.fillRect(0, 0, W, H);
  // Panel seams and screws.
  for (let x = 0; x <= W; x += 256) {
    g.fillStyle = "#0d0f13";
    g.fillRect(x - 2, 0, 4, H);
    for (let y = 40; y < H; y += 120) {
      g.fillStyle = "#6b717c";
      g.beginPath();
      g.arc(x + 14, y, 4, 0, Math.PI * 2);
      g.arc(x - 14, y, 4, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.font = "600 15px monospace";
  g.textBaseline = "middle";
  const labels = ["MASTER ALARM", "CAUTION/WARNING", "SPS", "TVC", "CM RCS", "ECS", "EPS", "SEQ", "ABORT", "LV GUID", "EDS", "CREW", "O2 FLOW", "GLY TEMP", "BATT", "INV", "FC 1", "FC 2", "FC 3", "PRESS", "SUIT", "CABIN", "STAB", "TLM"];
  for (let i = 0; i < 90; i++) {
    const x = 24 + Math.floor(r() * 30) * 66;
    const y = 30 + Math.floor(r() * 14) * 70;
    g.strokeStyle = "rgba(235,235,235,0.55)";
    g.lineWidth = 2;
    g.strokeRect(x, y, 56, 38);
    g.fillStyle = "rgba(240,240,240,0.85)";
    g.fillText(labels[Math.floor(r() * labels.length)]!, x + 3, y + 48);
    rough.g.fillStyle = "#555";
    rough.g.fillRect(x, y, 56, 38);
  }
  // Scratches and scuffs.
  for (let i = 0; i < 180; i++) {
    g.strokeStyle = `rgba(255,255,255,${0.03 + r() * 0.06})`;
    g.lineWidth = 1;
    g.beginPath();
    const x = r() * W;
    const y = r() * H;
    g.moveTo(x, y);
    g.lineTo(x + (r() - 0.5) * 140, y + (r() - 0.5) * 60);
    g.stroke();
    rough.g.strokeStyle = "rgba(255,255,255,0.35)";
    rough.g.beginPath();
    rough.g.moveTo(x, y);
    rough.g.lineTo(x + (r() - 0.5) * 140, y + (r() - 0.5) * 60);
    rough.g.stroke();
  }
  return { map: finish(c, 1, true), rough: finish(rough.c, 1) };
}

/** A round gauge face: ticks, numerals and a red zone. The needle is a separate mesh. */
export function gaugeFace(): Texture {
  const { c, g } = canvas(256, 256);
  g.fillStyle = "#0b0d11";
  g.fillRect(0, 0, 256, 256);
  g.translate(128, 128);
  g.strokeStyle = "#e9ecf2";
  g.fillStyle = "#e9ecf2";
  g.font = "700 20px monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  for (let i = 0; i <= 10; i++) {
    const a = (-225 + i * 27) * (Math.PI / 180);
    const long = i % 5 === 0;
    g.lineWidth = long ? 4 : 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 96, Math.sin(a) * 96);
    g.lineTo(Math.cos(a) * (long ? 78 : 84), Math.sin(a) * (long ? 78 : 84));
    g.stroke();
    if (long) g.fillText(String(i), Math.cos(a) * 58, Math.sin(a) * 58);
  }
  g.strokeStyle = "#e23b2c";
  g.lineWidth = 8;
  g.beginPath();
  g.arc(0, 0, 104, (-225 + 8 * 27) * (Math.PI / 180), (-225 + 10 * 27) * (Math.PI / 180));
  g.stroke();
  return finish(c, 1, true);
}

/** A sewn-on name tape: white letters on dark blue, with a thin red frame. */
export function nameTape(name: string): Texture {
  const { c, g } = canvas(512, 128);
  g.fillStyle = "#14233f";
  g.fillRect(0, 0, 512, 128);
  g.strokeStyle = "#b3262a";
  g.lineWidth = 6;
  g.strokeRect(6, 6, 500, 116);
  g.fillStyle = "#f4f4f1";
  g.font = "800 62px sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(name, 256, 70);
  return finish(c, 1, true);
}

/** The flag patch worn on the shoulder. */
export function flagPatch(): Texture {
  const { c, g } = canvas(256, 170);
  for (let i = 0; i < 13; i++) {
    g.fillStyle = i % 2 === 0 ? "#b3262a" : "#f4f4f1";
    g.fillRect(0, (i * 170) / 13, 256, 170 / 13 + 1);
  }
  g.fillStyle = "#1c3470";
  g.fillRect(0, 0, 112, 92);
  g.fillStyle = "#f4f4f1";
  for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) g.fillRect(10 + x * 17, 9 + y * 16, 5, 5);
  g.strokeStyle = "#1a1a1a";
  g.lineWidth = 8;
  g.strokeRect(0, 0, 256, 170);
  return finish(c, 1, true);
}
