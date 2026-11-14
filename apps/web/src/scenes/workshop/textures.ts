"use client";

import { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from "three";
import { hallTextureUrls } from "./assets";

type PbrSet = { map: Texture; normalMap: Texture; roughnessMap: Texture };
type PbrTuple = [Texture, Texture, Texture];

/** A copy of `src` that repeats (rx, ry) times; copies share the image data, so it costs no memory. */
function tiled(src: Texture, rx: number, ry: number, srgb: boolean): Texture {
  const t = src.clone();
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(rx, ry);
  t.anisotropy = 8;
  t.colorSpace = srgb ? SRGBColorSpace : t.colorSpace;
  t.needsUpdate = true;
  return t;
}

function pbr(set: PbrTuple, rx: number, ry: number): PbrSet {
  const [map, normalMap, roughnessMap] = set;
  return {
    map: tiled(map, rx, ry, true),
    normalMap: tiled(normalMap, rx, ry, false),
    roughnessMap: tiled(roughnessMap, rx, ry, false),
  };
}

/** The real PBR texture sets of the hall (Poly Haven, CC0), tiled to suit each surface. */
export function useHallTextures() {
  const floor = useTexture(hallTextureUrls("concrete_floor_02")) as unknown as PbrTuple;
  const wall = useTexture(hallTextureUrls("concrete_wall_008")) as unknown as PbrTuple;
  const metal = useTexture(hallTextureUrls("metal_plate_02")) as unknown as PbrTuple;
  const iron = useTexture(hallTextureUrls("corrugated_iron")) as unknown as PbrTuple;
  return useMemo(
    () => ({
      floor: pbr(floor, 9, 8),
      wallLow: pbr(wall, 4.4, 1.05),
      wallBack: pbr(wall, 5, 5.2),
      metalPillar: pbr(metal, 1, 12),
      metalCeiling: pbr(metal, 10, 8),
      metalGirder: pbr(metal, 6, 1),
      iron: pbr(iron, 14, 3),
      ironDoor: pbr(iron, 6, 8),
    }),
    [floor, wall, metal, iron],
  );
}

/* ---------------------------------------------------------------- procedural rocket skin */

function rng(seed: number) {
  // mulberry32: deterministic, so the rocket looks the same on every load.
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number, w = size, h = size) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return { c, g: c.getContext("2d")! };
}

function toTexture(c: HTMLCanvasElement, srgb: boolean, wrapU = true): CanvasTexture {
  const t = new CanvasTexture(c);
  t.wrapS = wrapU ? RepeatWrapping : ClampToEdgeWrapping;
  t.wrapT = RepeatWrapping;
  t.anisotropy = 8;
  t.minFilter = LinearMipmapLinearFilter;
  t.magFilter = LinearFilter;
  if (srgb) t.colorSpace = SRGBColorSpace;
  return t;
}

export interface HullSkin {
  map: CanvasTexture;
  bumpMap: CanvasTexture;
  roughnessMap: CanvasTexture;
}

/**
 * Painted aluminium skin for a rocket stage: ring welds every 1.25 m, vertical seams every
 * quarter turn, rivet rows along the welds, drips of grime and scuffs. One tile spans one
 * circumference, so the caller repeats it along the height.
 */
export function makeHullSkin(base = "#eef2f7", seed = 7): HullSkin {
  const N = 1024;
  const rand = rng(seed);
  const albedo = canvas(N);
  const bump = canvas(N);
  const rough = canvas(N);
  const a = albedo.g;
  const b = bump.g;
  const r = rough.g;

  a.fillStyle = base;
  a.fillRect(0, 0, N, N);
  b.fillStyle = "#808080";
  b.fillRect(0, 0, N, N);
  r.fillStyle = "#6b6b6b";
  r.fillRect(0, 0, N, N);

  // Fine paint speckle.
  for (let i = 0; i < 14000; i++) {
    const x = rand() * N;
    const y = rand() * N;
    const v = rand();
    a.fillStyle = v > 0.5 ? "rgba(255,255,255,0.10)" : "rgba(60,70,85,0.07)";
    a.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 2);
    b.fillStyle = v > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
    b.fillRect(x, y, 2, 2);
  }

  // Panel shading: every other panel a hair darker, as real tank barrels never match exactly.
  const ringStep = N / 8;
  for (let i = 0; i < 8; i++) {
    a.fillStyle = `rgba(${i % 2 ? "30,40,60" : "255,255,255"},0.035)`;
    a.fillRect(0, i * ringStep, N, ringStep);
  }

  // Grime: long vertical streaks that start at seams and rivets.
  for (let i = 0; i < 70; i++) {
    const x = rand() * N;
    const y = rand() * N;
    const len = 40 + rand() * 260;
    const g = a.createLinearGradient(0, y, 0, y + len);
    g.addColorStop(0, `rgba(70,62,50,${0.05 + rand() * 0.09})`);
    g.addColorStop(1, "rgba(70,62,50,0)");
    a.fillStyle = g;
    a.fillRect(x, y, 1 + rand() * 3, len);
    r.fillStyle = "rgba(190,190,190,0.18)";
    r.fillRect(x, y, 3, len);
  }

  // Ring welds and vertical seams: dark groove with a pale edge, recessed in the bump map.
  const groove = (x: number, y: number, w: number, h: number) => {
    a.fillStyle = "rgba(55,65,80,0.55)";
    a.fillRect(x, y, w, h);
    a.fillStyle = "rgba(255,255,255,0.45)";
    if (w > h) a.fillRect(x, y + h, w, 1);
    else a.fillRect(x + w, y, 1, h);
    b.fillStyle = "#101010";
    b.fillRect(x, y, w, h);
    r.fillStyle = "#9a9a9a";
    r.fillRect(x, y, w, h);
  };
  for (let i = 0; i < 8; i++) groove(0, i * ringStep, N, 2);
  for (let i = 0; i < 4; i++) groove(i * (N / 4), 0, 2, N);

  // Rivet rows either side of every ring weld.
  const rivet = (x: number, y: number) => {
    a.fillStyle = "rgba(255,255,255,0.7)";
    a.beginPath();
    a.arc(x, y, 2.1, 0, Math.PI * 2);
    a.fill();
    a.fillStyle = "rgba(40,50,65,0.55)";
    a.beginPath();
    a.arc(x + 0.8, y + 0.9, 1.7, 0, Math.PI * 2);
    a.fill();
    b.fillStyle = "#f0f0f0";
    b.beginPath();
    b.arc(x, y, 2.6, 0, Math.PI * 2);
    b.fill();
  };
  for (let i = 0; i < 8; i++) {
    for (let x = 6; x < N; x += 22) {
      rivet(x, i * ringStep + 9);
      rivet(x, i * ringStep - 7 + (i === 0 ? N : 0));
    }
  }

  // A few scuffs where boots and tools have been.
  for (let i = 0; i < 26; i++) {
    const x = rand() * N;
    const y = rand() * N;
    a.strokeStyle = "rgba(90,98,110,0.25)";
    a.lineWidth = 1 + rand() * 2;
    a.beginPath();
    a.moveTo(x, y);
    a.lineTo(x + (rand() - 0.5) * 60, y + (rand() - 0.5) * 40);
    a.stroke();
  }

  return { map: toTexture(albedo.c, true), bumpMap: toTexture(bump.c, false), roughnessMap: toTexture(rough.c, false) };
}

/** Copy of a skin tile repeated along a stage of the given height and radius. */
export function skinFor(skin: HullSkin, height: number, radius: number): HullSkin {
  const ry = Math.max(1, height / (Math.PI * 2 * radius));
  const copy = (t: CanvasTexture) => {
    const c = t.clone();
    c.repeat.set(1, ry);
    c.needsUpdate = true;
    return c;
  };
  return { map: copy(skin.map), bumpMap: copy(skin.bumpMap), roughnessMap: copy(skin.roughnessMap) };
}

/** Lettering decal on transparent ground: wrapped around part of a cylinder by the caller. */
export function makeLettering(text: string, opts: { color: string; font: string; w: number; h: number; vertical?: boolean }) {
  const { c, g } = canvas(0, opts.w, opts.h);
  g.clearRect(0, 0, opts.w, opts.h);
  g.fillStyle = opts.color;
  g.font = opts.font;
  g.textAlign = "center";
  g.textBaseline = "middle";
  if (opts.vertical) {
    const step = opts.h / text.length;
    [...text].forEach((ch, i) => g.fillText(ch, opts.w / 2, step * (i + 0.5)));
  } else {
    g.fillText(text, opts.w / 2, opts.h / 2);
  }
  const t = toTexture(c, true, false);
  t.wrapT = ClampToEdgeWrapping;
  return t;
}

/** Heat-tinted nozzle: steel at the lip, bronze through the middle, blue-violet at the throat. */
export function makeNozzleTexture() {
  const { c, g } = canvas(0, 64, 256);
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#5a6270");
  grad.addColorStop(0.35, "#8a6a4a");
  grad.addColorStop(0.7, "#a1744a");
  grad.addColorStop(1, "#d0d6de");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 256);
  // Regenerative-cooling channels: fine vertical lines.
  for (let x = 0; x < 64; x += 2) {
    g.fillStyle = x % 4 ? "rgba(0,0,0,0.16)" : "rgba(255,255,255,0.10)";
    g.fillRect(x, 0, 1, 256);
  }
  const t = toTexture(c, true);
  return t;
}
