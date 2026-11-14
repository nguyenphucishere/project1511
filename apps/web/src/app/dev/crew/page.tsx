"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { useSearchParams } from "next/navigation";
import { CrewShotScene, LOOKS, type CrewMood } from "@/scenes/crew3d/CrewShotScene";

/**
 * Developer page: the three crew in their cabin, one lighting per kind of failure, to review the
 * 3D crew and cabin on their own. ?mood=structural|fuel-depleted|slow-climb|wind-shear|lightning,
 * ?shot=wide|close, ?low=1 for the low-detail build, ?post=0 for no post-processing. Not part of the game.
 */
function CrewShot() {
  const params = useSearchParams();
  const asked = params.get("mood") as CrewMood;
  const mood: CrewMood = asked in LOOKS ? asked : "structural";
  const shot = params.get("shot") === "close" ? "close" : "wide";
  return (
    <div className="fixed inset-0 bg-black">
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: false }}
        dpr={[1, 1.5]}
        camera={{ position: [0, 0.12, 3.7], fov: 34 }}
        onCreated={({ gl, scene, camera }) => {
          // window.__capture() renders one frame and returns it as a PNG data URL (for saving a still).
          (window as unknown as { __capture?: () => string }).__capture = () => {
            gl.render(scene, camera);
            return gl.domElement.toDataURL("image/png");
          };
        }}
      >
        <CrewShotScene mood={mood} shot={shot} low={params.get("low") === "1"} post={params.get("post") !== "0"} />
      </Canvas>
    </div>
  );
}

export default function CrewBlockoutPage() {
  return (
    <Suspense fallback={null}>
      <CrewShot />
    </Suspense>
  );
}
