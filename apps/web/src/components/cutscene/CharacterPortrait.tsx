"use client";

import { useState } from "react";
import { format } from "@/i18n";
import { useLocalized, useT } from "@/i18n/useT";
import { CHARACTERS, type CharacterId, type PlaceholderHead } from "@/game/characters";
import { getPortrait } from "@/lib/assets";
import { cn } from "@/lib/utils";

interface CharacterPortraitProps {
  character: CharacterId;
  className?: string;
}

/**
 * Shows the artist's PNG when assets.json marks it "final"; otherwise (or if the file fails
 * to load) a built-in pixel bust in palette colours, so layouts are final before the art is.
 */
export function CharacterPortrait({ character, className }: CharacterPortraitProps) {
  const t = useT();
  const localize = useLocalized();
  const info = CHARACTERS[character];
  const asset = getPortrait(info.portraitId);
  const [failed, setFailed] = useState(false);
  const name = localize(info.name);

  if (asset?.status === "final" && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- artist PNGs are pre-sized, static, and swapped via the manifest
      <img
        src={asset.src}
        alt={name}
        onError={() => setFailed(true)}
        className={cn("h-full w-auto select-none object-contain object-bottom", className)}
        draggable={false}
      />
    );
  }

  return (
    <PixelBust
      head={info.placeholder}
      label={format(t.portrait.placeholderAlt, { name })}
      className={className}
    />
  );
}

const COLS = 16;
const ROWS = 20;

type Cell =
  | "shell"
  | "shellShade"
  | "visor"
  | "visorHi"
  | "visorDark"
  | "glint"
  | "face"
  | "faceShade"
  | "eye"
  | "hair"
  | "accent"
  | "suit"
  | "suitHi"
  | "suitShade"
  | "trim"
  | "patch";

/**
 * Second pass: light from the upper left. Cells on the lower-right side of each shape get a
 * shade, the upper-left of the visor a reflection, and the suit a lit shoulder and a mission patch.
 */
function shade(grid: (Cell | null)[][]): (Cell | null)[][] {
  const at = (x: number, y: number) => grid[y]?.[x] ?? null;
  return grid.map((row, y) =>
    row.map((cell, x) => {
      if (!cell) return cell;
      const rightEdge = at(x + 1, y) !== cell || at(x + 1, y + 1) !== cell;
      if (cell === "shell") {
        if (x >= 10 && rightEdge) return "shellShade";
        if (y >= 12 && at(x, y + 1) !== "shell" && x >= 7) return "shellShade";
      }
      if (cell === "face" && x >= 10 && rightEdge) return "faceShade";
      if (cell === "visor") {
        if (x + y <= 9) return "visorHi";
        if (x + y >= 19) return "visorDark";
      }
      if (cell === "suit") {
        if (y === 15 && x <= 6) return "suitHi";
        if (x >= 12 || (y >= 18 && x >= 10)) return "suitShade";
        if (y === 16 && x === 5) return "patch";
      }
      return cell;
    }),
  );
}

/** Builds the placeholder bust procedurally: an ellipse head, a role-specific top, shoulders. */
function buildBust(head: PlaceholderHead): (Cell | null)[][] {
  const grid: (Cell | null)[][] = Array.from({ length: ROWS }, () => Array<Cell | null>(COLS).fill(null));
  const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

  // Shoulders and torso.
  for (let y = 14; y < ROWS; y++) {
    const half = Math.min(8, 4 + (y - 14) * 1.5);
    for (let x = 0; x < COLS; x++) {
      if (Math.abs(x + 0.5 - 8) <= half) grid[y][x] = "suit";
    }
  }
  for (let x = 6; x < 10; x++) grid[14][x] = "trim";

  if (head === "helmet") {
    for (let y = 0; y < 15; y++)
      for (let x = 0; x < COLS; x++) {
        if (inEllipse(x, y, 8, 7.5, 6.5, 7)) grid[y][x] = "shell";
        if (inEllipse(x, y, 8, 7.5, 4.6, 4.2)) grid[y][x] = "visor";
      }
    grid[5][5] = "glint";
    grid[5][6] = "glint";
    grid[6][5] = "glint";
    grid[13][7] = "accent";
    grid[13][8] = "accent";
    return grid;
  }

  for (let y = 2; y < 15; y++)
    for (let x = 0; x < COLS; x++) {
      if (inEllipse(x, y, 8, 8.5, 4.5, 5.5)) grid[y][x] = "face";
    }
  grid[8][6] = "eye";
  grid[8][9] = "eye";

  if (head === "cap") {
    for (let y = 1; y < 7; y++)
      for (let x = 0; x < COLS; x++) {
        if (inEllipse(x, y, 8, 6, 5, 4.5) && y < 6) grid[y][x] = "hair";
      }
    for (let x = 3; x < 13; x++) grid[6][x] = "accent";
  } else {
    // Hair and a headset with a boom mic.
    for (let y = 1; y < 7; y++)
      for (let x = 0; x < COLS; x++) {
        if (inEllipse(x, y, 8, 6.5, 5, 4.5) && y < 6) grid[y][x] = "hair";
      }
    for (let y = 6; y < 11; y++) {
      grid[y][2] = "accent";
      grid[y][13] = "accent";
    }
    for (let x = 3; x < 7; x++) grid[11][x] = "accent";
  }
  return grid;
}

const FILL: Record<Cell, string> = {
  shell: "fill-space-mist",
  shellShade: "fill-[#b8c4d6]",
  visor: "fill-nasa-blue",
  visorHi: "fill-nasa-blue-light",
  visorDark: "fill-[#06224f]",
  glint: "fill-space-white",
  face: "fill-space-mist",
  faceShade: "fill-[#d3dbe7]",
  eye: "fill-space-deep",
  hair: "fill-space-blue",
  accent: "fill-space-gold",
  suit: "fill-nasa-blue",
  suitHi: "fill-nasa-blue-light",
  suitShade: "fill-[#082c69]",
  trim: "fill-space-gold",
  patch: "fill-nasa-red",
};

function PixelBust({ head, label, className }: { head: PlaceholderHead; label: string; className?: string }) {
  const grid = shade(buildBust(head));
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${COLS} ${ROWS}`}
      shapeRendering="crispEdges"
      className={cn("h-full w-auto", className)}
    >
      <title>{label}</title>
      {grid.flatMap((row, y) =>
        row.map((cell, x) => (cell ? <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} className={FILL[cell]} /> : null)),
      )}
    </svg>
  );
}
