import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DsnTrackingStatus } from "./DsnTrackingStatus";
import { SpaceWeatherWidget } from "./SpaceWeatherWidget";
import { MdlBudgetGauges } from "@/components/dashboard/MdlBudgetGauges";
import { BuildItYourselfPanel } from "@/components/dashboard/BuildItYourselfPanel";
import { LandingRadarProfile } from "@/scenes/lunar-descent/LandingRadarProfile";
import { radarInputAt } from "@/scenes/lunar-descent/radar";
import { OFFLINE_DSN_STATUS, OFFLINE_SPACE_WEATHER } from "@/lib/simulation/nasa.adapter";
import {
  APOLLO_11_DESIGN_BASELINE,
  dsnTelemetry,
  landingRadar,
  MAX_TLI_PAYLOAD_CAPACITY_KG,
  missionDesignBudget,
} from "@/lib/simulation/nasa.physics";

const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);

describe("DsnTrackingStatus", () => {
  it("shows lock, RTLT and every dish when in contact", () => {
    const out = html(createElement(DsnTrackingStatus, { status: OFFLINE_DSN_STATUS, link: dsnTelemetry({ distance_km: 384_400 }) }));
    expect(out).toContain('data-dsn-status="aos"');
    expect(out).toContain("CARRIER LOCK");
    expect(out).toContain("2.56 s");
    expect(out).toContain("DSS-14");
  });

  it("shows loss of signal behind the Moon, compact hides the dishes", () => {
    const out = html(
      createElement(DsnTrackingStatus, {
        status: OFFLINE_DSN_STATUS,
        link: dsnTelemetry({ distance_km: 384_400, is_farside: true }),
        compact: true,
      }),
    );
    expect(out).toContain('data-dsn-status="los"');
    expect(out).toContain("LOS");
    expect(out).not.toContain("DSS-14");
  });
});

describe("SpaceWeatherWidget", () => {
  it("flags a severe solar event", () => {
    expect(html(createElement(SpaceWeatherWidget, { data: OFFLINE_SPACE_WEATHER }))).toContain("QUIET SUN");
    const severe = html(
      createElement(SpaceWeatherWidget, {
        data: { ...OFFLINE_SPACE_WEATHER, mission_risk_status: "SEVERE_ALERT", solar_proton_event_alert: true },
      }),
    );
    expect(severe).toContain("SOLAR ALERT");
    expect(severe).toContain("SEP ALERT");
  });
});

describe("mission design panels", () => {
  it("gauges show the CML and compliance", () => {
    const out = html(
      createElement(MdlBudgetGauges, {
        result: missionDesignBudget({ ...APOLLO_11_DESIGN_BASELINE, power_generation_watts: 1_500 }),
        capacityKg: MAX_TLI_PAYLOAD_CAPACITY_KG,
      }),
    );
    expect(out).toMatch(/data-cml="[1-3]"/);
    expect(out).toContain('data-gauge="POWER MARGIN" data-ok="false"');
  });

  it("build-it-yourself starts from the Apollo 11 baseline at CML 4", () => {
    const out = html(createElement(BuildItYourselfPanel, {}));
    expect(out).toContain('data-cml="4"');
    expect(out.match(/type="range"/g)).toHaveLength(5);
  });
});

describe("LandingRadarProfile", () => {
  it("has no lock while pitched back early in braking, and low scale near the surface", () => {
    expect(html(createElement(LandingRadarProfile, { measurement: landingRadar(radarInputAt(0)) }))).toContain(
      'data-radar-good="false"',
    );
    const late = landingRadar({ ...radarInputAt(0), inertial_alt_m: 300, vertical_vel_mps: -3, horizontal_vel_mps: 10, pitch_angle_deg: 12 });
    const out = html(createElement(LandingRadarProfile, { measurement: late }));
    expect(out).toContain('data-scale-mode="2"');
    expect(out).toContain("DATA GOOD");
  });
});
