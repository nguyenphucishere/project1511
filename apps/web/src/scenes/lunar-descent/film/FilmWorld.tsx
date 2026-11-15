"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { BackSide, Color, PerspectiveCamera, SRGBColorSpace, type DirectionalLight, type Group, type Mesh } from "three";
import { Earth } from "@/components/viewport/Earth";
import { useSceneStore, type CameraRig } from "@/game/sceneStore";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { Warmup } from "../../mission-control/Warmup";
import { Dust } from "./Dust";
import { Columbia, LunarModule, Terrain, makeMoonscape } from "./Models";
import { MOON_COLOR, MOON_NORMAL } from "../../assets";
import { filmClock } from "./clock";
import { FILM_SECONDS, readout, type FilmPart } from "./script";

type V3 = [number, number, number];

const MILKY_TINT = new Color(2.2, 2.3, 2.7);
const FT = 0.3048;

/** The crater the crew aims for in the approach: a bowl ringed with boulders, ahead of the lander. */
const WEST_CRATER = { x: 40, z: -1750, r: 190 };
const FAR = makeMoonscape(11, 12000, 130, 40, 420, [WEST_CRATER]);
const NEAR = makeMoonscape(23, 140, 14, 2, 14, [], 8);

/** Where each kind of shot is set: in orbit over a small Moon, high over the plain, or on the plain beside Eagle. */
type Set = "orbit" | "plain" | "ground";

interface Shot {
  set: Set;
  pos: V3;
  aim: V3;
  fov: number;
  shake: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * Math.min(1, Math.max(0, k));
const mix = (a: V3, b: V3, k: number): V3 => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
const smooth = (k: number) => {
  const x = Math.min(1, Math.max(0, k));
  return x * x * (3 - 2 * x);
};

/** Where Eagle and Columbia are, for the orbit set (the Moon is a sphere of radius 300 under them). */
export function orbitActors(t: number) {
  const apart = t < 10 ? 11 + t * 1.25 : 23.5 + (t - 10) * 0.1;
  return { columbia: [0, 0, 0] as V3, eagle: [apart, 0, 0] as V3 };
}

/** The camera for each moment of each film. */
export function shotAt(part: FilmPart, t: number): Shot {
  if (part === "approach") {
    if (t < 10) {
      const k = t / 10;
      return { set: "orbit", pos: mix([-16, 7, 34], [-4, 5, 30], k), aim: mix([6, 0, 0], [16, 0, 0], k), fov: 40, shake: 0.01 };
    }
    if (t < 20) {
      const k = smooth((t - 10) / 10);
      return { set: "orbit", pos: mix([-4, 5, 30], [44, 26, 74], k), aim: mix([16, 0, 0], [10, -14, 0], k), fov: 46, shake: 0.01 };
    }
    if (t < 36) {
      // The burn: a chase view from beside and a little below the lander, the Moon sliding past underneath.
      const k = (t - 20) / 16;
      return { set: "orbit", pos: mix([-20, -3, 17], [-12, 4, 14], k), aim: [0, 0, 0], fov: 42, shake: 0.05 };
    }
    if (t < 48) {
      // A close shot of the lander while the alarm sounds, the Moon streaming under it.
      const k = (t - 36) / 12;
      return { set: "orbit", pos: mix([-9, 2, 9], [-6, -0.5, 7], k), aim: [0, 0.5, 0], fov: 50, shake: 0.1 };
    }
    // Over the plain, descending.
    const alt = readout(Math.min(t, 74)).altFt * FT;
    const u = t - 48;
    const z = -u * 62;
    const look = 0.45 + 0.5 * smooth((t - 48) / 18);
    return { set: "plain", pos: [0, alt, z], aim: [0, alt - 900 * look, z - 900], fov: 62, shake: 0.12 + 0.2 * smooth((t - 60) / 10) };
  }
  // The touchdown film.
  if (t < 9) {
    const k = t / 9;
    return { set: "ground", pos: mix([19, 2.2, 22], [14, 1.3, 15], k), aim: [0, Math.max(2.5, lerp(14, 3.5, smooth(t / 6.5))), 0], fov: 40, shake: 0.04 * (1 - k * 0.7) };
  }
  if (t < 14) {
    const k = smooth((t - 9) / 5);
    return { set: "ground", pos: mix([14, 1.3, 15], [-7, 1.5, 13], k), aim: [0, 3.2, 0], fov: 40, shake: 0 };
  }
  if (t < 26) {
    const k = smooth((t - 14) / 12);
    return { set: "ground", pos: mix([-7, 1.5, 13], [-30, 3.2, 44], k), aim: mix([0, 3.4, 0], [-70, 12, -130], k * 0.5), fov: 38, shake: 0 };
  }
  const k = smooth((t - 26) / 20);
  return { set: "ground", pos: mix([-30, 3.2, 44], [-12, 6, 60], k), aim: [-70, 14, -120], fov: 40, shake: 0 };
}

/** How high Eagle is during the touchdown film (the footpads over the ground), in metres. */
export function eagleHeight(t: number) {
  if (t >= 6.2) return 0;
  const k = t / 6.2;
  return 0.3 + 14 * Math.pow(1 - k, 1.6);
}

function Stars({ skyRef }: { skyRef: React.RefObject<Mesh | null> }) {
  const tex = useTexture("/assets/textures/milky_way_4k.jpg", (t) => {
    t.colorSpace = SRGBColorSpace;
  });
  return (
    <mesh ref={skyRef} rotation={[0.6, 0.4, 0.2]} renderOrder={-3} frustumCulled={false}>
      <sphereGeometry args={[4200, 48, 32]} />
      <meshBasicMaterial map={tex} side={BackSide} depthWrite={false} toneMapped={false} color={MILKY_TINT} />
    </mesh>
  );
}

/** The small Moon the orbit shots are set over: LRO imagery on a sphere that turns slowly beneath the ships. */
function OrbitMoon({ moonRef }: { moonRef: React.RefObject<Group | null> }) {
  const map = useTexture(MOON_COLOR, (t) => {
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 8;
  });
  const normalMap = useTexture(MOON_NORMAL, (t) => {
    t.anisotropy = 8;
  });
  return (
    <group ref={moonRef}>
      <mesh rotation={[0, 0, 0]}>
        <sphereGeometry args={[300, 96, 64]} />
        <meshStandardMaterial map={map} normalMap={normalMap} color="#d8d8dc" roughness={1} metalness={0} />
      </mesh>
    </group>
  );
}

interface Props {
  part: FilmPart;
  /** The film runs from `from` to `to` seconds (a part of it, when the player is asked something midway). */
  from?: number;
  to?: number;
  /** performance.now() when the film started, or null while it waits at its first frame. */
  startAt: number | null;
  onReady?: () => void;
}

/**
 * The landing films' set: a small Moon with Columbia and Eagle for the orbit shots, a long cratered
 * plain for the descent, and the ground beside Eagle for the touchdown. One clock drives everything.
 */
export function FilmWorld({ part, from = 0, to, startAt, onReady }: Props) {
  const skyRef = useRef<Mesh>(null);
  const moonRef = useRef<Group>(null);
  const orbitRef = useRef<Group>(null);
  const plainRef = useRef<Group>(null);
  const groundRef = useRef<Group>(null);
  const columbiaRef = useRef<Group>(null);
  const eagleOrbitRef = useRef<Group>(null);
  const eagleLandRef = useRef<Group>(null);
  const flameOrbit = useRef<Mesh>(null);
  const flameLand = useRef<Mesh>(null);
  const sunRef = useRef<DirectionalLight>(null);
  const earthRef = useRef<Group>(null);
  const setCameraRig = useSceneStore((s) => s.setCameraRig);
  const scene = useThree((s) => s.scene);
  const reduced = useReducedMotion();
  const seconds = FILM_SECONDS[part];

  const ready = useRef(onReady);
  ready.current = onReady;
  useEffect(() => {
    const id = window.setTimeout(() => ready.current?.(), 700);
    return () => window.clearTimeout(id);
  }, []);

  // The film clock is written before anything else runs, so every object agrees on the instant.
  useFrame(() => {
    filmClock.t = startAt === null ? from : Math.min((to ?? seconds) - 0.001, from + (performance.now() - startAt) / 1000);
  }, -100);

  // Place the actors for this instant.
  useFrame(() => {
    const t = filmClock.t;
    const shot = shotAt(part, t);
    if (orbitRef.current) orbitRef.current.visible = shot.set === "orbit";
    if (plainRef.current) plainRef.current.visible = shot.set === "plain";
    if (groundRef.current) groundRef.current.visible = shot.set === "ground";
    if (earthRef.current) earthRef.current.visible = shot.set === "ground";
    if (shot.set === "orbit") {
      const a = orbitActors(t);
      columbiaRef.current?.position.set(...a.columbia);
      const e = eagleOrbitRef.current;
      if (e) {
        e.position.set(...a.eagle);
        // Eagle turns to fly engine-first once the descent burn is near.
        const turn = smooth((t - 12) / 6);
        e.rotation.set(0, 0, turn * (Math.PI / 2) + (t < 10 ? Math.sin(t * 0.4) * 0.05 : 0));
        e.position.x = t >= 20 ? 0 : a.eagle[0];
        e.position.y = 0;
      }
      if (columbiaRef.current) columbiaRef.current.visible = t < 20;
      if (flameOrbit.current) flameOrbit.current.visible = t >= 21;
      // Underneath: the Moon turns (the ships fly over it) and rises toward them as the orbit is lowered.
      if (moonRef.current) {
        const low = t < 20 ? 8 : 8 - Math.min(1, (t - 20) / 28) * 4;
        moonRef.current.position.set(t >= 20 ? 0 : 0, -300 - low, 0);
        moonRef.current.rotation.z = -(t * 0.012 + (t >= 20 ? (t - 20) * 0.05 : 0));
      }
    } else if (shot.set === "ground") {
      const h = eagleHeight(t);
      eagleLandRef.current?.position.set(0, h + NEAR.heightAt(0, 0), 0);
      if (flameLand.current) flameLand.current.visible = t < 8.8;
    }
  });

  useEffect(() => {
    const rig: CameraRig = (camera) => {
      const t = filmClock.t;
      const shot = shotAt(part, t);
      if (camera instanceof PerspectiveCamera) {
        const wide = camera.aspect < 1.3 ? 1 + (1.3 - camera.aspect) * 0.55 : 1;
        camera.near = 0.2;
        camera.far = 9000;
        camera.fov = Math.min(95, shot.fov * wide);
        camera.updateProjectionMatrix();
      }
      const wob = reduced ? 0 : shot.shake;
      camera.position.set(
        shot.pos[0] + Math.sin(t * 57) * wob,
        shot.pos[1] + Math.sin(t * 71 + 1) * wob,
        shot.pos[2] + Math.sin(t * 43 + 2) * wob,
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(shot.aim[0], shot.aim[1], shot.aim[2]);
      if (skyRef.current) skyRef.current.position.copy(camera.position);
      // No sky to light the ground: only the sun, so shadows are black and craters read.
      scene.environmentIntensity = 0.22;
      // The sun: high and bright in orbit, low over the plain so every rock throws a long shadow.
      const sun = sunRef.current;
      if (sun) {
        if (shot.set === "orbit") sun.position.set(-120, 90, 160);
        else sun.position.set(260, 24, 140);
        sun.intensity = shot.set === "orbit" ? 3.4 : 3.2;
      }
    };
    setCameraRig(rig);
    return () => setCameraRig(null);
  }, [part, setCameraRig, reduced, scene]);

  // Engine-on glow while the lander is above the ground, and the dust it throws.
  const dustPower = useMemo(
    () => (t: number) => {
      if (part !== "touchdown") return 0;
      const h = eagleHeight(t);
      if (t < 8.8) return Math.max(0, 1 - h / 16) * (t < 1 ? t : 1);
      return Math.max(0, 1 - (t - 8.8) / 3.5);
    },
    [part],
  );

  return (
    <>
      <Stars skyRef={skyRef} />
      <directionalLight ref={sunRef} position={[-120, 90, 160]} intensity={3.4} color="#fff3e2" />
      <directionalLight position={[0, 40, 300]} intensity={0.35} color="#9bb8ff" />
      <ambientLight intensity={0.1} color="#8fa6d8" />

      <group ref={orbitRef}>
        <OrbitMoon moonRef={moonRef} />
        <group ref={columbiaRef}>
          <Columbia />
        </group>
        <group ref={eagleOrbitRef}>
          <group position={[0, -3.1, 0]}>
            <LunarModule flameRef={flameOrbit} flame={1} />
          </group>
        </group>
      </group>

      <group ref={plainRef} visible={false}>
        <Terrain scape={FAR} seg={230} rocks={900} rockMax={9} crowd={WEST_CRATER} />
      </group>

      <group ref={groundRef} visible={false}>
        <Terrain scape={NEAR} seg={140} rocks={220} rockMax={1.2} />
        <group ref={eagleLandRef}>
          <LunarModule flameRef={flameLand} flame={1} />
        </group>
        <Dust origin={[0, NEAR.heightAt(0, 0), 0]} power={dustPower} />
        {/* The Earth, small and bright above the horizon. */}
        <group ref={earthRef} position={[-230, 120, -420]}>
          <Earth radius={15} spin={0} nightGlow={0.05} />
        </group>
      </group>
      <Warmup />
    </>
  );
}
