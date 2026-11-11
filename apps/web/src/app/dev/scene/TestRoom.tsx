"use client";

import { useSceneStore, type Viewpoint } from "@/game/sceneStore";
import { Hotspot } from "@/components/viewport/Hotspot";
import { LightingRig } from "@/components/viewport/LightingRig";
import { PALETTE } from "@/lib/palette";
import type { LocalizedText } from "@/i18n";

export const TEST_VIEWPOINTS: Viewpoint[] = [
  {
    id: "door",
    label: { en: "the doorway", vi: "cửa ra vào" },
    position: [0, 1.6, 3.2],
    yaw: 0,
    pitch: -0.12,
    yawRange: 1.1,
    pitchRange: 0.6,
  },
  {
    id: "console",
    label: { en: "the console", vi: "bàn điều khiển" },
    position: [0.6, 1.6, -0.6],
    yaw: 0.35,
    pitch: -0.25,
    yawRange: 1.4,
    pitchRange: 0.7,
  },
];

export const TEST_ITEMS: { id: string; label: LocalizedText; body: LocalizedText }[] = [
  {
    id: "console",
    label: { en: "Control console", vi: "Bàn điều khiển" },
    body: {
      en: "A test console. In the real scenes, inspecting an object opens a panel like this one.",
      vi: "Bàn điều khiển thử nghiệm. Trong các cảnh thật, kiểm tra một vật sẽ mở bảng như thế này.",
    },
  },
  {
    id: "crate",
    label: { en: "Supply crate", vi: "Thùng hàng" },
    body: { en: "Spare parts, sealed for launch.", vi: "Linh kiện dự phòng, đã niêm phong để phóng." },
  },
  {
    id: "globe",
    label: { en: "Moon globe", vi: "Quả cầu Mặt Trăng" },
    body: { en: "A model of the landing site.", vi: "Mô hình khu vực hạ cánh." },
  },
];

interface TestRoomProps {
  checked: Set<string>;
  onInspect: (id: string) => void;
}

/** A plain room for checking the camera, hotspots, lighting, and the pixel pass. */
export function TestRoom({ checked, onInspect }: TestRoomProps) {
  const goTo = useSceneStore((s) => s.goTo);
  const viewpointId = useSceneStore((s) => s.viewpointId);
  const label = (id: string) => TEST_ITEMS.find((i) => i.id === id)!.label;

  return (
    <>
      <LightingRig />

      {/* Room shell: 8 × 8 m, 3.2 m ceiling. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color={PALETTE.blue} roughness={0.9} />
      </mesh>
      <mesh position={[0, 3.2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color={PALETTE.deep} />
      </mesh>
      {[
        { p: [0, 1.6, -4], r: 0 },
        { p: [0, 1.6, 4], r: Math.PI },
        { p: [-4, 1.6, 0], r: Math.PI / 2 },
        { p: [4, 1.6, 0], r: -Math.PI / 2 },
      ].map((w, i) => (
        <mesh key={i} position={w.p as [number, number, number]} rotation={[0, w.r, 0]}>
          <planeGeometry args={[8, 3.2]} />
          <meshStandardMaterial color={PALETTE.mist} roughness={1} />
        </mesh>
      ))}
      {/* A window band on the far wall. */}
      <mesh position={[0, 2, -3.98]}>
        <planeGeometry args={[5, 1.2]} />
        <meshBasicMaterial color={PALETTE.deep} />
      </mesh>

      <Hotspot id="console" label={label("console")} position={[0.4, 0, -2.6]} markerHeight={1.6} done={checked.has("console")} onActivate={() => onInspect("console")}>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[2, 1, 0.8]} />
          <meshStandardMaterial color={PALETTE.blue} metalness={0.3} roughness={0.5} />
        </mesh>
        <mesh position={[0, 1.02, 0]} rotation={[-0.4, 0, 0]}>
          <boxGeometry args={[1.8, 0.05, 0.6]} />
          <meshStandardMaterial color={PALETTE.gold} emissive={PALETTE.gold} emissiveIntensity={0.2} />
        </mesh>
      </Hotspot>

      <Hotspot id="crate" label={label("crate")} position={[-2.4, 0, -1.2]} markerHeight={1.2} done={checked.has("crate")} onActivate={() => onInspect("crate")}>
        <mesh position={[0, 0.4, 0]} rotation={[0, 0.4, 0]}>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial color={PALETTE.orange} roughness={0.8} />
        </mesh>
      </Hotspot>

      <Hotspot id="globe" label={label("globe")} position={[2.5, 0, 0.6]} markerHeight={1.7} done={checked.has("globe")} onActivate={() => onInspect("globe")}>
        <mesh position={[0, 0.5, 0]}>
          <cylinderGeometry args={[0.25, 0.35, 1, 12]} />
          <meshStandardMaterial color={PALETTE.deep} />
        </mesh>
        <mesh position={[0, 1.25, 0]}>
          <sphereGeometry args={[0.35, 24, 16]} />
          <meshStandardMaterial color={PALETTE.mist} roughness={0.95} />
        </mesh>
      </Hotspot>

      {TEST_VIEWPOINTS.filter((v) => v.id !== viewpointId).map((v) => (
        <Hotspot
          key={v.id}
          id={`move-${v.id}`}
          kind="move"
          label={v.label}
          position={[v.position[0], 0, v.position[2]]}
          markerHeight={0.3}
          onActivate={() => goTo(v.id)}
        />
      ))}
    </>
  );
}
