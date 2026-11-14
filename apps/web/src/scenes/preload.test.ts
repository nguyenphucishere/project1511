import { describe, expect, it } from "vitest";
import { getPreloadState, scenesToPreload } from "./preload";
import { WORKSHOP_FILES, WORKSHOP_TEXTURE_GROUPS, hallTextureUrls } from "./workshop/assets";

describe("scene preloading", () => {
  it("starts warming the assembly hall from the intro onward", () => {
    expect(scenesToPreload("intro-video")).toContain("workshop");
    expect(scenesToPreload("medical-briefing")).toContain("workshop");
    expect(scenesToPreload("medical-scene")).toContain("workshop");
    expect(scenesToPreload("workshop-briefing")).toContain("workshop");
  });

  it("does not preload scenes far away or without a job", () => {
    expect(scenesToPreload("ascent-scene")).toEqual([]);
    expect(scenesToPreload("mission-control-scene")).toEqual([]);
    expect(scenesToPreload("unknown-step")).toEqual([]);
  });

  it("reports idle before any job runs", () => {
    expect(getPreloadState("workshop")).toEqual({ progress: 0, done: false });
  });

  it("texture groups match what the hall asks useTexture for", () => {
    expect(hallTextureUrls("metal_plate_02")).toEqual([
      "/assets/textures/ph/metal_plate_02_diff.jpg",
      "/assets/textures/ph/metal_plate_02_nor_gl.jpg",
      "/assets/textures/ph/metal_plate_02_rough.jpg",
    ]);
    expect(WORKSHOP_TEXTURE_GROUPS).toHaveLength(6);
    expect(new Set(WORKSHOP_FILES.map((f) => f.url)).size).toBe(WORKSHOP_FILES.length);
  });
});
