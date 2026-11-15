import { describe, expect, it, vi } from "vitest";
import { getPreloadState, overallProgress, scenesToPreload } from "./preload";
import { WORKSHOP_FILES, WORKSHOP_TEXTURE_GROUPS, hallTextureUrls } from "./workshop/assets";

describe("scene preloading", () => {
  it("starts warming the assembly hall from the intro onward", () => {
    expect(scenesToPreload("intro-video")).toContain("workshop");
    expect(scenesToPreload("medical-briefing")).toContain("workshop");
    expect(scenesToPreload("medical-scene")).toContain("workshop");
    expect(scenesToPreload("workshop-briefing")).toContain("workshop");
  });

  it("lists every scene still ahead, nearest first, without repeats", () => {
    const all = scenesToPreload("intro-video");
    expect(all.slice(0, 3)).toEqual(["medical", "workshop", "mission-control"]);
    expect(all).toContain("lunar-descent");
    expect(all).toContain("return");
    expect(new Set(all).size).toBe(all.length);
  });

  it("skips scenes already behind the player and unknown steps", () => {
    expect(scenesToPreload("translunar-scene")).not.toContain("workshop");
    expect(scenesToPreload("unknown-step")).toEqual([]);
  });

  it("reports idle before any job runs", () => {
    expect(getPreloadState("workshop")).toEqual({ progress: 0, done: false });
    expect(overallProgress()).toBe(0);
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

describe("title-screen warm-up", () => {
  it("reaches 100% once the warmed scenes are downloaded (never stalls at 2/7 = 29%)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response("x"));
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", { setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms) });
    const { warmUpcoming, warmProgress } = await import("./preload");
    expect(warmProgress()).toBe(0);
    warmUpcoming("intro-video");
    for (let i = 0; i < 20 && warmProgress() < 100; i++) await vi.advanceTimersByTimeAsync(1000);
    expect(warmProgress()).toBe(100);
    expect(fetchMock).toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});
