"use client";

import { useEffect, useMemo, useRef, type MutableRefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Environment, useTexture } from "@react-three/drei";
import {
  AdditiveBlending,
  BackSide,
  CanvasTexture,
  Color,
  DoubleSide,
  MathUtils,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  type Group,
  type Mesh,
  type PointLight,
  type ShaderMaterial,
  type Sprite,
  type MeshBasicMaterial,
} from "three";
import {
  COMPRESS,
  CRITICAL_LEAD,
  FAIL_ABORT_AT,
  FAIL_BOOM_AT,
  FAIL_END_AT,
  insertionMet,
  TROUBLE_LEAD,
  altitudeKm,
  eventsBetween,
  formatMet,
  gForce,
  heating,
  skyBlend,
  speedKms,
  tilt,
  vibration,
  type AscentEvent,
  type AscentFailure,
} from "@/game/ascentFlight";
import { fx } from "@/game/fx";
import { MOVE_KEYS } from "@/game/input";
import { clearTrauma, stepShake } from "@/game/shake";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { seeded } from "@/lib/random";
import { SCENE_COLORS } from "@/lib/palette";

/** Live state shared between the 3D world and the DOM HUD. Mutated every frame, never React state. */
export interface AscentFlight {
  /** Mission elapsed time in seconds. */
  met: number;
  /**
   * ride: strapped in and climbing. trouble: something is going wrong (warnings, near real time).
   * failing: engines are out, the vehicle is tumbling. orbit: engines off, still buckled.
   * float: free in the cabin.
   */
  mode: "ride" | "trouble" | "failing" | "orbit" | "float";
  /** The player pressed "release harness". */
  released: boolean;
  /** Seconds spent in orbit, drives the slow sweep of Earth and sunrise. */
  orbitT: number;
  /** Seconds since the engines failed. */
  failT: number;
  /** Camera-flash strength 0..1 (stage separation, explosion), decays on its own. */
  flash: number;
  /** Master alarm is sounding: red light, flashing console. */
  alarm: boolean;
  /** The vehicle has been destroyed. */
  boom: boolean;
  /** 0..1: how much cloud the capsule is passing through right now. */
  cloud: number;
  /** 0..1: air-friction glow at the window. */
  heat: number;
  /** Clock times (seconds, scene clock) of one-off visuals, or -1. */
  sepAt: number;
  towerAt: number;
  /** Unit vector toward the sun in world space, and whether the Earth leaves it visible. */
  sun: Vector3;
  sunVisible: boolean;
}

export function createFlight(): AscentFlight {
  return {
    met: -0.001,
    mode: "ride",
    released: false,
    orbitT: 0,
    failT: 0,
    flash: 0,
    alarm: false,
    boom: false,
    cloud: 0,
    heat: 0,
    sepAt: -1,
    towerAt: -1,
    sun: new Vector3(0, 1, 0),
    sunVisible: true,
  };
}

/** Where the sun appears on screen, for the lens-flare overlay. x/y in -1..1. */
export interface SunScreen {
  x: number;
  y: number;
  visible: boolean;
}

interface AscentWorldProps {
  flight: MutableRefObject<AscentFlight>;
  orbitKm: number;
  failure?: AscentFailure;
  onEvent: (e: AscentEvent) => void;
  onEarthSeen: () => void;
  onFailureEnd?: () => void;
  onSun?: (s: SunScreen) => void;
}

/* Scale: the Earth is drawn 1:10 618 so it fits the draw distance; its apparent size from orbit
   still matches reality (angular radius ~70° at 190 km). Near-field scenery uses its own scale. */
const EARTH_R = 600;
const KM_TO_UNITS = EARTH_R / 6371;
/** Near-field scale: metres to scene units on the launch pad, and km to units while in the lower atmosphere. */
const PAD_SCALE = 0.35;
const LOW_KM = 60;
/**
 * Orients the Earth so the Florida coast (28°N, 80°W: the launch site) lies straight below the
 * capsule, instead of the texture's south pole. Sphere UVs put lon 0 on +X and 90°W on +Z.
 */
const EARTH_QUAT = (() => {
  const lon = (-80 * Math.PI) / 180;
  const lat = (28 * Math.PI) / 180;
  const site = new Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), -Math.cos(lat) * Math.sin(lon));
  const align = new Quaternion().setFromUnitVectors(site, new Vector3(0, -1, 0));
  const yaw = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5 + Math.PI);
  return yaw.multiply(align);
})();
/** Where the sun sits in the outside frame (unit vector). */
const SUN_COLOR = new Color(7, 6.2, 4.6);
const SUN_LOCAL = new Vector3(0.42, 0.06, -0.9).normalize();
const SPIN_AXIS = new Vector3(0, 1, 0);
const spinQ = new Quaternion();

/** Seated eye position and the window centre, in cabin coordinates (metres). */
const SEAT = new Vector3(0, 1.25, 0.35);
const WINDOW_CENTER = new Vector3(0, 1.5, -1.6);
const CABIN = { x: 1.5, yMin: 0.0, yMax: 2.3, zFront: -1.6, zBack: 1.6 };

export function AscentWorld({ flight, orbitKm, failure, onEvent, onEarthSeen, onFailureEnd, onSun }: AscentWorldProps) {
  const outside = useRef<Group>(null);
  const reduced = useReducedMotion();

  return (
    <>
      <Environment files="/assets/env/studio.hdr" environmentIntensity={0.22} />
      <FlightDirector
        flight={flight}
        orbitKm={orbitKm}
        failure={failure}
        onEvent={onEvent}
        onFailureEnd={onFailureEnd}
        outside={outside}
      />
      <group ref={outside}>
        <Outside flight={flight} orbitKm={orbitKm} />
      </group>
      <WindowFx flight={flight} reduced={reduced} />
      <Cabin flight={flight} orbitKm={orbitKm} reduced={reduced} failure={failure} />
      <CameraRig flight={flight} reduced={reduced} onEarthSeen={onEarthSeen} onSun={onSun} />
    </>
  );
}

/* ------------------------------------------------------------------ clock */

/** Advances the mission clock, fires timeline events once, and orients the outside world. */
function FlightDirector({
  flight,
  orbitKm,
  failure,
  onEvent,
  onFailureEnd,
  outside,
}: Pick<AscentWorldProps, "flight" | "orbitKm" | "failure" | "onEvent" | "onFailureEnd"> & {
  outside: MutableRefObject<Group | null>;
}) {
  const eventRef = useRef(onEvent);
  eventRef.current = onEvent;
  const endRef = useRef(onFailureEnd);
  endRef.current = onFailureEnd;
  const sent = useRef(new Set<string>());

  useFrame(({ clock }, raw) => {
    const dt = Math.min(Math.max(raw, 0), 0.1);
    const f = flight.current;
    const once = (key: string, run: () => void) => {
      if (sent.current.has(key)) return;
      sent.current.add(key);
      run();
    };
    const emit = (e: Omit<AscentEvent, "met">) => eventRef.current({ ...e, met: f.met });
    const fireTimeline = (from: number, to: number) => {
      for (const e of eventsBetween(from, to, orbitKm)) {
        if (e.id === "stageSep") f.sepAt = clock.elapsedTime;
        if (e.id === "towerJettison") f.towerAt = clock.elapsedTime;
        eventRef.current(e);
      }
    };

    if (f.mode === "ride") {
      const from = f.met;
      let next = f.met + dt * COMPRESS;
      if (failure) next = Math.min(next, failure.met - TROUBLE_LEAD);
      f.met = Math.min(insertionMet(orbitKm), next);
      fireTimeline(from, f.met);
      if (failure && f.met >= failure.met - TROUBLE_LEAD) {
        f.mode = "trouble";
        emit({ id: "warn", caution: true, kick: 0.3 });
      } else if (!failure && f.met >= insertionMet(orbitKm)) {
        f.mode = "orbit";
      }
    } else if (f.mode === "trouble" && failure) {
      // Near real time: the warnings need room to be felt.
      const from = f.met;
      f.met = Math.min(failure.met, f.met + dt * 1.6);
      fireTimeline(from, f.met);
      if (f.met >= failure.met - CRITICAL_LEAD)
        once("critical", () => {
          f.alarm = true;
          emit({ id: "warnCritical", caution: true, kick: 0.5 });
        });
      if (f.met >= failure.met) {
        f.mode = "failing";
        f.failT = 0;
        emit({ id: "engineFail", caution: true, kick: 0.9 });
      }
    } else if (f.mode === "failing") {
      f.failT += dt;
      if (f.failT >= FAIL_ABORT_AT) once("abort", () => emit({ id: "abort", caution: true, kick: 0.4 }));
      if (f.failT >= FAIL_BOOM_AT)
        once("boom", () => {
          f.boom = true;
          f.flash = 1;
          emit({ id: "boom", bang: true, kick: 1 });
        });
      if (f.failT >= FAIL_END_AT) once("end", () => endRef.current?.());
    } else {
      f.orbitT += dt;
    }
    f.flash = Math.max(0, f.flash - dt * (f.boom ? 0.45 : 1.6));

    const alt = altitudeKm(f.met, orbitKm);
    // Passing through a cloud deck at 2-3.5 km turns the window white for a moment.
    f.cloud =
      f.mode === "orbit" || f.mode === "float"
        ? 0
        : MathUtils.smoothstep(alt, 1.9, 2.5) * (1 - MathUtils.smoothstep(alt, 3.0, 3.6));
    f.heat = f.mode === "ride" || f.mode === "trouble" ? heating(f.met, orbitKm) : 0;

    if (outside.current) {
      // Pitch-over swings Earth into the window; a failing vehicle tumbles instead.
      const p = f.mode === "failing" ? f.failT : 0;
      outside.current.rotation.x = tilt(f.met) + 0.07 * p * p;
      outside.current.rotation.y = 0.05 * p * p;
      outside.current.rotation.z = 0.1 + 0.11 * p * p;
    }
  });
  return null;
}

/* ---------------------------------------------------------------- outside */

function makeRadial(stops: [number, string][], size = 512, extra?: (c: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const c = canvas.getContext("2d")!;
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [t, col] of stops) g.addColorStop(t, col);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  extra?.(c, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

const skyVertex = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const skyFragment = /* glsl */ `
  uniform sampler2D uStars;
  uniform float uBlend;
  uniform vec3 uSun;
  varying vec3 vDir;
  const float PI = 3.14159265;
  void main() {
    vec3 d = normalize(vDir);
    vec2 uv = vec2(atan(d.x, d.z) / (2.0 * PI) + 0.5, asin(clamp(d.y, -1.0, 1.0)) / PI + 0.5);
    vec3 stars = texture2D(uStars, uv).rgb * 3.2;
    float h = clamp(d.y, 0.0, 1.0);
    vec3 horizon = vec3(0.40, 0.64, 0.92);
    vec3 zenith = vec3(0.04, 0.16, 0.50);
    vec3 day = mix(horizon, zenith, pow(h, 0.55));
    // Below the horizon the pale haze of the ground; above it daylight fading out into the star field.
    day = mix(day, vec3(0.52, 0.70, 0.88), smoothstep(0.0, -0.25, d.y));
    // Dawn: a warm band along the horizon toward the sun and a hot glow around the disc.
    float sd = max(dot(d, uSun), 0.0);
    float band = (1.0 - smoothstep(0.0, 0.4, abs(d.y))) * pow(sd, 1.4);
    day += vec3(1.0, 0.55, 0.22) * (band * 0.95 + pow(sd, 10.0) * 0.5 + pow(sd, 140.0) * 2.5);
    vec3 col = mix(stars, day, uBlend);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const earthVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vN = normalize(mat3(modelMatrix) * normal);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;
const earthFragment = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  uniform vec3 uCam;
  uniform float uShift;
  uniform float uOpacity;
  uniform float uCloud;
  uniform float uRim;
  varying vec2 vUv;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(uCam - vWorld);
    float ndl = dot(N, uSun);
    float day = smoothstep(-0.10, 0.28, ndl);
    vec3 land = texture2D(uDay, vUv).rgb;
    float cl = texture2D(uClouds, vUv + vec2(uShift, 0.0)).r * uCloud;
    vec3 lit = land * (0.05 + 1.2 * max(ndl, 0.0));
    lit = mix(lit, vec3(0.9) * (0.1 + 1.0 * max(ndl, 0.0)), cl * 0.45);
    lit = mix(vec3(dot(lit, vec3(0.30, 0.59, 0.11))), lit, 1.4);
    vec3 night = texture2D(uNight, vUv).rgb * vec3(1.6, 1.15, 0.7) * 1.4;
    night *= (1.0 - cl * 0.8);
    vec3 col = mix(night + vec3(0.002, 0.004, 0.010), lit, day);
    // Warm band along the terminator, where sunrise light is reddened by the air.
    float twilight = smoothstep(-0.12, 0.0, ndl) * (1.0 - smoothstep(0.0, 0.22, ndl));
    col += vec3(0.9, 0.35, 0.12) * twilight * 0.45;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 4.0);
    col += vec3(0.20, 0.45, 1.0) * rim * uRim * (0.25 + 1.0 * smoothstep(-0.4, 0.5, ndl));
    gl_FragColor = vec4(col, uOpacity);
  }
`;
const atmoFragment = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uCam;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec3 N = normalize(vN);
    vec3 V = normalize(uCam - vWorld);
    float f = pow(1.0 - abs(dot(N, V)), 2.4);
    float sunSide = smoothstep(-0.45, 0.45, dot(N, uSun));
    vec3 col = mix(vec3(0.15, 0.35, 0.95), vec3(0.45, 0.72, 1.0), sunSide);
    gl_FragColor = vec4(col * f * (0.2 + 1.1 * sunSide), f * uOpacity);
  }
`;

/** Everything seen through the window: sky/stars, the real Earth, low clouds, the pad. */
function Outside({ flight, orbitKm }: { flight: MutableRefObject<AscentFlight>; orbitKm: number }) {
  const [day, night, clouds, stars] = useTexture(
    [
      "/assets/textures/earth_day_6k.jpg",
      "/assets/textures/earth_night_4k.jpg",
      "/assets/textures/earth_clouds_4k.jpg",
      "/assets/textures/milky_way_4k.jpg",
    ],
    (t) => {
      for (const tex of t) {
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = 16;
      }
    },
  );

  const skyMat = useRef<ShaderMaterial>(null);
  const earthMat = useRef<ShaderMaterial>(null);
  const atmoMat = useRef<ShaderMaterial>(null);
  const earth = useRef<Group>(null);
  const land = useRef<Mesh>(null);
  const landMat = useRef<MeshBasicMaterial>(null);
  const sun = useRef<Group>(null);
  const puffs = useRef<Group>(null);
  const root = useRef<Group>(null);
  const sunWorld = useMemo(() => new Vector3(), []);
  const camWorld = useMemo(() => new Vector3(), []);

  const earthUniforms = useMemo(
    () => ({
      uDay: { value: day },
      uNight: { value: night },
      uClouds: { value: clouds },
      uSun: { value: new Vector3(0, 1, 0) },
      uCam: { value: new Vector3() },
      uShift: { value: 0 },
      uOpacity: { value: 0 },
      uCloud: { value: 0 },
      uRim: { value: 0.1 },
    }),
    [day, night, clouds],
  );
  const atmoUniforms = useMemo(
    () => ({ uSun: { value: new Vector3(0, 1, 0) }, uCam: { value: new Vector3() }, uOpacity: { value: 0 } }),
    [],
  );
  const skyUniforms = useMemo(() => ({ uStars: { value: stars }, uBlend: { value: 1 }, uSun: { value: SUN_LOCAL } }), [stars]);

  // Ground seen from the pad: grass, coast, sea, hazy edge. Drawn once to a canvas.
  const landTex = useMemo(
    () =>
      makeRadial(
        [
          [0, "#3f7a4a"],
          [0.4, "#4d8556"],
          [0.62, "#7aa68a"],
          [0.85, "#8fb6d4"],
          [1, "#7fb0d8"],
        ],
        1024,
        (c, s) => {
          c.fillStyle = "#2c6ea8";
          c.beginPath();
          c.ellipse(s * 0.68, s * 0.42, s * 0.2, s * 0.34, 0.5, 0, Math.PI * 2);
          c.fill();
          c.fillStyle = "#cdbf94";
          c.beginPath();
          c.ellipse(s * 0.56, s * 0.5, s * 0.025, s * 0.2, 0.4, 0, Math.PI * 2);
          c.fill();
        },
      ),
    [],
  );
  const puffTex = useMemo(
    () =>
      makeRadial(
        [
          [0, "rgba(255,255,255,0.95)"],
          [0.45, "rgba(250,252,255,0.55)"],
          [1, "rgba(255,255,255,0)"],
        ],
        128,
      ),
    [],
  );
  const sunTex = useMemo(
    () =>
      makeRadial(
        [
          [0, "rgba(255,255,255,1)"],
          [0.08, "rgba(255,245,215,0.95)"],
          [0.3, "rgba(255,200,120,0.28)"],
          [1, "rgba(255,160,60,0)"],
        ],
        256,
      ),
    [],
  );

  const cloudData = useMemo(() => {
    const rand = seeded(11);
    return Array.from({ length: 45 }, () => {
      const a = rand() * Math.PI * 2;
      const r = 260 + rand() * 480;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, altKm: 0.7 + rand() * 9, size: 130 + rand() * 200 };
    });
  }, []);

  useFrame(({ camera, clock }) => {
    const f = flight.current;
    const alt = altitudeKm(f.met, orbitKm);
    const root_ = root.current;
    if (!root_) return;

    if (skyMat.current) skyMat.current.uniforms.uBlend.value = skyBlend(alt);

    // The real Earth: appears as the ground fades, centred straight below the capsule.
    const earthFade = MathUtils.smoothstep(alt, 10, 40);
    if (earth.current) {
      // Earth turns under the capsule: continents drift by and the terminator sweeps across.
      spinQ.setFromAxisAngle(SPIN_AXIS, (f.met * 0.0016 + f.orbitT * 0.035) % (Math.PI * 2));
      earth.current.quaternion.copy(spinQ).multiply(EARTH_QUAT);
      earth.current.visible = earthFade > 0.001;
      earth.current.position.y = -(EARTH_R + alt * KM_TO_UNITS);
    }
    root_.updateWorldMatrix(true, false);
    camera.getWorldPosition(camWorld);
    // Sun and view vectors in world space, from the outside frame's current orientation.
    sunWorld.copy(SUN_LOCAL).transformDirection(root_.matrixWorld);
    f.sun.copy(sunWorld);
    {
      // The Earth hides the sun below its horizon; from higher up that horizon dips further.
      const ratio = EARTH_R / (EARTH_R + alt * KM_TO_UNITS);
      f.sunVisible = SUN_LOCAL.y > -Math.sqrt(Math.max(0, 1 - ratio * ratio));
    }
    for (const m of [earthMat.current, atmoMat.current]) {
      if (!m) continue;
      m.uniforms.uSun.value.copy(sunWorld);
      m.uniforms.uCam.value.copy(camWorld);
      m.uniforms.uOpacity.value = earthFade;
    }
    if (earthMat.current) {
      earthMat.current.uniforms.uShift.value = clock.elapsedTime * 0.0006;
      // The 2K cloud map only holds up from far away; close in, the cloud layer fades out.
      earthMat.current.uniforms.uCloud.value = MathUtils.smoothstep(alt, 110, 190);
      earthMat.current.uniforms.uRim.value = 0.08 + 0.92 * MathUtils.smoothstep(alt, 70, 170);
    }

    if (sun.current) {
      sun.current.position.copy(SUN_LOCAL).multiplyScalar(780);
      sun.current.visible = f.sunVisible;
    }

    // Launch-site ground: scaled so the climb feels fast, gone by the time the Earth takes over.
    const groundFade = 1 - MathUtils.smoothstep(alt, 4, 22);
    if (land.current && landMat.current) {
      land.current.visible = groundFade > 0.01;
      land.current.position.y = -(110 * PAD_SCALE + alt * 60);
      landMat.current.opacity = groundFade;
    }

    // Low clouds streak past the window while climbing through the first ten kilometres.
    if (puffs.current) {
      puffs.current.visible = alt < LOW_KM;
      puffs.current.children.forEach((child, i) => {
        const p = cloudData[i];
        const y = (p.altKm - alt) * 60;
        const s = child as Sprite;
        s.position.set(p.x, y, p.z);
        s.visible = Math.abs(y) < 700;
      });
    }
  });

  return (
    <group ref={root}>
      {/* Sky dome with the Milky Way, centred on the camera. */}
      <mesh renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[850, 48, 32]} />
        <shaderMaterial
          ref={skyMat}
          vertexShader={skyVertex}
          fragmentShader={skyFragment}
          uniforms={skyUniforms}
          side={BackSide}
          depthWrite={false}
          depthTest={false}
        />
      </mesh>

      {/* Launch pad scenery and ground. */}
      <mesh ref={land} rotation={[-Math.PI / 2, 0, 0]} renderOrder={-5}>
        <circleGeometry args={[860, 64]} />
        <meshBasicMaterial ref={landMat} map={landTex} transparent depthWrite={false} />
      </mesh>
      <group ref={puffs}>
        {cloudData.map((p, i) => (
          <sprite key={i} scale={[p.size, p.size * 0.45, 1]}>
            <spriteMaterial map={puffTex} transparent depthWrite={false} opacity={0.7} />
          </sprite>
        ))}
      </group>

      {/* The real Earth, with its atmosphere. */}
      <group ref={earth} quaternion={EARTH_QUAT}>
        <mesh>
          <sphereGeometry args={[EARTH_R, 128, 96]} />
          <shaderMaterial
            ref={earthMat}
            vertexShader={earthVertex}
            fragmentShader={earthFragment}
            uniforms={earthUniforms}
            transparent
            depthWrite
          />
        </mesh>
        <mesh>
          <sphereGeometry args={[EARTH_R * 1.028, 96, 64]} />
          <shaderMaterial
            ref={atmoMat}
            vertexShader={earthVertex}
            fragmentShader={atmoFragment}
            uniforms={atmoUniforms}
            blending={AdditiveBlending}
            transparent
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* The sun: a hot disc that blooms hard as it clears the limb, plus its glow. */}
      <group ref={sun}>
        <mesh>
          <sphereGeometry args={[9, 24, 16]} />
          <meshBasicMaterial color={SUN_COLOR} toneMapped={false} />
        </mesh>
        <sprite scale={[150, 150, 1]}>
          <spriteMaterial map={sunTex} transparent depthWrite={false} blending={AdditiveBlending} opacity={0.55} />
        </sprite>
      </group>
      <SunLight />
    </group>
  );
}

/** Directional light from the sun's direction, expressed in the outside frame. */
function SunLight() {
  return <directionalLight position={SUN_LOCAL.clone().multiplyScalar(100).toArray()} intensity={2.4} color="#FFF1DC" />;
}

/* ------------------------------------------------------------ window effects */

/**
 * Everything that happens just outside the glass: speed streaks, cloud white-out, heating glow,
 * the spent first stage falling away and the escape tower firing past.
 */
function WindowFx({ flight, reduced }: { flight: MutableRefObject<AscentFlight>; reduced: boolean }) {
  const cloudMat = useRef<MeshBasicMaterial>(null);
  const heatMat = useRef<MeshBasicMaterial>(null);
  const streaks = useRef<Group>(null);
  const stage = useRef<Group>(null);
  const stageFlame = useRef<Mesh>(null);
  const tower = useRef<Group>(null);

  const heatTex = useMemo(
    () =>
      makeRadial(
        [
          [0, "rgba(255,120,40,0)"],
          [0.5, "rgba(255,140,50,0)"],
          [0.82, "rgba(255,150,60,0.5)"],
          [1, "rgba(255,225,160,0.95)"],
        ],
        256,
      ),
    [],
  );
  const streakData = useMemo(() => {
    const r = seeded(23);
    return Array.from({ length: 46 }, () => ({
      x: (r() - 0.5) * 5.6,
      z: -3 - r() * 7,
      phase: r() * 10,
      len: 0.5 + r() * 1.3,
      speed: 0.7 + r() * 0.6,
    }));
  }, []);

  useFrame(({ clock }) => {
    const f = flight.current;
    const t = clock.elapsedTime;
    if (cloudMat.current) cloudMat.current.opacity = f.cloud * 0.96;
    if (heatMat.current) heatMat.current.opacity = f.heat * (reduced ? 0.35 : 0.5 + 0.25 * Math.sin(t * 23) + 0.1 * Math.sin(t * 41));

    // Streaks of air rushing downward past the window while the atmosphere is thick.
    if (streaks.current) {
      const thick = f.mode === "ride" || f.mode === "trouble" ? 1 - MathUtils.smoothstep(f.met, 70, 190) : 0;
      const v = 2.5 + f.met * 0.18;
      streaks.current.visible = thick > 0.01;
      streaks.current.children.forEach((child, i) => {
        const d = streakData[i];
        const m = child as Mesh;
        m.position.set(d.x, 6 - ((d.phase + t * v * d.speed) % 11), d.z);
        m.scale.set(1, d.len, 1);
        (m.material as MeshBasicMaterial).opacity = 0.3 * thick;
      });
    }

    // First stage falls away after staging, engines still glowing, tumbling out of sight.
    if (stage.current) {
      const k = f.sepAt >= 0 ? t - f.sepAt : -1;
      stage.current.visible = k >= 0 && k < 9;
      if (stage.current.visible) {
        stage.current.position.set(0.7 + 0.35 * k, 0.8 - 0.55 * k * k - 0.5 * k, -9 - 4.5 * k);
        stage.current.rotation.set(0.15 + 0.22 * k, 0.1 * k, 0.28 * k);
        if (stageFlame.current) stageFlame.current.scale.y = Math.max(0.05, 1 - k * 0.14) * (1 + 0.2 * Math.sin(t * 40));
      }
    }

    // Escape tower motor: a bright streak that shoots up and away past the window.
    if (tower.current) {
      const k = f.towerAt >= 0 ? t - f.towerAt : -1;
      tower.current.visible = k >= 0 && k < 3.2;
      if (tower.current.visible) {
        tower.current.position.set(-0.6 - 1.3 * k, 0.9 + 8 * k, -5.5 - 16 * k);
        tower.current.rotation.set(0.5, 0, 0.1);
        tower.current.scale.setScalar(Math.max(0.2, 1 - k * 0.22));
      }
    }
  });

  return (
    <group>
      {/* Plates just outside the window opening: white-out and heating glow. */}
      <mesh position={[0, 1.475, -1.64]} renderOrder={5}>
        <planeGeometry args={[2.4, 1.05]} />
        <meshBasicMaterial ref={cloudMat} color="#f4f8ff" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.475, -1.63]} renderOrder={6}>
        <planeGeometry args={[2.4, 1.05]} />
        <meshBasicMaterial
          ref={heatMat}
          map={heatTex}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <group ref={streaks}>
        {streakData.map((_, i) => (
          <mesh key={i}>
            <planeGeometry args={[0.014, 1]} />
            <meshBasicMaterial color="#cfe6ff" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
          </mesh>
        ))}
      </group>

      <group ref={stage} visible={false}>
        <mesh>
          <cylinderGeometry args={[0.95, 0.95, 6, 20]} />
          <meshStandardMaterial color="#F1F5F9" roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.2, 0]}>
          <cylinderGeometry args={[0.96, 0.96, 0.7, 20]} />
          <meshStandardMaterial color="#10151c" roughness={0.6} />
        </mesh>
        <mesh position={[0, -3.2, 0]}>
          <cylinderGeometry args={[0.55, 0.85, 0.5, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
        </mesh>
        <mesh ref={stageFlame} position={[0, -4.4, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.6, 2.2, 14]} />
          <meshBasicMaterial color={new Color(3.2, 1.5, 0.5)} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      </group>

      <group ref={tower} visible={false}>
        <mesh>
          <cylinderGeometry args={[0.07, 0.12, 3.4, 8]} />
          <meshStandardMaterial color="#F8FAFC" roughness={0.4} />
        </mesh>
        <mesh position={[0, 1.8, 0]}>
          <coneGeometry args={[0.07, 0.4, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
        <mesh position={[0, -2.3, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.22, 2.4, 10]} />
          <meshBasicMaterial color={new Color(4, 2.2, 0.8)} transparent opacity={0.9} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}

/* ------------------------------------------------------------------ cabin */

function makeScreen(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return { canvas, texture };
}

/** The interior of the crew capsule: window wall, console, seats, crewmates and loose items. */
function Cabin({
  flight,
  orbitKm,
  reduced,
  failure,
}: {
  flight: MutableRefObject<AscentFlight>;
  orbitKm: number;
  reduced: boolean;
  failure?: AscentFailure;
}) {
  const w = CABIN.x;
  const h = CABIN.yMax;
  const d = CABIN.zBack - CABIN.zFront;
  const cz = (CABIN.zBack + CABIN.zFront) / 2;
  const win = { x: 1.2, bottom: 0.95, top: 2.0 };

  const wall = SCENE_COLORS.steelMid;
  const trim = SCENE_COLORS.steelDark;

  const flash = useRef<PointLight>(null);
  const warm = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const f = flight.current;
    const t = clock.elapsedTime;
    const burning = f.mode === "ride" || f.mode === "trouble";
    if (flash.current) {
      // Engine glow flickering up through the floor while burning, plus one-off flashes.
      const glow = burning ? (0.5 + 0.35 * Math.sin(t * 37) + 0.15 * Math.sin(t * 61)) * (0.5 + f.heat) : 0;
      flash.current.intensity = f.flash * (f.boom ? 30 : 14) + glow;
      flash.current.color.set(f.boom ? "#FFF2D8" : "#FFB066");
    }
    if (warm.current) {
      const l = warm.current;
      if (f.boom) {
        l.intensity = 0.15;
      } else if (f.alarm) {
        const on = Math.sin(t * 5.5) > 0;
        l.color.set(on ? "#ff3b24" : "#5a0d06");
        l.intensity = on ? 3.4 : 1.0;
      } else {
        l.color.set(f.heat > 0.3 ? "#FFD2A0" : "#FFE9C8");
        l.intensity = 2.6 + (burning ? 0.25 * Math.sin(t * 40) * vibration(f.met, orbitKm) : 0);
      }
    }
  });

  return (
    <group>
      <pointLight ref={warm} position={[0, 2.05, 0.3]} color="#FFE9C8" intensity={2.6} distance={6} decay={1.4} />
      <pointLight position={[0, 1.3, -1.3]} color="#8FB8FF" intensity={0.9} distance={4} decay={1.6} />
      <pointLight ref={flash} position={[0, 1.5, -1.4]} color="#FFB066" intensity={0} distance={7} decay={1.2} />
      <ambientLight intensity={0.35} />

      {/* floor, ceiling, side walls, back wall */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[w * 2, d]} />
        <meshStandardMaterial color="#1b2028" roughness={0.7} metalness={0.4} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, h, cz]}>
        <planeGeometry args={[w * 2, d]} />
        <meshStandardMaterial color={wall} roughness={0.8} side={DoubleSide} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * w, h / 2, cz]} rotation={[0, (-s * Math.PI) / 2, 0]}>
            <planeGeometry args={[d, h]} />
            <meshStandardMaterial color={wall} roughness={0.75} metalness={0.15} />
          </mesh>
          {/* handrail and a padded strip */}
          <mesh position={[s * (w - 0.06), 1.45, cz]}>
            <boxGeometry args={[0.05, 0.05, d - 0.4]} />
            <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[s * (w - 0.02), 0.95, cz]}>
            <boxGeometry args={[0.03, 0.5, d - 0.5]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, h / 2, CABIN.zBack]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[w * 2, h]} />
        <meshStandardMaterial color={wall} roughness={0.8} />
      </mesh>

      {/* Window wall: solid around a wide opening that looks out on the sky. */}
      <mesh position={[0, win.bottom / 2, CABIN.zFront]}>
        <boxGeometry args={[w * 2, win.bottom, 0.18]} />
        <meshStandardMaterial color={wall} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, (win.top + h) / 2, CABIN.zFront]}>
        <boxGeometry args={[w * 2, h - win.top, 0.18]} />
        <meshStandardMaterial color={wall} roughness={0.7} metalness={0.2} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * ((w + win.x) / 2), (win.bottom + win.top) / 2, CABIN.zFront]}>
          <boxGeometry args={[w - win.x, win.top - win.bottom, 0.18]} />
          <meshStandardMaterial color={wall} roughness={0.7} metalness={0.2} />
        </mesh>
      ))}
      {/* window frame */}
      {[
        [0, win.bottom, 2 * win.x + 0.12, 0.08],
        [0, win.top, 2 * win.x + 0.12, 0.08],
      ].map(([x, y, ww, hh], i) => (
        <mesh key={i} position={[x, y, CABIN.zFront + 0.07]}>
          <boxGeometry args={[ww, hh, 0.1]} />
          <meshStandardMaterial color={trim} metalness={0.7} roughness={0.35} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * win.x, (win.bottom + win.top) / 2, CABIN.zFront + 0.07]}>
          <boxGeometry args={[0.08, win.top - win.bottom + 0.08, 0.1]} />
          <meshStandardMaterial color={trim} metalness={0.7} roughness={0.35} />
        </mesh>
      ))}

      <Console flight={flight} orbitKm={orbitKm} failure={failure} />
      <Seats />
      <Harness flight={flight} reduced={reduced} />
      <FloatingItems flight={flight} />
    </group>
  );
}

function Console({
  flight,
  orbitKm,
  failure,
}: {
  flight: MutableRefObject<AscentFlight>;
  orbitKm: number;
  failure?: AscentFailure;
}) {
  const main = useMemo(() => makeScreen(512, 256), []);
  const side = useMemo(() => makeScreen(256, 256), []);
  const acc = useRef(0);

  useFrame(({ clock }, dt) => {
    acc.current += dt;
    if (acc.current < 0.2) return;
    acc.current = 0;
    const f = flight.current;
    const alt = altitudeKm(f.met, orbitKm);
    const c = main.canvas.getContext("2d")!;
    c.fillStyle = "#04121c";
    c.fillRect(0, 0, 512, 256);
    c.strokeStyle = "#0e3b52";
    c.lineWidth = 2;
    c.strokeRect(4, 4, 504, 248);
    c.font = "bold 22px monospace";
    c.fillStyle = "#7ee7ff";
    c.fillText("ASCENT", 18, 34);
    c.fillStyle = "#ffffff";
    c.font = "bold 44px monospace";
    c.fillText(formatMet(f.met), 18, 90);
    c.font = "26px monospace";
    c.fillStyle = "#5cf2a8";
    c.fillText(`ALT  ${alt.toFixed(alt < 100 ? 1 : 0).padStart(5)} km`, 18, 140);
    c.fillText(`VEL  ${speedKms(f.met, orbitKm).toFixed(2).padStart(5)} km/s`, 18, 176);
    c.fillStyle = "#ffc72c";
    c.fillText(`LOAD ${gForce(f.met, orbitKm).toFixed(1).padStart(5)} g`, 18, 212);
    // fuel/progress bar
    c.fillStyle = "#0e3b52";
    c.fillRect(330, 60, 160, 14);
    c.fillStyle = "#7ee7ff";
    c.fillRect(330, 60, 160 * Math.min(1, f.met / insertionMet(orbitKm)), 14);
    if (f.alarm || f.mode === "failing") {
      const blink = Math.sin(clock.elapsedTime * 7) > 0;
      c.fillStyle = blink ? "#c1121f" : "#4a0a10";
      c.fillRect(252, 98, 248, 142);
      c.fillStyle = "#ffffff";
      c.font = "bold 28px monospace";
      c.fillText("MASTER ALARM", 262, 134);
      c.font = "bold 20px monospace";
      c.fillText(
        failure?.code === "slow-climb"
          ? "THRUST < WEIGHT"
          : failure?.code === "wind-shear"
            ? "BENDING LOAD HIGH"
            : failure?.code === "lightning"
              ? "ELEC BUS TRANSIENT"
              : failure?.code === "structural"
                ? "Q > STRUCT LIMIT"
                : "STG2 PROPELLANT LOW",
        262,
        168,
      );
      c.fillText(f.mode === "failing" ? "ENGINE OUT" : "ABORT ARMED", 262, 200);
    }
    main.texture.needsUpdate = true;

    const s = side.canvas.getContext("2d")!;
    s.fillStyle = "#04121c";
    s.fillRect(0, 0, 256, 256);
    // attitude ball: a ring with a tilting horizon line
    const t = clock.elapsedTime;
    s.save();
    s.translate(128, 128);
    s.beginPath();
    s.arc(0, 0, 96, 0, Math.PI * 2);
    s.clip();
    s.rotate(Math.sin(t * 0.3) * 0.08 + tilt(f.met) * 0.2);
    s.fillStyle = "#2a78c8";
    s.fillRect(-100, -100, 200, 100 + tilt(f.met) * 80);
    s.fillStyle = "#6b4a2b";
    s.fillRect(-100, tilt(f.met) * 80, 200, 110);
    s.restore();
    s.strokeStyle = "#7ee7ff";
    s.lineWidth = 3;
    s.beginPath();
    s.arc(128, 128, 96, 0, Math.PI * 2);
    s.stroke();
    s.fillStyle = "#ffc72c";
    s.fillRect(108, 126, 40, 4);
    side.texture.needsUpdate = true;
  });

  // Row of status lamps and guarded toggles, blinking at slightly different rates.
  const lamps = useRef<(MeshBasicMaterial | null)[]>([]);
  useFrame(({ clock }) => {
    lamps.current.forEach((m, i) => {
      if (!m) return;
      const on = Math.sin(clock.elapsedTime * (1.1 + (i % 5) * 0.37) + i) > (i % 4 === 0 ? -0.2 : 0.4);
      const alarm = flight.current.alarm;
      const base = alarm
        ? i % 2 === 0
          ? SCENE_COLORS.nasaRed
          : SCENE_COLORS.screenAmber
        : i % 4 === 0
          ? SCENE_COLORS.screenAmber
          : i % 3 === 0
            ? SCENE_COLORS.nasaRed
            : SCENE_COLORS.screenGreen;
      m.color.set(alarm ? (Math.sin(clock.elapsedTime * 6 + i * 0.7) > 0 ? base : "#2a0d0a") : on ? base : "#1d2a24");
    });
  });

  return (
    <group position={[0, 0, CABIN.zFront]}>
      {/* dark housing under the window, topped by a slanted instrument face */}
      <mesh position={[0, 0.4, 0.18]}>
        <boxGeometry args={[2.9, 0.8, 0.3]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.17, 0.5]}>
        <boxGeometry args={[2.9, 0.34, 0.4]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} roughness={0.55} />
      </mesh>
      <group position={[0, 0.62, 0.52]} rotation={[-0.5, 0, 0]}>
        <mesh>
          <boxGeometry args={[2.9, 0.62, 0.05]} />
          <meshStandardMaterial color="#10151c" metalness={0.4} roughness={0.5} />
        </mesh>
        <mesh position={[-0.7, 0.03, 0.03]}>
          <planeGeometry args={[1.0, 0.5]} />
          <meshBasicMaterial map={main.texture} toneMapped={false} />
        </mesh>
        <mesh position={[0.1, 0.03, 0.03]}>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial map={side.texture} toneMapped={false} />
        </mesh>
        {Array.from({ length: 16 }, (_, i) => (
          <mesh key={i} position={[0.62 + (i % 4) * 0.14, 0.2 - Math.floor(i / 4) * 0.12, 0.03]}>
            <planeGeometry args={[0.07, 0.07]} />
            <meshBasicMaterial ref={(m) => void (lamps.current[i] = m)} color={SCENE_COLORS.screenGreen} />
          </mesh>
        ))}
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} position={[-1.3 + i * 0.1, -0.22, 0.05]}>
            <boxGeometry args={[0.035, 0.035, 0.06]} />
            <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        {/* big red abort handle */}
        <mesh position={[1.25, -0.1, 0.06]}>
          <boxGeometry args={[0.14, 0.1, 0.08]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.4} emissive={SCENE_COLORS.nasaRed} emissiveIntensity={0.3} />
        </mesh>
      </group>
    </group>
  );
}

function Seats() {
  const orange = "#F26B1D";
  return (
    <group>
      {[-0.95, 0, 0.95].map((x, i) => (
        <group key={x} position={[x, 0, 0.35]}>
          {/* seat pan, back, headrest */}
          <mesh position={[0, 0.5, 0.05]}>
            <boxGeometry args={[0.6, 0.12, 0.75]} />
            <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.9, 0.42]} rotation={[0.18, 0, 0]}>
            <boxGeometry args={[0.6, 0.8, 0.1]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.25, 0.1]}>
            <boxGeometry args={[0.08, 0.5, 0.08]} />
            <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.8} roughness={0.3} />
          </mesh>
          {i === 1 ? <PlayerLegs suit={orange} /> : <Crewmate suit={orange} index={i} />}
        </group>
      ))}
    </group>
  );
}

/** What you see of yourself when looking down: orange suit knees and white gloves. */
function PlayerLegs({ suit }: { suit: string }) {
  return (
    <group>
      {[-0.14, 0.14].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.66, -0.16]} rotation={[-0.2, 0, 0]}>
            <boxGeometry args={[0.2, 0.17, 0.6]} />
            <meshStandardMaterial color={suit} roughness={0.7} />
          </mesh>
          <mesh position={[x * 1.35, 0.72, -0.42]}>
            <boxGeometry args={[0.1, 0.1, 0.16]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** A suited crewmate strapped into the next seat, breathing slowly. */
function Crewmate({ suit, index }: { suit: string; index: number }) {
  const chest = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (chest.current) chest.current.scale.y = 1 + Math.sin(clock.elapsedTime * 1.6 + index) * 0.015;
  });
  return (
    <group position={[0, 0, 0]}>
      <group ref={chest}>
        <mesh position={[0, 0.88, 0.28]}>
          <boxGeometry args={[0.44, 0.52, 0.26]} />
          <meshStandardMaterial color={suit} roughness={0.7} />
        </mesh>
        {/* chest pack and NASA patch */}
        <mesh position={[0, 0.9, 0.14]}>
          <boxGeometry args={[0.22, 0.2, 0.04]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.13, 1.04, 0.145]}>
          <boxGeometry args={[0.09, 0.06, 0.01]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
        </mesh>
      </group>
      {/* helmet and visor */}
      <mesh position={[0, 1.31, 0.32]}>
        <sphereGeometry args={[0.2, 24, 18]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.35} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.31, 0.17]} scale={[1, 0.8, 0.5]}>
        <sphereGeometry args={[0.17, 20, 14]} />
        <meshStandardMaterial color="#1a1208" roughness={0.1} metalness={0.9} envMapIntensity={2} />
      </mesh>
      {/* arms resting forward and legs */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.27, 0.8, 0.1]} rotation={[-0.7, 0, 0]}>
            <boxGeometry args={[0.12, 0.42, 0.12]} />
            <meshStandardMaterial color={suit} roughness={0.7} />
          </mesh>
          <mesh position={[s * 0.14, 0.64, -0.14]} rotation={[-0.2, 0, 0]}>
            <boxGeometry args={[0.2, 0.17, 0.6]} />
            <meshStandardMaterial color={suit} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Harness webbing and buckle over your chest. After release it floats up and away. */
function Harness({ flight, reduced }: { flight: MutableRefObject<AscentFlight>; reduced: boolean }) {
  const group = useRef<Group>(null);
  const parts = useRef<(Group | null)[]>([]);
  const state = useMemo(
    () =>
      [0, 1, 2].map((i) => ({
        vel: new Vector3((i - 1) * 0.15, 0.25 + i * 0.05, -0.1 - i * 0.04),
        spin: new Vector3(0.6 - i * 0.5, 0.4, 0.3 + i * 0.3),
      })),
    [],
  );
  const base = useMemo(
    () => [
      { p: new Vector3(-0.17, 0.82, 0.18), r: new Vector3(0, 0, 0.35) },
      { p: new Vector3(0.17, 0.82, 0.18), r: new Vector3(0, 0, -0.35) },
      { p: new Vector3(0, 0.74, 0.1), r: new Vector3(0, 0, 0) },
    ],
    [],
  );
  const initial = useRef(false);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1);
    const f = flight.current;
    parts.current.forEach((g, i) => {
      if (!g) return;
      if (!initial.current) {
        g.position.copy(base[i].p);
        g.rotation.set(base[i].r.x, base[i].r.y, base[i].r.z);
      }
      if (f.released) {
        g.position.addScaledVector(state[i].vel, dt);
        g.position.y = Math.min(g.position.y, 2.1);
        g.rotation.x += state[i].spin.x * dt * (reduced ? 0.3 : 1);
        g.rotation.y += state[i].spin.y * dt * (reduced ? 0.3 : 1);
        g.rotation.z += state[i].spin.z * dt * (reduced ? 0.3 : 1);
      }
    });
    initial.current = true;
  });

  return (
    <group ref={group} position={[0, 0.0, 0.35]}>
      {[0, 1].map((i) => (
        <group key={i} ref={(g) => void (parts.current[i] = g)}>
          <mesh>
            <boxGeometry args={[0.07, 0.6, 0.012]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.9} />
          </mesh>
        </group>
      ))}
      <group ref={(g) => void (parts.current[2] = g)}>
        <mesh>
          <boxGeometry args={[0.1, 0.07, 0.03]} />
          <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.9} roughness={0.25} />
        </mesh>
      </group>
    </group>
  );
}

/** Loose gear that starts on the console and drifts apart once there is no gravity. */
function FloatingItems({ flight }: { flight: MutableRefObject<AscentFlight> }) {
  const refs = useRef<(Group | null)[]>([]);
  const items = useMemo(() => {
    const rand = seeded(5);
    return [
      { kind: "pencil", p: [-0.9, 1.05, -1.2] },
      { kind: "book", p: [-0.3, 1.05, -1.25] },
      { kind: "toy", p: [0.55, 1.05, -1.2] },
      { kind: "drop", p: [0.9, 1.05, -1.15] },
      { kind: "glove", p: [-1.2, 1.0, -1.0] },
    ].map((it) => ({
      ...it,
      vel: new Vector3((rand() - 0.5) * 0.18, 0.12 + rand() * 0.22, (rand() - 0.2) * 0.14),
      spin: new Vector3((rand() - 0.5) * 1.2, (rand() - 0.5) * 1.2, (rand() - 0.5) * 1.2),
    }));
  }, []);
  const ready = useRef(false);

  useFrame((_, raw) => {
    const dt = Math.min(raw, 0.1);
    const f = flight.current;
    const zeroG = f.mode === "orbit" || f.mode === "float" || f.mode === "failing";
    refs.current.forEach((g, i) => {
      if (!g) return;
      if (!ready.current) g.position.set(...(items[i].p as [number, number, number]));
      if (!zeroG) return;
      const it = items[i];
      g.position.addScaledVector(it.vel, dt);
      g.rotation.x += it.spin.x * dt;
      g.rotation.y += it.spin.y * dt;
      g.rotation.z += it.spin.z * dt;
      // Bounce softly off the cabin walls so nothing drifts out of the ship.
      for (const [axis, lo, hi] of [
        ["x", -CABIN.x + 0.15, CABIN.x - 0.15],
        ["y", 0.3, CABIN.yMax - 0.15],
        ["z", CABIN.zFront + 0.4, CABIN.zBack - 0.15],
      ] as const) {
        if (g.position[axis] < lo || g.position[axis] > hi) {
          g.position[axis] = MathUtils.clamp(g.position[axis], lo, hi);
          it.vel[axis] *= -0.8;
        }
      }
    });
    ready.current = true;
  });

  return (
    <group>
      {items.map((it, i) => (
        <group key={it.kind} ref={(g) => void (refs.current[i] = g)}>
          {it.kind === "pencil" && (
            <>
              <mesh>
                <cylinderGeometry args={[0.012, 0.012, 0.2, 8]} />
                <meshStandardMaterial color={SCENE_COLORS.safetyYellow} roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.11, 0]}>
                <coneGeometry args={[0.012, 0.03, 8]} />
                <meshStandardMaterial color="#d9b48f" />
              </mesh>
            </>
          )}
          {it.kind === "book" && (
            <mesh>
              <boxGeometry args={[0.2, 0.025, 0.28]} />
              <meshStandardMaterial color={SCENE_COLORS.nasaBlueBright} roughness={0.7} />
            </mesh>
          )}
          {it.kind === "toy" && (
            <>
              <mesh>
                <icosahedronGeometry args={[0.07, 1]} />
                <meshStandardMaterial color="#FFC72C" roughness={0.9} flatShading />
              </mesh>
              <mesh position={[0, 0.09, 0]}>
                <sphereGeometry args={[0.035, 12, 10]} />
                <meshStandardMaterial color="#FFE08A" roughness={0.9} />
              </mesh>
            </>
          )}
          {it.kind === "drop" && (
            <mesh>
              <sphereGeometry args={[0.05, 24, 18]} />
              <meshPhysicalMaterial color="#A6D8FF" transmission={0} transparent opacity={0.55} roughness={0.05} metalness={0} clearcoat={1} />
            </mesh>
          )}
          {it.kind === "glove" && (
            <mesh>
              <boxGeometry args={[0.1, 0.07, 0.17]} />
              <meshStandardMaterial color="#F8FAFC" roughness={0.7} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

/* ----------------------------------------------------------------- camera */

const DRAG = 0.0042;
const KEY_TURN = 1.6;

/**
 * The player's head. Seated and strapped in until the harness is released: look around within
 * limits while the whole cabin shakes with the rocket. After that, free-float with inertia.
 */
function CameraRig({
  flight,
  reduced,
  onEarthSeen,
  onSun,
}: {
  flight: MutableRefObject<AscentFlight>;
  reduced: boolean;
  onEarthSeen: () => void;
  onSun?: (s: SunScreen) => void;
}) {
  const onSunRef = useRef(onSun);
  onSunRef.current = onSun;
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const pos = useRef(SEAT.clone());
  const vel = useRef(new Vector3());
  const target = useRef({ yaw: 0, pitch: 0.06 });
  const cur = useRef({ yaw: 0, pitch: 0.06 });
  const keys = useRef(new Set<string>());
  const gaze = useRef(0);
  const seen = useRef(false);
  const floatStarted = useRef(false);
  const onSeen = useRef(onEarthSeen);
  onSeen.current = onEarthSeen;
  const tmp = useMemo(
    () => ({ fwd: new Vector3(), right: new Vector3(), acc: new Vector3(), to: new Vector3(), proj: new Vector3() }),
    [],
  );

  useEffect(() => {
    const el = gl.domElement;
    let dragging = false;
    let lx = 0;
    let ly = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = true;
      lx = e.clientX;
      ly = e.clientY;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      target.current.yaw += (e.clientX - lx) * DRAG;
      target.current.pitch += (e.clientY - ly) * DRAG;
      lx = e.clientX;
      ly = e.clientY;
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    const kd = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, button, [role='dialog']") || e.metaKey || e.ctrlKey || e.altKey) return;
      if (/^(Key[WASDQE]|Arrow(Up|Down|Left|Right)|ShiftLeft)$/.test(e.code)) {
        e.preventDefault();
        keys.current.add(e.code);
      }
    };
    const ku = (e: KeyboardEvent) => void keys.current.delete(e.code);
    const clear = () => keys.current.clear();
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    window.addEventListener("blur", clear);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", kd);
      window.removeEventListener("keyup", ku);
      window.removeEventListener("blur", clear);
    };
  }, [gl]);

  useEffect(
    () => () => {
      clearTrauma();
      fx.aberration = 0;
    },
    [],
  );

  useFrame((state, raw) => {
    const dt = Math.min(Math.max(raw, 0), 0.1);
    const f = flight.current;
    const k = keys.current;
    const t = state.clock.elapsedTime;
    const floating = f.mode === "float";

    // --- look ---
    const turn = KEY_TURN * dt;
    const arrowOnly = floating;
    const l = (c: string, alt: string) => k.has(c) || (!arrowOnly && k.has(alt));
    target.current.yaw += (l("ArrowLeft", "KeyA") ? turn : 0) - (l("ArrowRight", "KeyD") ? turn : 0);
    target.current.pitch += (l("ArrowUp", "KeyW") ? turn : 0) - (l("ArrowDown", "KeyS") ? turn : 0);
    if (floating) {
      target.current.pitch = MathUtils.clamp(target.current.pitch, -1.45, 1.45);
    } else {
      target.current.yaw = MathUtils.clamp(target.current.yaw, -1.0, 1.0);
      target.current.pitch = MathUtils.clamp(target.current.pitch, -0.85, 0.6);
    }
    const lk = reduced ? 1 : 1 - Math.exp(-14 * dt);
    cur.current.yaw = MathUtils.lerp(cur.current.yaw, target.current.yaw, lk);
    cur.current.pitch = MathUtils.lerp(cur.current.pitch, target.current.pitch, lk);

    // --- position ---
    fx.aberration = 0;
    let ox = 0;
    let oy = 0;
    let roll = 0;
    let pitchShake = 0;
    if (f.mode === "ride" || f.mode === "trouble" || f.mode === "failing") {
      let vib = vibration(f.met);
      if (f.mode === "trouble") vib = Math.max(vib, 0.4) + 0.3 * Math.abs(Math.sin(t * 2.7));
      if (f.mode === "failing") vib = f.boom ? 2.4 : 1.15 + 0.25 * Math.sin(t * 9);
      vib *= reduced ? 0.2 : 1;
      ox = vib * 0.011 * (Math.sin(t * 47) + 0.6 * Math.sin(t * 71.3));
      oy = vib * 0.015 * (Math.sin(t * 53.1) + 0.7 * Math.sin(t * 89));
      roll = vib * 0.012 * Math.sin(t * 31) + vib * 0.02 * Math.sin(t * 2.3);
      pitchShake = vib * 0.008 * Math.sin(t * 43);
      if (f.mode === "failing" && !reduced) {
        // The vehicle starts to tumble: the whole view swings.
        const ramp = Math.min(1, f.failT / 2.5);
        roll += 0.24 * Math.sin(f.failT * 1.6) * ramp;
        pitchShake += 0.07 * Math.sin(f.failT * 2.1) * ramp;
      }
      const g = f.mode === "failing" ? 0.2 : gForce(f.met);
      oy -= 0.012 * (g - 1);
      fx.aberration = Math.min(0.0025, vib * 0.0009);
      pos.current.copy(SEAT);
    } else if (!floating) {
      pos.current.copy(SEAT);
      pos.current.y += 0.015 * Math.sin(t * 0.7);
      pos.current.x += 0.01 * Math.sin(t * 0.5 + 1);
    } else {
      if (!floatStarted.current) {
        floatStarted.current = true;
        vel.current.set(0, 0.45, -0.1);
      }
      const fwd = ((k.has(MOVE_KEYS.forward) ? 1 : 0) - (k.has(MOVE_KEYS.back) ? 1 : 0)) as number;
      const side = ((k.has(MOVE_KEYS.right) ? 1 : 0) - (k.has(MOVE_KEYS.left) ? 1 : 0)) as number;
      const lift = (k.has("KeyE") ? 1 : 0) - (k.has("KeyQ") ? 1 : 0);
      const { yaw, pitch } = cur.current;
      tmp.fwd.set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      tmp.right.set(Math.cos(yaw), 0, -Math.sin(yaw));
      tmp.acc.set(0, lift, 0).addScaledVector(tmp.fwd, fwd).addScaledVector(tmp.right, side);
      vel.current.addScaledVector(tmp.acc, 2.2 * dt * (k.has(MOVE_KEYS.sprint) ? 1.8 : 1));
      vel.current.multiplyScalar(Math.exp(-0.55 * dt));
      if (vel.current.length() > 1.7) vel.current.setLength(1.7);
      pos.current.addScaledVector(vel.current, dt);
      // Cabin walls and the console under the window.
      const p = pos.current;
      const bounce = (axis: "x" | "y" | "z", lo: number, hi: number) => {
        if (p[axis] < lo || p[axis] > hi) {
          p[axis] = MathUtils.clamp(p[axis], lo, hi);
          vel.current[axis] *= -0.35;
        }
      };
      bounce("x", -CABIN.x + 0.3, CABIN.x - 0.3);
      bounce("y", 0.45, CABIN.yMax - 0.3);
      bounce("z", CABIN.zFront + 0.28, CABIN.zBack - 0.3);
      if (p.z < -0.75 && p.y < 1.2) {
        // console zone: float over it, not through it
        p.y = 1.2;
        vel.current.y = Math.max(0, vel.current.y);
      }
      oy = 0.01 * Math.sin(t * 0.8);
      pitchShake = 0;

      // Looking at Earth: close to the window and facing it for a couple of seconds.
      tmp.to.copy(WINDOW_CENTER).sub(p);
      const dist = tmp.to.length();
      tmp.to.normalize();
      const facing = tmp.fwd.dot(tmp.to);
      if (dist < 1.9 && facing > 0.8) gaze.current += dt;
      else gaze.current = Math.max(0, gaze.current - dt * 0.5);
      if (gaze.current > 2.2 && !seen.current) {
        seen.current = true;
        onSeen.current();
      }
    }

    const s = stepShake(dt, t, reduced);
    camera.position.set(pos.current.x + ox, pos.current.y + oy, pos.current.z);
    camera.rotation.set(
      cur.current.pitch + pitchShake + s.pitch * 2.2,
      cur.current.yaw + s.yaw * 2.2,
      roll + s.roll * 2.2,
      "YXZ",
    );

    // Where the sun is on screen (if the window lets it through), for the lens-flare overlay.
    camera.updateMatrixWorld();
    const d = f.sun;
    let visible = f.sunVisible && d.z < -0.02;
    if (visible) {
      const tt = (CABIN.zFront - camera.position.z) / d.z;
      const hx = camera.position.x + tt * d.x;
      const hy = camera.position.y + tt * d.y;
      visible = hx > -1.15 && hx < 1.15 && hy > 0.98 && hy < 1.97;
    }
    tmp.proj.copy(camera.position).addScaledVector(d, 200).project(camera);
    onSunRef.current?.({
      x: tmp.proj.x,
      y: tmp.proj.y,
      visible: visible && Math.abs(tmp.proj.x) < 1.1 && Math.abs(tmp.proj.y) < 1.1 && tmp.proj.z < 1,
    });
  });

  return null;
}
