"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Color, DoubleSide, MathUtils, SRGBColorSpace, type Group } from "three";
import { PALETTE, SCENE_COLORS } from "@/lib/palette";
import type { PartId } from "@/mocks/rocket-parts";
import { STACK, facingTheta } from "./layout";
import type { EngineId } from "./loadout";
import { makeHullSkin, makeLettering, makeNozzleTexture, skinFor, type HullSkin } from "./textures";

/**
 * The Moon rocket, section by section. Every section is built around the vertical axis in stack
 * coordinates (metres), so the crane can lift one by moving its group, and the faults can be
 * pinned to the hull by (angle, height, radius).
 */

/* ---------------------------------------------------------------- shared materials */

interface Skins {
  stage1: HullSkin;
  stage2: HullSkin;
  interstage: HullSkin;
  service: HullSkin;
  capsule: HullSkin;
}

let skinCache: Skins | undefined;
function skins(): Skins {
  if (!skinCache) {
    const s1 = makeHullSkin("#f0f3f7", 7);
    const s2 = makeHullSkin("#e9eef4", 11);
    skinCache = {
      stage1: skinFor(s1, STACK.stage1.y1 - STACK.stage1.y0, STACK.stage1.r),
      stage2: skinFor(s2, STACK.stage2.y1 - STACK.stage2.y0, STACK.stage2.r),
      interstage: skinFor(makeHullSkin("#1d4fa8", 21), 1.6, 1.45),
      service: skinFor(makeHullSkin("#c9d0d9", 33), 2, 1),
      capsule: skinFor(makeHullSkin("#f4f6f9", 45), 1.4, 0.65),
    };
  }
  return skinCache;
}

const GOLD_GLOW = new Color(PALETTE.gold);

interface PaintProps {
  skin: HullSkin;
  hot: boolean;
  tint?: string;
  metalness?: number;
  clearcoat?: number;
}

/** Painted, riveted, slightly weathered metal. `hot` is the gold highlight under the cursor. */
function Paint({ skin, hot, tint = "#ffffff", metalness = 0.18, clearcoat = 0.35 }: PaintProps) {
  return (
    <meshPhysicalMaterial
      map={skin.map}
      bumpMap={skin.bumpMap}
      bumpScale={2.2}
      roughnessMap={skin.roughnessMap}
      roughness={1}
      metalness={metalness}
      clearcoat={clearcoat}
      clearcoatRoughness={0.45}
      color={tint}
      emissive={hot ? GOLD_GLOW : "#000000"}
      emissiveIntensity={hot ? 0.32 : 0}
      envMapIntensity={1.15}
    />
  );
}

function Steel({ hot = false, color = SCENE_COLORS.steelMid, rough = 0.38 }: { hot?: boolean; color?: string; rough?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      metalness={0.85}
      roughness={rough}
      emissive={hot ? GOLD_GLOW : "#000000"}
      emissiveIntensity={hot ? 0.3 : 0}
      envMapIntensity={1.3}
    />
  );
}

/* ---------------------------------------------------------------- part switch */

export function PartModel({ id, hot, engine }: { id: PartId; hot: boolean; engine: EngineId }) {
  switch (id) {
    case "stage1-engines":
      return <Engines hot={hot} engine={engine} />;
    case "stage1-tanks":
      return <Stage1Tanks hot={hot} />;
    case "interstage":
      return <Interstage hot={hot} />;
    case "stage2":
      return <Stage2 hot={hot} />;
    case "lander":
      return <LanderInAdapter hot={hot} />;
    case "service-module":
      return <ServiceModule hot={hot} />;
    case "crew-capsule":
      return <CrewCapsule hot={hot} />;
    case "escape-tower":
      return <EscapeTower hot={hot} />;
  }
}

/* ---------------------------------------------------------------- engines */

/** Where the bells go for each engine class (x, z) and how big they are. */
const BELL_LAYOUT: Record<EngineId, { scale: number; spots: [number, number][] }> = {
  light: { scale: 0.92, spots: [[0.82, 0.82], [-0.82, 0.82], [0.82, -0.82], [-0.82, -0.82]] },
  standard: { scale: 1, spots: [[0, 0], [0.95, 0], [-0.95, 0], [0, 0.95], [0, -0.95]] },
  heavy: {
    scale: 0.62,
    spots: [[0, 0], ...Array.from({ length: 8 }, (_, i): [number, number] => [Math.sin((i * Math.PI) / 4) * 1.12, Math.cos((i * Math.PI) / 4) * 1.12])],
  },
};

let nozzleMap: ReturnType<typeof makeNozzleTexture> | undefined;

function Bell({ x, z, scale, hot, delay }: { x: number; z: number; scale: number; hot: boolean; delay: number }) {
  const ref = useRef<Group>(null);
  const born = useRef<number | null>(null);
  nozzleMap ??= makeNozzleTexture();
  const bellH = 1.4;
  const y = STACK.engines.y0 + 0.1 + bellH / 2;

  // Pops in with a little overshoot, so swapping engines reads as bolting new ones on.
  useFrame(({ clock }) => {
    if (!ref.current) return;
    born.current ??= clock.elapsedTime;
    const k = MathUtils.clamp((clock.elapsedTime - born.current - delay) / 0.45, 0, 1);
    const ease = k === 1 ? 1 : 1 - Math.pow(1 - k, 3) + Math.sin(k * Math.PI) * 0.12;
    ref.current.scale.setScalar(Math.max(ease, 0.0001) * scale);
  });

  return (
    <group ref={ref} position={[x, y, z]}>
      {/* Nozzle: heat-tinted bell with cooling channels */}
      <mesh>
        <cylinderGeometry args={[0.22, 0.58, bellH, 40, 1, true]} />
        <meshStandardMaterial
          map={nozzleMap}
          color={hot ? PALETTE.gold : "#ffffff"}
          metalness={0.9}
          roughness={0.32}
          side={DoubleSide}
          envMapIntensity={1.4}
        />
      </mesh>
      {/* Inner wall, dark and sooty */}
      <mesh scale={0.985}>
        <cylinderGeometry args={[0.215, 0.572, bellH, 32, 1, true]} />
        <meshStandardMaterial color="#1a1612" metalness={0.5} roughness={0.8} side={DoubleSide} />
      </mesh>
      {/* Stiffening rings */}
      {[-0.35, 0.05, 0.42].map((dy) => {
        const r = 0.22 + ((dy + bellH / 2) / bellH) * 0.36;
        return (
          <mesh key={dy} position={[0, dy, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[r + 0.005, 0.014, 8, 36]} />
            <Steel hot={hot} color={SCENE_COLORS.titanium} />
          </mesh>
        );
      })}
      {/* Lip band */}
      <mesh position={[0, -bellH / 2 + 0.04, 0]}>
        <cylinderGeometry args={[0.592, 0.592, 0.08, 36, 1, true]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.4} side={DoubleSide} />
      </mesh>
      {/* Turbopump housing and gimbal actuators */}
      <mesh position={[0, bellH / 2 + 0.14, 0]}>
        <cylinderGeometry args={[0.27, 0.3, 0.28, 24]} />
        <Steel hot={hot} color={SCENE_COLORS.aluminum} rough={0.3} />
      </mesh>
      {[0, 1, 2].map((i) => {
        const a = (i * Math.PI * 2) / 3 + 0.4;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.3, bellH / 2 - 0.15, Math.cos(a) * 0.3]} rotation={[Math.cos(a) * 0.35, 0, -Math.sin(a) * 0.35]}>
            <cylinderGeometry args={[0.025, 0.025, 0.55, 8]} />
            <Steel hot={hot} color={SCENE_COLORS.steelLight} rough={0.3} />
          </mesh>
        );
      })}
    </group>
  );
}

function Engines({ hot, engine }: { hot: boolean; engine: EngineId }) {
  const { y0, y1, r } = STACK.engines;
  const layout = BELL_LAYOUT[engine];
  const s1 = skins().stage1;
  return (
    <group>
      {/* Thrust structure skirt */}
      <mesh position={[0, y1 - 0.3, 0]}>
        <cylinderGeometry args={[STACK.stage1.r, r, 0.6, 48]} />
        <Paint skin={s1} hot={hot} tint="#8a93a0" metalness={0.5} clearcoat={0} />
      </mesh>
      <mesh position={[0, y1 - 0.65, 0]}>
        <cylinderGeometry args={[r, r, 0.1, 48]} />
        <Steel hot={hot} />
      </mesh>
      {/* Heat-shield curtain: dark insulation blanket between skirt and bells */}
      <mesh position={[0, y1 - 0.8, 0]}>
        <cylinderGeometry args={[r - 0.05, r - 0.1, 0.16, 48, 1, true]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.95} side={DoubleSide} />
      </mesh>
      <group key={engine}>
        {layout.spots.map(([x, z], i) => (
          <Bell key={`${engine}-${x}-${z}`} x={x} z={z} scale={layout.scale} hot={hot} delay={i * 0.05} />
        ))}
      </group>
      {/* Four fins at 45 degrees with red tips */}
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <group key={i} position={[Math.sin(a) * 1.95, y1 - 0.2, Math.cos(a) * 1.95]} rotation={[0, a, 0]}>
            <mesh>
              <boxGeometry args={[0.12, 1.7, 0.9]} />
              <meshPhysicalMaterial color={SCENE_COLORS.spaceWhite} metalness={0.25} roughness={0.45} clearcoat={0.3} />
            </mesh>
            <mesh position={[0, 0.65, 0]}>
              <boxGeometry args={[0.124, 0.4, 0.92]} />
              <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.5} />
            </mesh>
          </group>
        );
      })}
      {/* Propellant feed lines running down into the skirt */}
      {[-0.72, 0.55].map((t) => (
        <group key={t} rotation={[0, facingTheta("floor") + t, 0]}>
          <mesh position={[0, (y0 + y1) / 2 + 0.55, r - 0.14]}>
            <cylinderGeometry args={[0.07, 0.07, 1.5, 14]} />
            <Steel hot={hot} color={SCENE_COLORS.aluminum} rough={0.25} />
          </mesh>
          {[0.15, 0.7].map((dy) => (
            <mesh key={dy} position={[0, y0 + 0.15 + dy + 0.35, r - 0.14]}>
              <torusGeometry args={[0.09, 0.025, 8, 18]} />
              <Steel hot={hot} color={SCENE_COLORS.steelDark} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/* ---------------------------------------------------------------- stage 1 and 2 */

function Band({
  r,
  y0,
  y1,
  color,
  theta = 0,
  arc = Math.PI * 2,
  rough = 0.5,
}: {
  r: number;
  y0: number;
  y1: number;
  color: string;
  theta?: number;
  arc?: number;
  rough?: number;
}) {
  const partial = arc < Math.PI * 2;
  return (
    <mesh position={[0, (y0 + y1) / 2, 0]}>
      <cylinderGeometry args={[r + 0.016, r + 0.016, y1 - y0, 48, 1, partial, theta, arc]} />
      <meshPhysicalMaterial color={color} roughness={rough} clearcoat={0.25} side={partial ? DoubleSide : undefined} />
    </mesh>
  );
}

/** Lettering wrapped onto the hull, centred at `theta`. */
function Decal({
  r,
  y,
  height,
  width,
  theta,
  map,
}: {
  r: number;
  y: number;
  height: number;
  width: number;
  theta: number;
  map: ReturnType<typeof makeLettering>;
}) {
  const arc = width / r;
  return (
    <mesh position={[0, y, 0]} renderOrder={2}>
      <cylinderGeometry args={[r + 0.022, r + 0.022, height, 24, 1, true, theta - arc / 2, arc]} />
      <meshStandardMaterial map={map} transparent roughness={0.5} polygonOffset polygonOffsetFactor={-2} depthWrite={false} side={DoubleSide} />
    </mesh>
  );
}

let lettering: { word: ReturnType<typeof makeLettering>; usa: ReturnType<typeof makeLettering> } | undefined;
function letters() {
  lettering ??= {
    word: makeLettering("MOONBOUND", { color: "#0b2a6b", font: "800 110px Arial, Helvetica, sans-serif", w: 128, h: 1100, vertical: true }),
    usa: makeLettering("USA", { color: "#c4281b", font: "800 110px Arial, Helvetica, sans-serif", w: 128, h: 380, vertical: true }),
  };
  return lettering;
}

function Stage1Tanks({ hot }: { hot: boolean }) {
  const { y0, y1, r } = STACK.stage1;
  const skin = skins().stage1;
  const l = letters();
  const front = facingTheta("floor");
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r, r, y1 - y0, 64]} />
        <Paint skin={skin} hot={hot} />
      </mesh>
      <Band r={r} y0={y0} y1={y0 + 0.7} color={SCENE_COLORS.nasaBlue} />
      {/* Roll pattern: alternating quarters so the rocket's spin reads on tracking cameras */}
      {[0, Math.PI].map((t) => (
        <Band key={t} r={r} y0={y0 + 0.7} y1={y0 + 2.4} color="#1a2230" theta={t} arc={Math.PI / 2} />
      ))}
      <Band r={r} y0={7.4} y1={7.7} color={SCENE_COLORS.nasaBlue} />
      <Band r={r} y0={7.7} y1={7.85} color={SCENE_COLORS.nasaRed} />
      <Band r={r} y0={y1 - 0.5} y1={y1} color="#1a2230" />

      <Decal r={r} y={9.35} height={2.95} width={0.36} theta={front - 0.32} map={l.word} />
      <Decal r={r} y={9.85} height={1.0} width={0.36} theta={front + 0.34} map={l.usa} />

      {/* Cable raceways and an access hatch */}
      {[front + 1.05, front - 1.15].map((t) => (
        <group key={t} rotation={[0, t, 0]}>
          <mesh position={[0, (y0 + y1) / 2 + 0.2, r + 0.05]}>
            <boxGeometry args={[0.16, y1 - y0 - 1.6, 0.1]} />
            <Steel color={SCENE_COLORS.steelLight} rough={0.5} />
          </mesh>
          {[4.6, 6.2, 7.9, 9.5, 11.0].map((yy) => (
            <mesh key={yy} position={[0, yy, r + 0.05]}>
              <boxGeometry args={[0.28, 0.1, 0.12]} />
              <Steel color={SCENE_COLORS.steelDark} />
            </mesh>
          ))}
        </group>
      ))}
      <group rotation={[0, front - 1.45, 0]}>
        <mesh position={[0, 5.4, r + 0.02]}>
          <boxGeometry args={[0.7, 0.9, 0.05]} />
          <meshStandardMaterial color="#cbd3dd" metalness={0.5} roughness={0.35} />
        </mesh>
        {[-0.28, 0.28].flatMap((x) => [-0.38, 0.38].map((y) => (
          <mesh key={`${x}${y}`} position={[x, 5.4 + y, r + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.03, 8]} />
            <Steel color={SCENE_COLORS.steelDark} />
          </mesh>
        )))}
      </group>
    </group>
  );
}

function Interstage({ hot }: { hot: boolean }) {
  const { y0, y1, r0, r1 } = STACK.interstage;
  const skin = skins().interstage;
  const boltRing = 28;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0, 64]} />
        <Paint skin={skin} hot={hot} tint="#b8c9ee" clearcoat={0.5} />
      </mesh>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[(r0 + r1) / 2 + 0.02, (r0 + r1) / 2 + 0.06, 0.22, 48]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.5} />
      </mesh>
      {/* Separation flange and its bolt ring */}
      <mesh position={[0, y0 + 0.22, 0]}>
        <cylinderGeometry args={[r0 + 0.04, r0 + 0.04, 0.16, 48]} />
        <Steel hot={hot} color={SCENE_COLORS.steelLight} rough={0.35} />
      </mesh>
      {Array.from({ length: boltRing }, (_, i) => {
        const a = (i / boltRing) * Math.PI * 2;
        return (
          <mesh key={i} position={[Math.sin(a) * (r0 + 0.075), y0 + 0.22, Math.cos(a) * (r0 + 0.075)]} rotation={[0, a, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.045, 6]} />
            <Steel hot={hot} color="#9ca3af" rough={0.25} />
          </mesh>
        );
      })}
      {/* Retro-rockets that push stage 1 clear */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2 + Math.PI / 4;
        return (
          <group key={i} position={[Math.sin(a) * (r0 + 0.1), y0 + 0.75, Math.cos(a) * (r0 + 0.1)]} rotation={[0, a, 0]}>
            <mesh>
              <cylinderGeometry args={[0.1, 0.12, 0.5, 14]} />
              <Steel hot={hot} color={SCENE_COLORS.steelDark} rough={0.5} />
            </mesh>
            <mesh position={[0, -0.28, 0]}>
              <cylinderGeometry args={[0.1, 0.06, 0.1, 14]} />
              <Steel color="#222" rough={0.6} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

function Stage2({ hot }: { hot: boolean }) {
  const { y0, y1, r } = STACK.stage2;
  const skin = skins().stage2;
  const front = facingTheta("level2");
  const flagMap = useTexture("/assets/murals/us_flag.png");
  flagMap.colorSpace = SRGBColorSpace;
  flagMap.anisotropy = 8;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r, r, y1 - y0, 64]} />
        <Paint skin={skin} hot={hot} />
      </mesh>
      <Band r={r} y0={y0} y1={y0 + 0.5} color={SCENE_COLORS.nasaBlue} />
      {[Math.PI / 2, (3 * Math.PI) / 2].map((t) => (
        <Band key={t} r={r} y0={y0 + 0.5} y1={y0 + 1.7} color="#1a2230" theta={t} arc={Math.PI / 2} />
      ))}
      <Band r={r} y0={y1 - 0.45} y1={y1} color={SCENE_COLORS.nasaBlue} />
      <Band r={r} y0={y1 - 0.62} y1={y1 - 0.5} color={SCENE_COLORS.nasaRed} />
      {/* Flag */}
      <group rotation={[0, front + 0.18, 0]}>
        <mesh position={[0, y0 + 3.3, r + 0.03]}>
          <planeGeometry args={[0.84, 0.84 * (650 / 1235)]} />
          <meshStandardMaterial map={flagMap} roughness={0.6} />
        </mesh>
      </group>
      {/* Umbilical plate */}
      <mesh position={[Math.sin(front - 0.8) * (r + 0.04), y0 + 2.2, Math.cos(front - 0.8) * (r + 0.04)]} rotation={[0, front - 0.8, 0]}>
        <boxGeometry args={[0.5, 0.7, 0.08]} />
        <Steel color={SCENE_COLORS.steelLight} rough={0.4} />
      </mesh>
    </group>
  );
}

/* ---------------------------------------------------------------- spacecraft */

function LanderInAdapter({ hot }: { hot: boolean }) {
  const { y0, y1, r0, r1 } = STACK.adapter;
  const windowArc = 1.5;
  const start = facingTheta("level3") + windowArc / 2;
  const body = hot ? PALETTE.gold : SCENE_COLORS.kaptonGold;
  const legs: [number, number][] = [[0.62, 0.62], [-0.62, 0.62], [0.62, -0.62], [-0.62, -0.62]];
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0, 48, 1, true, start, Math.PI * 2 - windowArc]} />
        <meshPhysicalMaterial color={hot ? PALETTE.gold : SCENE_COLORS.spaceWhite} roughness={0.4} clearcoat={0.3} side={DoubleSide} />
      </mesh>
      {[start - 0.05, start + Math.PI * 2 - windowArc].map((t) => (
        <mesh key={t} position={[0, (y0 + y1) / 2, 0]}>
          <cylinderGeometry args={[r1 + 0.01, r0 + 0.01, y1 - y0, 4, 1, true, t, 0.05]} />
          <meshBasicMaterial color={SCENE_COLORS.safetyYellow} side={DoubleSide} />
        </mesh>
      ))}
      {/* Lander: crinkled gold foil descent stage, white cabin, splayed legs */}
      <group position={[0, y0 + 0.2, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <cylinderGeometry args={[0.62, 0.62, 0.6, 8]} />
          <meshStandardMaterial color={body} metalness={0.95} roughness={0.22} envMapIntensity={1.6} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <boxGeometry args={[0.7, 0.6, 0.6]} />
          <meshPhysicalMaterial color={SCENE_COLORS.spaceWhite} metalness={0.3} roughness={0.35} clearcoat={0.4} />
        </mesh>
        <mesh position={[0, 1.3, 0.31]}>
          <planeGeometry args={[0.24, 0.18]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
        </mesh>
        {legs.map(([x, z]) => (
          <mesh key={`${x}${z}`} position={[x * 0.85, 0.25, z * 0.85]} rotation={[z * 0.5, 0, -x * 0.5]}>
            <cylinderGeometry args={[0.035, 0.035, 0.75, 8]} />
            <meshStandardMaterial color={SCENE_COLORS.solarGold} metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function ServiceModule({ hot }: { hot: boolean }) {
  const { y0, y1, r } = STACK.serviceModule;
  const t = facingTheta("level3");
  const skin = skins().service;
  return (
    <group>
      <mesh position={[0, (y0 + y1) / 2, 0]}>
        <cylinderGeometry args={[r, r, y1 - y0, 48]} />
        <Paint skin={skin} hot={hot} tint="#d6dce4" metalness={0.45} clearcoat={0.2} />
      </mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <Band key={i} r={r} y0={y0 + 0.2} y1={y1 - 0.5} color={SCENE_COLORS.nasaBlue} theta={(i * Math.PI) / 3} arc={0.35} rough={0.3} />
      ))}
      {[0, 1, 2, 3].map((i) => {
        const a = t + Math.PI / 4 + (i * Math.PI) / 2;
        return (
          <group key={i} position={[Math.sin(a) * (r + 0.08), y1 - 0.3, Math.cos(a) * (r + 0.08)]} rotation={[0, a, 0]}>
            <mesh>
              <boxGeometry args={[0.22, 0.22, 0.12]} />
              <Steel color={SCENE_COLORS.steelDark} rough={0.45} />
            </mesh>
            {[-0.05, 0.05].map((x) => (
              <mesh key={x} position={[x, 0, 0.09]} rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.03, 0.07, 10]} />
                <Steel color="#222" />
              </mesh>
            ))}
          </group>
        );
      })}
    </group>
  );
}

function CrewCapsule({ hot }: { hot: boolean }) {
  const { y0, y1, r0, r1 } = STACK.capsule;
  const t = facingTheta("level3");
  const skin = skins().capsule;
  return (
    <group>
      {/* Heat shield: charred ablator ring around the base */}
      <mesh position={[0, y0 + 0.03, 0]}>
        <cylinderGeometry args={[r0 + 0.045, r0 + 0.045, 0.1, 48]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.95} metalness={0.05} bumpScale={1} />
      </mesh>
      <mesh position={[0, y0 + 0.1, 0]}>
        <cylinderGeometry args={[r0 + 0.02, r0 + 0.02, 0.08, 48]} />
        <Steel hot={hot} color={SCENE_COLORS.steelDark} />
      </mesh>
      <mesh position={[0, (y0 + y1) / 2 + 0.08, 0]}>
        <cylinderGeometry args={[r1, r0, y1 - y0 - 0.16, 48]} />
        <Paint skin={skin} hot={hot} clearcoat={0.55} />
      </mesh>
      {/* Hatch window */}
      <mesh position={[Math.sin(t + 0.4) * 0.66, y0 + 0.75, Math.cos(t + 0.4) * 0.66]} rotation={[-0.45, t + 0.4, 0, "YXZ"]}>
        <planeGeometry args={[0.18, 0.18]} />
        <meshPhysicalMaterial color="#0a1a2e" metalness={0.6} roughness={0.05} clearcoat={1} />
      </mesh>
    </group>
  );
}

function EscapeTower({ hot }: { hot: boolean }) {
  const { y0, y1 } = STACK.tower;
  const trussTop = y0 + 1.4;
  const struts = hot ? PALETTE.gold : SCENE_COLORS.nasaRed;
  return (
    <group>
      {[[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, (y0 + trussTop) / 2, z]}>
          <cylinderGeometry args={[0.035, 0.035, trussTop - y0, 8]} />
          <meshStandardMaterial color={struts} roughness={0.45} metalness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, y0 + 0.7, 0]}>
        <boxGeometry args={[0.5, 0.05, 0.5]} />
        <meshStandardMaterial color={struts} roughness={0.45} />
      </mesh>
      <mesh position={[0, (trussTop + y1 - 0.6) / 2, 0]}>
        <cylinderGeometry args={[0.22, 0.24, y1 - 0.6 - trussTop, 24]} />
        <meshPhysicalMaterial color={hot ? PALETTE.gold : SCENE_COLORS.spaceWhite} roughness={0.4} clearcoat={0.4} />
      </mesh>
      <mesh position={[0, y1 - 0.3, 0]}>
        <coneGeometry args={[0.22, 0.6, 24]} />
        <meshStandardMaterial color={struts} roughness={0.45} />
      </mesh>
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return (
          <mesh key={i} position={[Math.sin(a) * 0.24, trussTop + 0.4, Math.cos(a) * 0.24]} rotation={[0.4, a, 0]}>
            <coneGeometry args={[0.08, 0.18, 10]} />
            <Steel color={SCENE_COLORS.steelDark} />
          </mesh>
        );
      })}
    </group>
  );
}
