"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group, MeshBasicMaterial } from "three";
import { Hotspot } from "@/components/viewport/Hotspot";
import { LightingRig } from "@/components/viewport/LightingRig";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { PALETTE, SCENE_COLORS } from "@/lib/palette";
import { VITAL_STATIONS, type StationId } from "@/mocks/vitals";
import type { LocalizedText } from "@/i18n";
import { BACK_Z, CORRIDOR_LENGTH, DOOR, DOOR_PANEL, ROOM, STATIONS } from "./layout";
import { DoctorSprite } from "./DoctorSprite";

interface MedicalWorldProps {
  doorOpen: boolean;
  checked: ReadonlySet<StationId>;
  onOpenDoor: () => void;
  onInspect: (id: StationId) => void;
}

const DOOR_LABEL: LocalizedText = { en: "Door control: OPEN", vi: "Bảng điều khiển cửa: MỞ" };

/** Scene 1 geometry: a short corridor, the sliding door, and the medical bay with three stations. */
export function MedicalWorld({ doorOpen, checked, onOpenDoor, onInspect }: MedicalWorldProps) {
  const name = (id: StationId) => VITAL_STATIONS.find((s) => s.id === id)!.name;

  return (
    <>
      <LightingRig intensity={1.1} />
      {/* Warm clinical key light highlighting the exam bed and stations */}
      <directionalLight position={[-3, 4, 1]} color="#F8FAFC" intensity={1.3} />
      <directionalLight position={[3, 3, -2]} color="#E0F2FE" intensity={0.9} />

      <Corridor />
      <FrontWall />
      <SlidingDoor open={doorOpen} />
      {!doorOpen && (
        <Hotspot id="door" label={DOOR_LABEL} position={DOOR_PANEL} markerHeight={0.45} onActivate={onOpenDoor}>
          <mesh>
            <boxGeometry args={[0.32, 0.42, 0.08]} />
            <meshStandardMaterial color={PALETTE.deep} />
          </mesh>
          <mesh position={[0, 0.02, 0.045]}>
            <planeGeometry args={[0.22, 0.22]} />
            <meshBasicMaterial color={PALETTE.gold} />
          </mesh>
        </Hotspot>
      )}

      <Room />
      <ExamBed />
      <SurgicalExamLamp />
      <IVPole />
      <CrashCart />
      <Cabinet />
      <MedicalGasPanel />
      <BiohazardBin />
      <WallBiometricsScreen />

      {/* Lively Staff */}
      <DoctorSprite position={[-0.95, 0, BACK_Z + 1.4]} />
      <MedicalTechnician />

      {(
        [
          ["heart", <HeartMonitor key="h" rotationY={STATIONS.heart.rotationY} />],
          ["pressure", <PressureStation key="p" rotationY={STATIONS.pressure.rotationY} />],
          ["vision", <VisionChart key="v" />],
        ] as const
      ).map(([id, model]) =>
        // Stations only become interactive once the door is open: the first beat teaches one thing.
        doorOpen ? (
          <Hotspot
            key={id}
            id={id}
            label={name(id)}
            position={STATIONS[id].position}
            markerHeight={STATIONS[id].marker}
            done={checked.has(id)}
            onActivate={() => onInspect(id)}
          >
            {model}
          </Hotspot>
        ) : (
          <group key={id} position={STATIONS[id].position}>
            {model}
          </group>
        ),
      )}
    </>
  );
}

function Corridor() {
  const len = CORRIDOR_LENGTH;
  const z = ROOM.frontZ + len / 2;
  return (
    <group>
      {/* Clean clinical light slate floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, z]}>
        <planeGeometry args={[3, len]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomFloor} roughness={0.45} />
      </mesh>
      {/* NASA Blue center walkway strip with yellow border guides */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, z]}>
        <planeGeometry args={[1.2, len]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.6} />
      </mesh>
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.006, z]}>
          <planeGeometry args={[0.04, len]} />
          <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 2.6, z]}>
        <planeGeometry args={[3, len]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomCeiling} roughness={0.8} />
      </mesh>
      {[-1.5, 1.5].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.3, z]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[len, 2.6]} />
            <meshStandardMaterial color={SCENE_COLORS.cleanroomWall} roughness={0.5} />
          </mesh>
          {/* Wall guard kick plates */}
          <mesh position={[x + (x < 0 ? 0.01 : -0.01), 0.2, z]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[len, 0.4]} />
            <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.4} metalness={0.2} />
          </mesh>
          {/* Blue accent corridor stripe */}
          <mesh position={[x + (x < 0 ? 0.01 : -0.01), 1.25, z]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[len, 0.08]} />
            <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
          </mesh>
        </group>
      ))}
      {/* Ceiling strip light leading the eye to the door. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 2.59, z]}>
        <planeGeometry args={[0.35, len - 0.4]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    </group>
  );
}

/** Front wall of the bay with a door-sized hole, built from three boxes. */
function FrontWall() {
  const side = (ROOM.width - DOOR.width) / 2;
  const z = ROOM.frontZ;
  return (
    <group>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DOOR.width / 2 + side / 2), ROOM.height / 2, z]}>
          <boxGeometry args={[side, ROOM.height, 0.15]} />
          <meshStandardMaterial color={SCENE_COLORS.cleanroomWall} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, DOOR.height + (ROOM.height - DOOR.height) / 2, z]}>
        <boxGeometry args={[DOOR.width, ROOM.height - DOOR.height, 0.15]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWall} roughness={0.5} />
      </mesh>
      {/* Brushed steel & solar gold frame around the opening. */}
      <mesh position={[0, DOOR.height + 0.04, z + 0.08]}>
        <boxGeometry args={[DOOR.width + 0.16, 0.08, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (DOOR.width / 2 + 0.04), DOOR.height / 2, z + 0.08]}>
          <boxGeometry args={[0.08, DOOR.height, 0.02]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.5} />
        </mesh>
      ))}
      {/* Sign above the door: "FLIGHT CREW MEDICAL BAY" */}
      <mesh position={[0, DOOR.height + 0.28, z + 0.08]}>
        <boxGeometry args={[1.5, 0.22, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      <mesh position={[0, DOOR.height + 0.28, z + 0.092]}>
        <planeGeometry args={[1.38, 0.14]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, DOOR.height + 0.28, z + 0.093]}>
        <planeGeometry args={[0.2, 0.08]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
    </group>
  );
}

function SlidingDoor({ open }: { open: boolean }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const amount = useRef(0);
  const reduced = useReducedMotion();
  const half = DOOR.width / 2;

  useFrame((_, dt) => {
    const goal = open ? 1 : 0;
    amount.current = reduced ? goal : amount.current + (goal - amount.current) * (1 - Math.exp(-5 * Math.min(dt, 0.1)));
    const shift = amount.current * (half + 0.02);
    if (left.current) left.current.position.x = -half / 2 - shift;
    if (right.current) right.current.position.x = half / 2 + shift;
  });

  return (
    <group position={[0, DOOR.height / 2, ROOM.frontZ]}>
      {[left, right].map((ref, i) => (
        <group key={i} ref={ref} position={[(i === 0 ? -1 : 1) * (half / 2), 0, 0]}>
          <mesh>
            <boxGeometry args={[half, DOOR.height, 0.06]} />
            <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.45} roughness={0.35} />
          </mesh>
          {/* Frosted window panel in the door */}
          <mesh position={[(i === 0 ? 0.08 : -0.08), 0.35, 0]}>
            <boxGeometry args={[0.22, 0.65, 0.07]} />
            <meshStandardMaterial color="#A5F3FC" roughness={0.2} metalness={0.1} transparent opacity={0.6} />
          </mesh>
          {/* NASA Blue & Red medical bay stripe across the doors */}
          <mesh position={[0, -0.2, 0.035]}>
            <planeGeometry args={[half, 0.18]} />
            <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
          </mesh>
          <mesh position={[0, -0.08, 0.035]}>
            <planeGeometry args={[half, 0.04]} />
            <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
          </mesh>
          <mesh position={[(i === 0 ? 1 : -1) * (half / 2 - 0.03), 0, 0.035]}>
            <planeGeometry args={[0.04, DOOR.height]} />
            <meshBasicMaterial color={SCENE_COLORS.steelDark} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Room() {
  const cz = ROOM.frontZ - ROOM.depth / 2;
  const hw = ROOM.width / 2;
  return (
    <group>
      {/* Clean high-gloss epoxy clinical floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, cz]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomFloor} roughness={0.38} metalness={0.08} />
      </mesh>
      {/* Examination bay demarcated floor zone with safety trim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.85, 0.002, BACK_Z + 1.6]}>
        <planeGeometry args={[2.5, 2.6]} />
        <meshStandardMaterial color="#E2E8F0" roughness={0.4} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1.85, 0.003, BACK_Z + 1.6]}>
        <ringGeometry args={[1.35, 1.4, 4, 1, Math.PI / 4]} />
        <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, ROOM.height, cz]}>
        <planeGeometry args={[ROOM.width, ROOM.depth]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomCeiling} roughness={0.7} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, ROOM.height / 2, BACK_Z]}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWall} roughness={0.5} />
      </mesh>
      {/* Back wall NASA Insignia Blue accent stripe */}
      <mesh position={[0, 1.15, BACK_Z + 0.01]}>
        <planeGeometry args={[ROOM.width, 0.16]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      <mesh position={[0, 1.25, BACK_Z + 0.01]}>
        <planeGeometry args={[ROOM.width, 0.03]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
      {/* Wall wainscot protective dado plate */}
      <mesh position={[0, 0.45, BACK_Z + 0.01]}>
        <planeGeometry args={[ROOM.width, 0.9]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.6} />
      </mesh>

      {/* Side walls */}
      {[-hw, hw].map((x) => (
        <group key={x}>
          <mesh position={[x, ROOM.height / 2, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[ROOM.depth, ROOM.height]} />
            <meshStandardMaterial color={SCENE_COLORS.cleanroomWall} roughness={0.5} />
          </mesh>
          <mesh position={[x + (x < 0 ? 0.01 : -0.01), 0.45, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[ROOM.depth, 0.9]} />
            <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.6} />
          </mesh>
          <mesh position={[x + (x < 0 ? 0.01 : -0.01), 1.15, cz]} rotation={[0, x < 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <planeGeometry args={[ROOM.depth, 0.16]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
          </mesh>
        </group>
      ))}

      {/* Ceiling LED light panels (Bright white daylight 5500K) */}
      {[-1.5, 0, 1.5].flatMap((x) =>
        [0.8, -1.2, -3.2].map((z) => (
          <group key={`${x}${z}`} position={[x, ROOM.height - 0.01, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.1, 0.6]} />
              <meshBasicMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, -0.01, 0]}>
              <boxGeometry args={[1.16, 0.02, 0.66]} />
              <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.5} />
            </mesh>
          </group>
        )),
      )}

      {/* NASA Flight Medicine wall badge / emblem on side wall */}
      <group position={[-hw + 0.02, 1.9, -0.4]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <circleGeometry args={[0.38, 32]} />
          <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[0.34, 0.38, 32]} />
          <meshBasicMaterial color={SCENE_COLORS.solarGold} />
        </mesh>
        {/* Caduceus / Red Cross */}
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[0.35, 0.1]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <planeGeometry args={[0.1, 0.35]} />
          <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
        </mesh>
      </group>
    </group>
  );
}

function ExamBed() {
  return (
    <group position={[-1.9, 0, BACK_Z + 1.4]} rotation={[0, Math.PI / 2, 0]}>
      {/* Mobile examination table base with 4 locking caster wheels */}
      <mesh position={[0, 0.28, 0]}>
        <boxGeometry args={[1.9, 0.45, 0.76]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.65} roughness={0.25} />
      </mesh>
      {/* Stainless steel hydraulic lift column */}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.16, 0.18, 0.22, 16]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Stainless side safety rails */}
      {[-0.39, 0.39].map((z) => (
        <group key={z} position={[0, 0.65, z]}>
          <mesh>
            <boxGeometry args={[1.5, 0.04, 0.04]} />
            <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} roughness={0.2} />
          </mesh>
          {[-0.6, 0, 0.6].map((x) => (
            <mesh key={x} position={[x, -0.15, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.3, 8]} />
              <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} roughness={0.2} />
            </mesh>
          ))}
        </group>
      ))}
      {/* NASA Blue padded hospital mattress with headrest incline */}
      <mesh position={[-0.2, 0.58, 0]}>
        <boxGeometry args={[1.25, 0.14, 0.74]} />
        <meshStandardMaterial color={SCENE_COLORS.medicalBlueMattress} roughness={0.55} />
      </mesh>
      {/* Inclined upper back rest */}
      <mesh position={[0.62, 0.68, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.62, 0.14, 0.74]} />
        <meshStandardMaterial color={SCENE_COLORS.medicalBlueMattress} roughness={0.55} />
      </mesh>
      {/* Crisp white sterile pillow */}
      <mesh position={[0.74, 0.81, 0]} rotation={[0, 0, 0.25]}>
        <boxGeometry args={[0.36, 0.1, 0.55]} />
        <meshStandardMaterial color="#FFFFFF" roughness={0.7} />
      </mesh>
      {/* Clean white paper roll dispenser on head of bed */}
      <mesh position={[0.98, 0.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.68, 12]} />
        <meshStandardMaterial color="#F8FAFC" roughness={0.8} />
      </mesh>
    </group>
  );
}

/** Overhead articulating dual surgical / examination lamps */
function SurgicalExamLamp() {
  return (
    <group position={[-1.9, ROOM.height, BACK_Z + 1.4]}>
      {/* Ceiling mounting flange */}
      <mesh position={[0, -0.06, 0]}>
        <cylinderGeometry args={[0.2, 0.22, 0.12, 16]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Articulated arm 1 */}
      <mesh position={[0, -0.32, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.45, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} />
      </mesh>
      {/* Swivel elbow joint */}
      <mesh position={[0, -0.58, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.steelMid} metalness={0.6} />
      </mesh>
      {/* Cantilever horizontal boom */}
      <mesh position={[0.2, -0.62, 0.15]} rotation={[0.3, 0.8, 0.2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.5, 10]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} />
      </mesh>
      {/* Circular lamp head angled toward bed */}
      <group position={[0.35, -0.82, 0.28]} rotation={[-0.4, 0.2, 0]}>
        <mesh>
          <cylinderGeometry args={[0.26, 0.28, 0.08, 20]} />
          <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.3} metalness={0.2} />
        </mesh>
        {/* Handle */}
        <mesh position={[0, -0.08, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.1, 8]} />
          <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.8} />
        </mesh>
        {/* High-intensity LED lens cluster */}
        <mesh position={[0, 0.041, 0]}>
          <circleGeometry args={[0.24, 20]} />
          <meshBasicMaterial color="#FFFBEB" />
        </mesh>
        {/* Focused surgical light source */}
        <pointLight color="#FFFBEB" intensity={1.8} distance={3.5} />
      </group>
    </group>
  );
}

/** Wheeled IV Drip Stand with saline infusion bag */
function IVPole() {
  return (
    <group position={[-2.75, 0, BACK_Z + 1.7]}>
      {/* 5-star wheeled base */}
      {[0, 1, 2, 3, 4].map((i) => {
        const a = (i * Math.PI * 2) / 5;
        return (
          <group key={i} position={[Math.sin(a) * 0.2, 0.04, Math.cos(a) * 0.2]}>
            <mesh>
              <boxGeometry args={[0.04, 0.04, 0.24]} />
              <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} />
            </mesh>
            <mesh position={[0, -0.02, 0.1]}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshStandardMaterial color="#111827" />
            </mesh>
          </group>
        );
      })}
      {/* Chrome vertical pole */}
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.018, 0.022, 2.0, 10]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.85} roughness={0.15} />
      </mesh>
      {/* Top hanger rams-horn hooks */}
      <mesh position={[0, 2.05, 0]}>
        <torusGeometry args={[0.1, 0.012, 8, 16, Math.PI]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.85} />
      </mesh>
      {/* Transparent saline fluid bag */}
      <mesh position={[0.1, 1.88, 0]}>
        <boxGeometry args={[0.12, 0.22, 0.04]} />
        <meshStandardMaterial color="#E0F2FE" transparent opacity={0.65} roughness={0.2} />
      </mesh>
      {/* NASA Blue label on bag */}
      <mesh position={[0.1, 1.88, 0.022]}>
        <planeGeometry args={[0.08, 0.06]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      {/* Digital infusion control unit */}
      <mesh position={[0, 1.25, 0.05]}>
        <boxGeometry args={[0.14, 0.16, 0.1]} />
        <meshStandardMaterial color={SCENE_COLORS.cleanroomWallLower} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.27, 0.102]}>
        <planeGeometry args={[0.1, 0.06]} />
        <meshBasicMaterial color={SCENE_COLORS.screenGreen} />
      </mesh>
    </group>
  );
}

/** Emergency / Crash Cart with Defibrillator */
function CrashCart() {
  return (
    <group position={[-2.6, 0, BACK_Z + 0.5]}>
      {/* Cart body */}
      <mesh position={[0, 0.52, 0]}>
        <boxGeometry args={[0.62, 0.9, 0.48]} />
        <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.4} />
      </mesh>
      {/* Red drawers with handles */}
      {[-0.2, 0, 0.2].map((y) => (
        <group key={y} position={[0, 0.52 + y, 0.245]}>
          <mesh>
            <planeGeometry args={[0.54, 0.16]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.015]}>
            <boxGeometry args={[0.2, 0.02, 0.02]} />
            <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.8} />
          </mesh>
        </group>
      ))}
      {/* Top stainless steel work surface with raised perimeter rim */}
      <mesh position={[0, 0.99, 0]}>
        <boxGeometry args={[0.66, 0.04, 0.52]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} roughness={0.25} />
      </mesh>
      {/* Defibrillator Unit */}
      <group position={[-0.08, 1.12, 0]}>
        <mesh>
          <boxGeometry args={[0.34, 0.2, 0.24]} />
          <meshStandardMaterial color={SCENE_COLORS.steelDark} />
        </mesh>
        <mesh position={[0, 0.02, 0.122]}>
          <planeGeometry args={[0.18, 0.12]} />
          <meshBasicMaterial color={SCENE_COLORS.screenAmber} />
        </mesh>
        {/* Shock paddles in slots */}
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 0.12, 0]}>
            <boxGeometry args={[0.06, 0.08, 0.08]} />
            <meshStandardMaterial color={SCENE_COLORS.nasaRed} />
          </mesh>
        ))}
      </group>
      {/* Oxygen cylinder strapped to side */}
      <mesh position={[0.36, 0.5, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.7, 12]} />
        <meshStandardMaterial color="#16A34A" roughness={0.4} metalness={0.4} />
      </mesh>
      {/* Chrome regulator valve */}
      <mesh position={[0.36, 0.9, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.1, 8]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.8} />
      </mesh>
    </group>
  );
}

/** Medical Gas Outlet Panel (O2 Oxygen, Air, Vacuum) */
function MedicalGasPanel() {
  const hw = ROOM.width / 2;
  return (
    <group position={[-hw + 0.02, 1.45, BACK_Z + 1.4]} rotation={[0, Math.PI / 2, 0]}>
      {/* Stainless faceplate */}
      <mesh>
        <boxGeometry args={[0.85, 0.28, 0.02]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} roughness={0.3} />
      </mesh>
      {/* Colored gas terminal outlets: Green = O2, Yellow = Air, White = Suction */}
      {[
        [-0.26, "#16A34A", "O2"],
        [0, "#EAB308", "AIR"],
        [0.26, "#F8FAFC", "VAC"],
      ].map(([x, col]) => (
        <group key={x as string} position={[x as number, 0, 0.02]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.045, 0.05, 0.04, 16]} />
            <meshStandardMaterial color={col as string} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <planeGeometry args={[0.08, 0.03]} />
            <meshBasicMaterial color={SCENE_COLORS.steelDark} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Biohazard sharps disposal container */
function BiohazardBin() {
  const hw = ROOM.width / 2;
  return (
    <group position={[-hw + 0.12, 1.05, BACK_Z + 2.4]} rotation={[0, Math.PI / 2, 0]}>
      <mesh>
        <boxGeometry args={[0.22, 0.3, 0.14]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[0.24, 0.03, 0.16]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Biohazard emblem mark */}
      <mesh position={[0, 0, 0.072]}>
        <planeGeometry args={[0.09, 0.09]} />
        <meshBasicMaterial color={SCENE_COLORS.solarGold} />
      </mesh>
    </group>
  );
}

/** Wall-mounted high-tech biometrics telemetry display */
function WallBiometricsScreen() {
  const pulseRef = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (pulseRef.current) {
      const beat = Math.sin(clock.elapsedTime * 6);
      pulseRef.current.scale.y = 1 + (beat > 0.6 ? (beat - 0.6) * 0.8 : 0);
    }
  });

  return (
    <group position={[-1.6, 1.85, BACK_Z + 0.04]}>
      {/* Outer aerospace monitor frame */}
      <mesh>
        <boxGeometry args={[1.6, 0.95, 0.05]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.6} roughness={0.3} />
      </mesh>
      {/* High-contrast screen glass */}
      <mesh position={[0, 0, 0.028]}>
        <planeGeometry args={[1.5, 0.85]} />
        <meshBasicMaterial color={SCENE_COLORS.screenGlass} />
      </mesh>
      {/* Top telemetry title bar */}
      <mesh position={[0, 0.36, 0.032]}>
        <planeGeometry args={[1.44, 0.06]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      {/* Cyan Wireframe Human Body Silhouette */}
      <group position={[-0.45, -0.05, 0.032]}>
        {/* Head */}
        <mesh position={[0, 0.22, 0]}>
          <circleGeometry args={[0.07, 16]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} wireframe />
        </mesh>
        {/* Torso */}
        <mesh position={[0, 0.05, 0]}>
          <planeGeometry args={[0.2, 0.24]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} wireframe />
        </mesh>
        {/* Limbs */}
        <mesh position={[-0.14, 0.04, 0]} rotation={[0, 0, 0.2]}>
          <planeGeometry args={[0.06, 0.22]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} wireframe />
        </mesh>
        <mesh position={[0.14, 0.04, 0]} rotation={[0, 0, -0.2]}>
          <planeGeometry args={[0.06, 0.22]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} wireframe />
        </mesh>
        {/* Legs */}
        <mesh position={[-0.06, -0.18, 0]}>
          <planeGeometry args={[0.06, 0.22]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} wireframe />
        </mesh>
        <mesh position={[0.06, -0.18, 0]}>
          <planeGeometry args={[0.06, 0.22]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} wireframe />
        </mesh>
        {/* Beating Heart Icon */}
        <group ref={pulseRef} position={[-0.02, 0.08, 0.005]}>
          <mesh>
            <circleGeometry args={[0.032, 12]} />
            <meshBasicMaterial color={SCENE_COLORS.screenRed} />
          </mesh>
        </group>
      </group>

      {/* Right side telemetry readouts (HR, SPO2, TEMP, BP) */}
      <group position={[0.25, 0, 0.032]}>
        {[
          ["HR: 72 BPM NOMINAL", 0.22, SCENE_COLORS.screenGreen],
          ["BP: 118 / 76 mmHg", 0.08, SCENE_COLORS.screenCyan],
          ["SPO2: 99% OPTIMAL", -0.06, SCENE_COLORS.screenGreen],
          ["CORE TEMP: 36.8°C", -0.2, SCENE_COLORS.screenAmber],
        ].map(([label, y, col]) => (
          <group key={label as string} position={[0, y as number, 0]}>
            <mesh position={[0, 0, 0]}>
              <planeGeometry args={[0.78, 0.08]} />
              <meshBasicMaterial color="#0A1E38" />
            </mesh>
            <mesh position={[-0.32, 0, 0.002]}>
              <planeGeometry args={[0.08, 0.06]} />
              <meshBasicMaterial color={col as string} />
            </mesh>
            <mesh position={[0.05, 0, 0.002]}>
              <planeGeometry args={[0.58, 0.03]} />
              <meshBasicMaterial color={col as string} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

/** Animated Medical Technician monitoring the diagnostic stations */
function MedicalTechnician() {
  const root = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const reduced = useReducedMotion();

  useFrame(({ clock }) => {
    if (reduced) return;
    const t = clock.elapsedTime * 0.6;
    // Paces slowly between the cabinet and pressure station
    const x = 1.6 + Math.sin(t) * 0.45;
    const moving = Math.cos(t);
    if (root.current) {
      root.current.position.x = x;
      root.current.rotation.y = moving >= 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const stride = Math.sin(clock.elapsedTime * 3) * 0.25;
    if (leftLeg.current) leftLeg.current.rotation.x = stride;
    if (rightLeg.current) rightLeg.current.rotation.x = -stride;
  });

  return (
    <group ref={root} position={[1.6, 0, BACK_Z + 2.2]} rotation={[0, -Math.PI / 2, 0]}>
      {/* White non-slip cleanroom shoes */}
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.05, 0]}>
          <boxGeometry args={[0.11, 0.09, 0.22]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.4} />
        </mesh>
      ))}
      {/* Light Teal Medical Scrubs */}
      <group ref={leftLeg} position={[-0.09, 0.42, 0]}>
        <mesh>
          <boxGeometry args={[0.13, 0.68, 0.18]} />
          <meshStandardMaterial color="#0D9488" roughness={0.7} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.09, 0.42, 0]}>
        <mesh>
          <boxGeometry args={[0.13, 0.68, 0.18]} />
          <meshStandardMaterial color="#0D9488" roughness={0.7} />
        </mesh>
      </group>
      {/* Scrub Top */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[0.38, 0.6, 0.24]} />
        <meshStandardMaterial color="#0D9488" roughness={0.7} />
      </mesh>
      {/* Clip-on badge */}
      <mesh position={[0.1, 1.18, 0.122]}>
        <planeGeometry args={[0.06, 0.08]} />
        <meshBasicMaterial color={SCENE_COLORS.solarGold} />
      </mesh>
      {/* Head with sterile medical cap */}
      <mesh position={[0, 1.48, 0]}>
        <sphereGeometry args={[0.12, 12, 12]} />
        <meshStandardMaterial color="#FCD34D" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.54, 0]}>
        <sphereGeometry args={[0.128, 12, 12]} />
        <meshStandardMaterial color="#0D9488" roughness={0.7} />
      </mesh>
      {/* Holding clipboard */}
      <group position={[0, 1.02, 0.22]} rotation={[-0.4, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.22, 0.3, 0.02]} />
          <meshStandardMaterial color="#B45309" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, 0.012]}>
          <planeGeometry args={[0.18, 0.24]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      </group>
    </group>
  );
}

function Cabinet() {
  return (
    <group position={[2.6, 0, BACK_Z + 0.4]}>
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[1, 2, 0.6]} />
        <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.4} />
      </mesh>
      {/* Glass upper door panels */}
      {[-0.24, 0.24].map((x) => (
        <mesh key={x} position={[x, 1.42, 0.305]}>
          <planeGeometry args={[0.4, 0.85]} />
          <meshStandardMaterial color="#BAE6FD" roughness={0.15} metalness={0.2} transparent opacity={0.55} />
        </mesh>
      ))}
      {/* NASA Blue cabinet trim */}
      <mesh position={[0, 0.15, 0.305]}>
        <planeGeometry args={[1, 0.25]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      {/* True Medical Red Cross Emblem (+) */}
      <mesh position={[0, 0.72, 0.31]}>
        <planeGeometry args={[0.24, 0.07]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
      <mesh position={[0, 0.72, 0.31]}>
        <planeGeometry args={[0.07, 0.24]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
    </group>
  );
}

function HeartMonitor({ rotationY }: { rotationY: number }) {
  const pulseRef = useRef<Group>(null);
  const sweepRef = useRef<Group>(null);

  useFrame(({ clock }) => {
    if (sweepRef.current) {
      // Oscilloscope sweep bar across ECG screen
      sweepRef.current.position.x = -0.3 + ((clock.elapsedTime * 0.8) % 1) * 0.6;
    }
    if (pulseRef.current) {
      const beat = Math.sin(clock.elapsedTime * 7);
      pulseRef.current.scale.y = 1 + (beat > 0.7 ? (beat - 0.7) * 0.9 : 0);
    }
  });

  // ECG trace made of short segments, drawn in vibrant medical emerald green.
  const trace: [number, number, number][] = [
    [-0.26, 0, 0.14],
    [-0.12, 0.08, 0.06],
    [-0.07, -0.06, 0.08],
    [-0.02, 0.14, 0.12],
    [0.05, -0.04, 0.1],
    [0.18, 0, 0.16],
  ];

  return (
    <group rotation={[0, rotationY, 0]}>
      {/* Heavy roll-around stand base with caster wheels */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.62, 0.12, 0.62]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.75, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.3, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Monitor chassis with NASA blue branding */}
      <mesh position={[0, 1.45, 0.05]}>
        <boxGeometry args={[0.82, 0.58, 0.14]} />
        <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.7, 0.05]}>
        <boxGeometry args={[0.82, 0.06, 0.142]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      {/* Monitor glass */}
      <mesh position={[0, 1.45, 0.122]}>
        <planeGeometry args={[0.74, 0.46]} />
        <meshBasicMaterial color={SCENE_COLORS.screenGlass} />
      </mesh>
      {/* Oscilloscope moving sweep cursor */}
      <group ref={sweepRef} position={[-0.2, 1.45, 0.126]}>
        <mesh>
          <planeGeometry args={[0.015, 0.44]} />
          <meshBasicMaterial color={SCENE_COLORS.screenCyan} transparent opacity={0.65} />
        </mesh>
      </group>
      {/* ECG wave trace */}
      <group ref={pulseRef} position={[0, 0, 0]}>
        {trace.map(([x, y, w], i) => (
          <mesh key={i} position={[x, 1.45 + y, 0.124]} rotation={[0, 0, i % 2 ? 0.9 : -0.9]}>
            <planeGeometry args={[w, 0.025]} />
            <meshBasicMaterial color={SCENE_COLORS.medicalGreenScreen} />
          </mesh>
        ))}
      </group>
      {/* Digital BPM Readout */}
      <mesh position={[0.24, 1.6, 0.124]}>
        <planeGeometry args={[0.16, 0.08]} />
        <meshBasicMaterial color={SCENE_COLORS.screenGreen} />
      </mesh>
    </group>
  );
}

function PressureStation({ rotationY }: { rotationY: number }) {
  return (
    <group rotation={[0, rotationY, 0]}>
      {/* Ergonomic blue medical chair with armrests */}
      <mesh position={[0, 0.45, 0.5]}>
        <boxGeometry args={[0.55, 0.1, 0.55]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.85, 0.75]}>
        <boxGeometry args={[0.55, 0.7, 0.08]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} roughness={0.55} />
      </mesh>
      {/* Stainless steel armrests */}
      {[-0.3, 0.3].map((x) => (
        <group key={x} position={[x, 0.68, 0.5]}>
          <mesh>
            <boxGeometry args={[0.06, 0.04, 0.46]} />
            <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} />
          </mesh>
          <mesh position={[0, -0.12, 0.18]}>
            <cylinderGeometry args={[0.02, 0.02, 0.24, 8]} />
            <meshStandardMaterial color={SCENE_COLORS.aluminum} metalness={0.7} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.22, 0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 0.44, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} metalness={0.7} />
      </mesh>

      {/* White medical side table with the cuff unit */}
      <mesh position={[0, 0.75, -0.2]}>
        <boxGeometry args={[0.7, 0.06, 0.5]} />
        <meshStandardMaterial color={SCENE_COLORS.spaceWhite} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.37, -0.2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.74, 12]} />
        <meshStandardMaterial color={SCENE_COLORS.steelLight} metalness={0.6} />
      </mesh>
      {/* Digital Sphygmomanometer Console */}
      <mesh position={[0, 0.92, -0.25]}>
        <boxGeometry args={[0.38, 0.28, 0.24]} />
        <meshStandardMaterial color={SCENE_COLORS.steelDark} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.95, -0.125]}>
        <planeGeometry args={[0.26, 0.14]} />
        <meshBasicMaterial color={SCENE_COLORS.screenCyan} />
      </mesh>
      {/* Cuff, a NASA red band resting on the table */}
      <mesh position={[0.22, 0.81, -0.05]} rotation={[0, 0, Math.PI / 2]}>
        <torusGeometry args={[0.07, 0.035, 8, 16]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaRed} roughness={0.7} />
      </mesh>
      {/* Rubber inflation bulb and coiled tube */}
      <mesh position={[-0.22, 0.8, -0.05]}>
        <sphereGeometry args={[0.04, 10, 10]} />
        <meshStandardMaterial color="#1E293B" />
      </mesh>
    </group>
  );
}

/** Eye chart: rows of shrinking bars on a crisp backlit board, plus a floor line marking where to stand. */
function VisionChart() {
  const rows = [0.5, 0.4, 0.32, 0.25, 0.19, 0.14];
  return (
    <group>
      <mesh position={[0, 1.6, 0.02]}>
        <planeGeometry args={[0.92, 1.52]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[0, 1.6, 0.01]}>
        <planeGeometry args={[1.04, 1.64]} />
        <meshStandardMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      {/* Glowing top header bar */}
      <mesh position={[0, 2.32, 0.025]}>
        <planeGeometry args={[0.88, 0.1]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaBlue} />
      </mesh>
      {rows.map((w, i) => (
        <mesh key={i} position={[0, 2.18 - i * 0.2, 0.03]}>
          <planeGeometry args={[w, 0.09 - i * 0.008]} />
          <meshBasicMaterial color={i === 1 ? SCENE_COLORS.nasaRed : SCENE_COLORS.steelDark} />
        </mesh>
      ))}
      {/* Stand line on floor: vibrant safety yellow with red border */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 3]}>
        <planeGeometry args={[0.9, 0.12]} />
        <meshBasicMaterial color={SCENE_COLORS.safetyYellow} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 3]}>
        <planeGeometry args={[0.8, 0.04]} />
        <meshBasicMaterial color={SCENE_COLORS.nasaRed} />
      </mesh>
    </group>
  );
}
