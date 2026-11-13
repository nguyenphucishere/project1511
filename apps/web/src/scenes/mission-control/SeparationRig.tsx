"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  AdditiveBlending,
  BoxGeometry,
  CylinderGeometry,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Group,
  type Mesh,
  type PointLight,
} from "three";
import { bake, type BakePart } from "./bake";
import { span, since, useCues, type Cue } from "./Mechanics";
import {
  GEARS,
  GEAR_STATIONS,
  SEP_OPS,
  STATION,
  around,
  driveAngle,
  gearAngle,
  opTime,
} from "./separation";

/**
 * The machinery of a stage separation, built from the inside out: a gear-driven sequencer on the
 * inner wall of the skirt (motor, reduction train, cam drum with its followers, ratchet and pawl,
 * lockwire guillotine, status lamps), then on the ring itself the arming lamps, frangible bolts,
 * electrical umbilicals and propellant quick-disconnects, and on the outside the retention hooks,
 * shear pins, guide pins and spring pushers. Each follows the twenty-operation timetable in
 * `separation.ts`; everything reads the film clock so any cut finds it mid-motion.
 *
 * `side` is +1 when the skirt (and the sequencer) is above the ring, -1 when it is below.
 */

const OPS_CUES: Cue[] = SEP_OPS.filter((o) => o.sfx).map((o) => [
  o.t,
  o.sfx![0],
  o.sfx![1],
]);

const FLASH = new MeshBasicMaterial({
  color: "#fff1cf",
  toneMapped: false,
  blending: AdditiveBlending,
  transparent: true,
  depthWrite: false,
});
const ARC = new MeshBasicMaterial({
  color: "#9ec8ff",
  toneMapped: false,
  blending: AdditiveBlending,
  transparent: true,
  depthWrite: false,
});

const GEAR_THICK = 0.026;

function gearGeometry(
  radius: number,
  teeth: number,
  color: string,
  toothColor: string,
): BufferGeometry {
  const core = radius * 0.84;
  const th = (radius - core) * 1.1;
  const parts: BakePart[] = [
    {
      g: new CylinderGeometry(core, core, GEAR_THICK, 28),
      color,
      at: [0, 0, 0],
      rot: [Math.PI / 2, 0, 0],
    },
    {
      g: new CylinderGeometry(radius * 0.2, radius * 0.2, GEAR_THICK * 1.8, 10),
      color: "#c4cbd4",
      at: [0, 0, 0],
      rot: [Math.PI / 2, 0, 0],
    },
  ];
  const tooth = new BoxGeometry(
    ((2 * Math.PI * radius) / teeth) * 0.48,
    th,
    GEAR_THICK,
  );
  const m = new Matrix4();
  const q = new Quaternion();
  const axis = new Vector3(0, 0, 1);
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2;
    q.setFromAxisAngle(axis, a);
    m.compose(
      new Vector3(
        -Math.sin(a) * (core + th * 0.45),
        Math.cos(a) * (core + th * 0.45),
        0,
      ),
      q,
      new Vector3(1, 1, 1),
    );
    parts.push({
      g: tooth,
      color: toothColor,
      at: [0, 0, 0],
      matrix: m.clone(),
    });
  }
  // Lightening holes read as spokes: a few dark pins across big gears
  if (radius > 0.08) {
    const hole = new CylinderGeometry(
      radius * 0.12,
      radius * 0.12,
      GEAR_THICK * 1.05,
      10,
    );
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      parts.push({
        g: hole,
        color: "#1b1f26",
        at: [Math.cos(a) * radius * 0.5, Math.sin(a) * radius * 0.5, 0.002],
        rot: [Math.PI / 2, 0, 0],
      });
    }
  }
  return bake(parts);
}

const LAMP_OFF = 0x3a1612;
const LAMP_RED = 0xff3b2f;

export function SeparationRig({
  ignitionAt,
  at,
  y,
  r,
  side,
}: {
  ignitionAt: number | null;
  at: number;
  y: number;
  r: number;
  side: 1 | -1;
}) {
  const root = useRef<Group>(null);
  const lamp = useRef<PointLight>(null);
  const cues = useCues(at, OPS_CUES);

  const gearGeos = useMemo(
    () =>
      GEARS.map((g, i) =>
        gearGeometry(
          g.radius,
          g.teeth,
          i === 1 || i === 2 ? "#b0823f" : "#9aa5b1",
          i === 1 || i === 2 ? "#c99a52" : "#b7c0cb",
        ),
      ),
    [],
  );
  const ratchetGeo = useMemo(
    () => gearGeometry(0.045, 18, "#6f7885", "#8a94a1"),
    [],
  );

  // Mutable bits updated every frame
  const gears = useRef<(Group | null)[][]>([[], [], [], []]);
  const ratchets = useRef<(Group | null)[]>([]);
  const camDrums = useRef<(Group | null)[]>([]);
  const followers = useRef<(Mesh | null)[]>([]);
  const pawls = useRef<(Group | null)[]>([]);
  const motors = useRef<(Group | null)[]>([]);
  const blades = useRef<(Mesh | null)[]>([]);
  const wireHalves = useRef<(Group | null)[][]>([[], [], [], []]);
  const leds = useMemo(
    () =>
      Array.from({ length: 4 }, () =>
        Array.from(
          { length: 6 },
          () => new MeshBasicMaterial({ color: 0x1a1a1a, toneMapped: false }),
        ),
      ),
    [],
  );
  const lamps = useMemo(
    () =>
      Array.from(
        { length: 8 },
        () => new MeshBasicMaterial({ color: LAMP_OFF, toneMapped: false }),
      ),
    [],
  );
  const boltFlash = useRef<(Mesh | null)[]>([]);
  const boltHeads = useMemo(
    () =>
      Array.from(
        { length: 8 },
        () => new MeshBasicMaterial({ color: 0x8b95a1 }),
      ),
    [],
  );
  const umbPlugs = useRef<(Group | null)[]>([]);
  const umbSpark = useRef<(Mesh | null)[]>([]);
  const valveTops = useRef<(Group | null)[]>([]);
  const valveVapor = useRef<(Mesh | null)[]>([]);
  const hooks = useRef<(Group | null)[]>([]);
  const pinSnap = useRef<(Mesh | null)[]>([]);
  const pinFlash = useRef<(Mesh | null)[]>([]);
  const guidePins = useRef<(Mesh | null)[]>([]);
  const rods = useRef<(Mesh | null)[]>([]);

  useFrame(() => {
    const T = since(ignitionAt) - at;
    const on = T > -9.5 && T < 5;
    if (root.current) root.current.visible = on;
    if (lamp.current) lamp.current.intensity = on ? 4 : 0;
    if (!on) {
      cues(since(ignitionAt));
      return;
    }
    const theta = driveAngle(T);
    const pumpOn = T > opTime("pump-spin") && T < 0.4;
    const camK = span(T, opTime("cam-drum"), opTime("cam-drum") + 0.5);
    const pawlK = span(T, opTime("pawl-lift"), opTime("pawl-lift") + 0.25);
    const cutK = span(T, opTime("lockwire"), opTime("lockwire") + 0.12);
    const bladeBack = span(
      T,
      opTime("lockwire") + 0.12,
      opTime("lockwire") + 0.4,
    );

    for (let c = 0; c < 4; c++) {
      GEARS.forEach((_, i) => {
        const g = gears.current[c]![i];
        if (g) g.rotation.z = gearAngle(i, theta);
      });
      const motor = motors.current[c];
      if (motor)
        motor.position.set(
          -0.22 + (pumpOn ? Math.sin(T * 95 + c) * 0.0025 : 0),
          -0.1 + (pumpOn ? Math.cos(T * 83) * 0.002 : 0),
          0.08,
        );
      const cam = camDrums.current[c];
      if (cam) cam.rotation.z = gearAngle(4, theta);
      const f = followers.current[c];
      if (f)
        f.position.y =
          0.0 +
          0.075 +
          camK * 0.03 * (0.5 + 0.5 * Math.cos(gearAngle(4, theta) * 2));
      const ra = ratchets.current[c];
      if (ra) ra.rotation.z = -gearAngle(4, theta) * 0.9;
      const pw = pawls.current[c];
      if (pw) pw.rotation.z = -0.05 + pawlK * 0.62;
      const blade = blades.current[c];
      if (blade) blade.position.y = 0.3 - cutK * 0.1 + bladeBack * 0.1;
      const wl = wireHalves.current[c]![0];
      const wr = wireHalves.current[c]![1];
      if (wl) wl.rotation.z = cutK * 0.55;
      if (wr) wr.rotation.z = -cutK * 0.55;
      // Status lamps: dark, amber while it arms, green once the lockwire is cut
      for (let k = 0; k < 6; k++) {
        const mat = leds[c]![k]!;
        const at0 = opTime("sequencer-arm") + k * 0.06;
        if (T < at0) mat.color.setHex(0x1a1a1a);
        else if (T < opTime("lockwire") + 0.1)
          mat.color.setHex(Math.sin(T * 12 + k) > -0.6 ? 0xffb020 : 0x7a5210);
        else mat.color.setHex(0x37e08a);
      }
    }

    // Arming lamps round the ring
    lamps.forEach((m, i) =>
      m.color.setHex(T > opTime("arm-lamps") + i * 0.05 ? LAMP_RED : LAMP_OFF),
    );

    // Frangible bolts: a flash each, one after another round the ring
    for (let i = 0; i < 8; i++) {
      const k = (T - (opTime("frangible-bolts") + i * 0.07)) / 0.28;
      const fl = boltFlash.current[i];
      if (fl) {
        fl.visible = k > 0 && k < 1;
        if (fl.visible) fl.scale.setScalar(0.04 + Math.sin(k * Math.PI) * 0.26);
      }
      boltHeads[i]!.color.setHex(k > 0 ? 0x2a2523 : 0x8b95a1);
    }

    // Umbilicals pull out with a spark; the quick-disconnects part with a breath of vapour
    const umbK = span(T, opTime("umbilicals"), opTime("umbilicals") + 0.5);
    umbPlugs.current.forEach((p) => {
      if (p) p.position.z = 0.06 + umbK * 0.34;
    });
    umbSpark.current.forEach((s) => {
      if (!s) return;
      const k = (T - opTime("umbilicals") - 0.02) / 0.2;
      s.visible = k > 0 && k < 1;
      if (s.visible) s.scale.setScalar(0.02 + Math.sin(k * Math.PI) * 0.06);
    });
    const valveK = span(
      T,
      opTime("quick-disconnect"),
      opTime("quick-disconnect") + 0.35,
    );
    valveTops.current.forEach((v) => {
      if (v) v.position.y = side * (0.1 + valveK * 0.14);
    });
    valveVapor.current.forEach((v) => {
      if (!v) return;
      const k = (T - opTime("quick-disconnect") - 0.1) / 1.1;
      v.visible = k > 0 && k < 1;
      if (v.visible) {
        v.scale.setScalar(0.06 + k * 0.5);
        (v.material as MeshBasicMaterial).opacity = (1 - k) * 0.55;
        v.position.y = side * (0.1 + k * 0.3);
      }
    });

    // Hooks open with a small overshoot; their shear pins snap; guide pins draw back; pushers extend
    const hookK = span(T, opTime("hooks"), opTime("hooks") + 0.3);
    const overshoot = Math.sin(hookK * Math.PI) * 0.12;
    hooks.current.forEach((h, i) => {
      if (h)
        h.rotation.x = side * (hookK * 1.15 + overshoot) + (i === 0 ? 0 : 0);
    });
    pinSnap.current.forEach((p) => {
      if (p)
        p.position.z =
          0.04 +
          span(T, opTime("shear-pins"), opTime("shear-pins") + 0.2) * 0.16;
    });
    pinFlash.current.forEach((f) => {
      if (!f) return;
      const k = (T - opTime("shear-pins")) / 0.18;
      f.visible = k > 0 && k < 1;
      if (f.visible) f.scale.setScalar(0.03 + Math.sin(k * Math.PI) * 0.1);
    });
    const guideK = span(T, opTime("guide-pins"), opTime("guide-pins") + 0.4);
    guidePins.current.forEach((p) => {
      if (p) p.position.y = side * (0.1 + guideK * 0.38);
    });
    const pushK = span(T, opTime("pushers"), opTime("pushers") + 0.45);
    const recoil = span(T, 0, 0.5);
    rods.current.forEach((p) => {
      if (!p) return;
      const len = 0.1 + pushK * 0.34 + recoil * 0.1;
      p.scale.y = len / 0.3;
      p.position.y = -side * (len / 2);
    });
    cues(since(ignitionAt));
  });

  const yIn = side * 0.5;
  const Rw = r - 0.03;
  const gearStation = GEAR_STATIONS;

  return (
    <>
      {/* A work lamp inside the skirt, so the gears read in the dark of the upper atmosphere. It stays
        mounted (intensity 0 when idle) so switching it on never recompiles the scene's shaders. */}
      <pointLight
        ref={lamp}
        position={[0, y + yIn, 0]}
        color="#ffe2b0"
        intensity={0}
        distance={4.5}
        decay={1.6}
      />
      <group ref={root} position={[0, y, 0]} visible={false}>
        {/* ---- inside: the sequencer drives, one at each of four stations ---- */}
        {gearStation.map((a, c) => (
          <group
            key={c}
            position={[Math.sin(a) * Rw, yIn, Math.cos(a) * Rw]}
            rotation={[0, a + Math.PI, 0]}
          >
            {/* Back plate, rails and the box that holds the status lamps */}
            <mesh position={[0, 0, 0.012]}>
              <boxGeometry args={[0.66, 0.5, 0.024]} />
              <meshStandardMaterial
                color="#23272e"
                metalness={0.6}
                roughness={0.5}
              />
            </mesh>
            {[-0.3, 0.3].map((x) =>
              [-0.22, 0.22].map((yy) => (
                <mesh
                  key={`${x}${yy}`}
                  position={[x, yy, 0.03]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.012, 0.012, 0.02, 6]} />
                  <meshStandardMaterial
                    color="#c4cbd4"
                    metalness={0.9}
                    roughness={0.3}
                  />
                </mesh>
              )),
            )}
            <mesh position={[0, 0.215, 0.05]}>
              <boxGeometry args={[0.6, 0.06, 0.06]} />
              <meshStandardMaterial
                color="#14171c"
                metalness={0.5}
                roughness={0.5}
              />
            </mesh>
            {leds[c]!.map((mat, k) => (
              <mesh
                key={k}
                position={[-0.22 + k * 0.088, 0.215, 0.083]}
                material={mat}
              >
                <boxGeometry args={[0.04, 0.025, 0.012]} />
              </mesh>
            ))}

            {/* The motor and its drive shaft */}
            <group
              ref={(el) => (motors.current[c] = el)}
              position={[-0.22, -0.1, 0.08]}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.02]}>
                <cylinderGeometry args={[0.055, 0.055, 0.11, 16]} />
                <meshStandardMaterial
                  color="#2f343c"
                  metalness={0.8}
                  roughness={0.35}
                />
              </mesh>
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.045]}>
                <cylinderGeometry args={[0.04, 0.04, 0.03, 14]} />
                <meshStandardMaterial
                  color="#b0823f"
                  metalness={0.9}
                  roughness={0.28}
                />
              </mesh>
            </group>

            {/* The gear train: pinion, compound pair, big gear, output gear */}
            {GEARS.map((g, i) => (
              <group key={i} position={[g.x, g.y, g.z]}>
                <group ref={(el) => (gears.current[c]![i] = el)}>
                  <mesh geometry={gearGeos[i]}>
                    <meshStandardMaterial
                      vertexColors
                      metalness={0.85}
                      roughness={0.32}
                    />
                  </mesh>
                </group>
              </group>
            ))}

            {/* Cam drum on the output shaft, with its follower rod */}
            <group position={[GEARS[4]!.x, GEARS[4]!.y, 0.19]}>
              <group ref={(el) => (camDrums.current[c] = el)}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.04, 0.04, 0.05, 20]} />
                  <meshStandardMaterial
                    color="#c99a52"
                    metalness={0.9}
                    roughness={0.3}
                  />
                </mesh>
                <mesh position={[0, 0.045, 0]}>
                  <boxGeometry args={[0.05, 0.028, 0.05]} />
                  <meshStandardMaterial
                    color="#c99a52"
                    metalness={0.9}
                    roughness={0.3}
                  />
                </mesh>
              </group>
              <mesh
                ref={(el) => (followers.current[c] = el)}
                position={[0, 0.075, 0]}
              >
                <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
                <meshStandardMaterial
                  color="#d7dde5"
                  metalness={0.9}
                  roughness={0.25}
                />
              </mesh>
            </group>

            {/* Ratchet wheel and its pawl */}
            <group position={[0.23, -0.15, 0.1]}>
              <group ref={(el) => (ratchets.current[c] = el)}>
                <mesh geometry={ratchetGeo}>
                  <meshStandardMaterial
                    vertexColors
                    metalness={0.8}
                    roughness={0.35}
                  />
                </mesh>
              </group>
            </group>
            <group
              ref={(el) => (pawls.current[c] = el)}
              position={[0.15, -0.2, 0.1]}
            >
              <mesh position={[0.04, 0.02, 0]} rotation={[0, 0, 0.6]}>
                <boxGeometry args={[0.1, 0.018, 0.022]} />
                <meshStandardMaterial
                  color="#d7dde5"
                  metalness={0.9}
                  roughness={0.25}
                />
              </mesh>
            </group>

            {/* Lockwire across the top, with the guillotine over it */}
            <group position={[0, 0.17, 0.07]}>
              <group ref={(el) => (wireHalves.current[c]![0] = el)}>
                <mesh position={[-0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.24, 6]} />
                  <meshStandardMaterial
                    color="#e0c27a"
                    metalness={0.8}
                    roughness={0.3}
                  />
                </mesh>
              </group>
              <group ref={(el) => (wireHalves.current[c]![1] = el)}>
                <mesh position={[0.12, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.24, 6]} />
                  <meshStandardMaterial
                    color="#e0c27a"
                    metalness={0.8}
                    roughness={0.3}
                  />
                </mesh>
              </group>
              <mesh
                ref={(el) => (blades.current[c] = el)}
                position={[0, 0.3, 0]}
              >
                <boxGeometry args={[0.07, 0.07, 0.012]} />
                <meshStandardMaterial
                  color="#e5e9ee"
                  metalness={0.95}
                  roughness={0.15}
                />
              </mesh>
            </group>
          </group>
        ))}

        {/* A structural ring frame behind the drives, with gussets */}
        <mesh position={[0, side * 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[r - 0.06, 0.035, 6, 48]} />
          <meshStandardMaterial
            color="#6f7885"
            metalness={0.8}
            roughness={0.4}
          />
        </mesh>
        {Array.from({ length: 16 }, (_, i) => {
          const a = around(i, 16);
          return (
            <mesh
              key={i}
              position={[
                Math.sin(a) * (r - 0.1),
                side * 0.2,
                Math.cos(a) * (r - 0.1),
              ]}
              rotation={[0, a, 0]}
            >
              <boxGeometry args={[0.03, 0.18, 0.08]} />
              <meshStandardMaterial
                color="#59616d"
                metalness={0.7}
                roughness={0.45}
              />
            </mesh>
          );
        })}

        {/* ---- on the ring: arming lamps, frangible bolts ---- */}
        {lamps.map((m, i) => {
          const a = around(i, 8, 0.2);
          return (
            <mesh
              key={i}
              position={[
                Math.sin(a) * (r + 0.045),
                side * 0.09,
                Math.cos(a) * (r + 0.045),
              ]}
              material={m}
            >
              <sphereGeometry args={[0.022, 8, 6]} />
            </mesh>
          );
        })}
        {boltHeads.map((m, i) => {
          const a = around(i, 8, 0.0);
          return (
            <group
              key={i}
              position={[Math.sin(a) * (r + 0.04), 0, Math.cos(a) * (r + 0.04)]}
              rotation={[0, a, 0]}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]} material={m}>
                <cylinderGeometry args={[0.04, 0.04, 0.05, 8]} />
              </mesh>
              <mesh
                ref={(el) => (boltFlash.current[i] = el)}
                position={[0, 0, 0.05]}
                material={FLASH}
                visible={false}
              >
                <sphereGeometry args={[1, 10, 8]} />
              </mesh>
            </group>
          );
        })}

        {/* Electrical umbilical plates: a plug pulls out of each, a spark at the break */}
        {STATION.umbilical.map((a, i) => (
          <group
            key={i}
            position={[Math.sin(a) * r, side * 0.1, Math.cos(a) * r]}
            rotation={[0, a, 0]}
          >
            <mesh position={[0, 0, 0.03]}>
              <boxGeometry args={[0.26, 0.34, 0.05]} />
              <meshStandardMaterial
                color="#2b3038"
                metalness={0.7}
                roughness={0.45}
              />
            </mesh>
            {[-0.07, 0.07].map((x) => (
              <mesh
                key={x}
                position={[x, 0, 0.06]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.035, 0.035, 0.02, 10]} />
                <meshStandardMaterial
                  color="#b0823f"
                  metalness={0.9}
                  roughness={0.28}
                />
              </mesh>
            ))}
            <group
              ref={(el) => (umbPlugs.current[i] = el)}
              position={[0, 0, 0.06]}
            >
              <mesh position={[0, 0, 0.05]}>
                <boxGeometry args={[0.2, 0.1, 0.1]} />
                <meshStandardMaterial
                  color="#14171c"
                  metalness={0.5}
                  roughness={0.5}
                />
              </mesh>
              {/* A heavy cable hanging from the plug */}
              <mesh position={[0, -side * 0.25, 0.06]}>
                <cylinderGeometry args={[0.02, 0.02, 0.5, 6]} />
                <meshStandardMaterial color="#14171c" roughness={0.7} />
              </mesh>
            </group>
            <mesh
              ref={(el) => (umbSpark.current[i] = el)}
              position={[0, 0, 0.14]}
              material={ARC}
              visible={false}
            >
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          </group>
        ))}

        {/* Propellant quick-disconnects: two fittings that part, a breath of vapour */}
        {STATION.valve.map((a, i) => (
          <group
            key={i}
            position={[Math.sin(a) * (r + 0.02), 0, Math.cos(a) * (r + 0.02)]}
            rotation={[0, a, 0]}
          >
            <mesh position={[0, -side * 0.1, 0.05]}>
              <cylinderGeometry args={[0.055, 0.055, 0.14, 12]} />
              <meshStandardMaterial
                color="#b9c0c9"
                metalness={0.85}
                roughness={0.3}
              />
            </mesh>
            <mesh position={[0, -side * 0.1, 0.05]}>
              <torusGeometry args={[0.06, 0.012, 6, 14]} />
              <meshStandardMaterial color="#c1121f" roughness={0.5} />
            </mesh>
            <group
              ref={(el) => (valveTops.current[i] = el)}
              position={[0, side * 0.1, 0.05]}
            >
              <mesh>
                <cylinderGeometry args={[0.05, 0.05, 0.14, 12]} />
                <meshStandardMaterial
                  color="#9aa5b1"
                  metalness={0.85}
                  roughness={0.3}
                />
              </mesh>
            </group>
            <mesh
              ref={(el) => (valveVapor.current[i] = el)}
              position={[0, side * 0.1, 0.12]}
              visible={false}
            >
              <sphereGeometry args={[1, 10, 8]} />
              <meshBasicMaterial
                color="#f4f8ff"
                transparent
                opacity={0.5}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}

        {/* ---- outside: hooks, shear pins, guide pins and pushers ---- */}
        {STATION.hook.map((a, i) => (
          <group
            key={i}
            position={[Math.sin(a) * (r + 0.02), 0, Math.cos(a) * (r + 0.02)]}
            rotation={[0, a, 0]}
          >
            <mesh position={[0, -side * 0.12, 0.08]}>
              <boxGeometry args={[0.3, 0.16, 0.14]} />
              <meshStandardMaterial
                color="#59616d"
                metalness={0.8}
                roughness={0.4}
              />
            </mesh>
            <group
              ref={(el) => (hooks.current[i] = el)}
              position={[0, 0, 0.14]}
            >
              <mesh position={[0, side * 0.09, 0.02]}>
                <boxGeometry args={[0.2, 0.2, 0.05]} />
                <meshStandardMaterial
                  color="#d7dde5"
                  metalness={0.9}
                  roughness={0.25}
                />
              </mesh>
              <mesh position={[0, side * 0.2, 0.06]}>
                <boxGeometry args={[0.2, 0.05, 0.09]} />
                <meshStandardMaterial
                  color="#d7dde5"
                  metalness={0.9}
                  roughness={0.25}
                />
              </mesh>
            </group>
            {/* Shear pin beside the hook */}
            <mesh
              ref={(el) => (pinSnap.current[i] = el)}
              position={[0.2, 0, 0.04]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[0.014, 0.014, 0.08, 6]} />
              <meshStandardMaterial
                color="#e0c27a"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
            <mesh
              ref={(el) => (pinFlash.current[i] = el)}
              position={[0.2, 0, 0.09]}
              material={FLASH}
              visible={false}
            >
              <sphereGeometry args={[1, 8, 6]} />
            </mesh>
          </group>
        ))}
        {STATION.guidePin.map((a, i) => (
          <mesh
            key={i}
            ref={(el) => (guidePins.current[i] = el)}
            position={[
              Math.sin(a) * (r + 0.03),
              side * 0.1,
              Math.cos(a) * (r + 0.03),
            ]}
          >
            <cylinderGeometry args={[0.022, 0.03, 0.7, 8]} />
            <meshStandardMaterial
              color="#e5e9ee"
              metalness={0.95}
              roughness={0.2}
            />
          </mesh>
        ))}
        {STATION.pusher.map((a, i) => (
          <group
            key={i}
            position={[Math.sin(a) * (r + 0.05), 0, Math.cos(a) * (r + 0.05)]}
            rotation={[0, a, 0]}
          >
            <mesh position={[0, side * 0.17, 0.05]}>
              <cylinderGeometry args={[0.06, 0.06, 0.26, 12]} />
              <meshStandardMaterial
                color="#2f343c"
                metalness={0.8}
                roughness={0.35}
              />
            </mesh>
            <group position={[0, 0, 0.05]}>
              <mesh ref={(el) => (rods.current[i] = el)}>
                <cylinderGeometry args={[0.03, 0.03, 0.3, 10]} />
                <meshStandardMaterial
                  color="#e5e9ee"
                  metalness={0.95}
                  roughness={0.2}
                />
              </mesh>
            </group>
          </group>
        ))}
      </group>
    </>
  );
}
