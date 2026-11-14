import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LAUNCH_SITES, OFFLINE_KSC_WINDOWS } from "@/mocks/launch-options";
import { assessLaunch } from "@/lib/simulation/launch.engine";
import type { LaunchConfig } from "@/lib/simulation/launch.types";
import { ConfigPanel } from "./ConfigPanel";

const STORMY = {
  ...OFFLINE_KSC_WINDOWS,
  windows: OFFLINE_KSC_WINDOWS.windows.map((w, i) =>
    i === 0 ? { ...w, weather: { ...w.weather, wind_speed_kmh: 48, wind_gust_kmh: 63, thunderstorm: true, weather_code: 95 } } : w,
  ),
};
const CONFIG: LaunchConfig = { vehicle: "saros", payload: "standard", fuelPct: 90, orbitKm: 185, window: "w1", site: "ksc-39a" };

const render = (windows = OFFLINE_KSC_WINDOWS) =>
  renderToStaticMarkup(
    createElement(ConfigPanel, {
      config: CONFIG,
      onChange: vi.fn(),
      onProceed: vi.fn(),
      assessment: assessLaunch(CONFIG, windows.windows[0]!),
      sites: LAUNCH_SITES,
      windows,
    }),
  );

describe("ConfigPanel", () => {
  it("shows every launch site on the map and the pad telemetry for the chosen one", () => {
    const html = render();
    expect(html).toContain('data-site="ksc-39a"');
    for (const s of LAUNCH_SITES) expect(html).toContain(s.name);
    expect(html).toContain("earth_map_1k.jpg");
    expect(html).toContain("28.6084°N, 80.6043°W");
  });

  it("states the limits and the engine's envelope, without judging the choice", () => {
    const html = render(STORMY);
    // The real reading is shown...
    expect(html).toContain("Wind 48 km/h");
    expect(html).toContain("Thunderstorm");
    // ...next to the criteria, with no verdict on this window or this fuel load.
    expect(html).toContain("Launch commit criteria");
    expect(html).toContain("≤ 40 km/h");
    expect(html).toContain("≤ 55 km/h");
    expect(html).toMatch(/Minimum fuel load/);
    expect(html).not.toContain("&gt; 40 km/h");
    expect(html).not.toMatch(/Over capacity|Not enough fuel|Launch scrubbed|text-warning/);
  });

  it("vehicle capacities and payload masses are the engine's and the parts' sums", () => {
    const html = render();
    expect(html).toContain("43.9 t");
    expect(html).toMatch(/≤ 49\.4 t/);
    expect(html).not.toMatch(/Kestrel|Saros|Orison/);
  });
});
