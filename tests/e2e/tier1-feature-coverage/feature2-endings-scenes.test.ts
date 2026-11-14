import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertEndingDefinition, assertTouchdownWithinLimits } from "../harness/assertions.ts";
import { ENDINGS, ENDINGS_CATALOG, getEnding, type EndingDefinition } from "../../../apps/web/src/game/endings.ts";

describe("Tier 1 Feature 2: Apollo 11 Reachable Endings & Placeholder Scenes", () => {
  it("ending 1: Historic Landing at Tranquility Base satisfies success criteria", () => {
    const ending = getEnding("ending-1");
    assert.ok(ending, "Ending 1 must exist in endings catalog");
    assertEndingDefinition(ending);

    // Validate Status & Composite Score
    assert.equal(ending.status, "success");
    assert.equal(ending.score, 98);
    assert.equal(ending.normalizedId, "ending-1");

    // Validate Historical Quotation & Attribution
    assert.ok(ending.quote.includes("Tranquility Base here. The Eagle has landed"));
    assert.ok(ending.quoteAttribution.includes("Neil A. Armstrong"));

    // Validate Flight Envelope Telemetry
    assert.equal(ending.telemetry.scienceDeployed, true, "EASEP science package must be deployed");
    assert.equal(ending.telemetry.lunarSamplesKg, 21.55, "Apollo 11 historical sample mass: 21.55 kg");
    assert.equal(ending.telemetry.fuelHoverMarginSeconds, 25.0, "Historical hover margin: 25.0s to Bingo");

    // Validate Touchdown Structural Envelope
    assertTouchdownWithinLimits(
      ending.telemetry.terminalVxMs,
      ending.telemetry.terminalVzMs,
      ending.telemetry.surfaceTiltDeg
    );
    assert.ok(ending.telemetry.terminalVxMs <= 1.22);
    assert.ok(Math.abs(ending.telemetry.terminalVzMs) <= 2.13);
    assert.ok(ending.telemetry.surfaceTiltDeg <= 12.0);

    // Validate Debrief Content
    assert.ok(ending.debriefReport.length >= 2);
    assert.ok(ending.debriefReport[0].en.includes("Mare Tranquillitatis"));
    assert.ok(ending.debriefReport[1].en.includes("EASEP"));
  });

  it("ending 2: Safe Abort to Orbit preserves crew and documents orbital rendezvous", () => {
    const ending = getEnding("ending-2");
    assert.ok(ending);
    assertEndingDefinition(ending);

    assert.equal(ending.status, "partial");
    assert.equal(ending.score, 72);
    assert.equal(ending.normalizedId, "ending-2");

    // Quote & Attribution
    assert.ok(ending.quote.includes("Eagle is Abort Stage"));
    assert.ok(ending.quoteAttribution.includes("Neil A. Armstrong"));

    // Telemetry
    assert.equal(ending.telemetry.scienceDeployed, false);
    assert.equal(ending.telemetry.lunarSamplesKg, 0.0);
    assert.ok(ending.telemetry.fuelRemainingPct > 80.0, "Ascent stage propellant remains high");
    assert.ok(ending.telemetry.getTouchdown.includes("Aborted at 33,500 ft"));

    // Debrief narrative
    assert.ok(ending.debriefReport[0].en.includes("ABORT STAGE"));
    assert.ok(ending.debriefReport[1].en.includes("Michael Collins"));
    assert.ok(ending.debriefReport[1].en.includes("Columbia"));
  });

  it("ending 3: Catastrophic Touchdown / Stranded reflects structural limit failures and Safire address", () => {
    const ending = getEnding("ending-3");
    assert.ok(ending);
    assertEndingDefinition(ending);

    assert.equal(ending.status, "fatal");
    assert.equal(ending.score, 28);
    assert.equal(ending.normalizedId, "ending-3");

    // Quote & Presidential Speech Contingency
    assert.ok(ending.quote.includes("Fate has ordained that the men who went to the Moon"));
    assert.ok(ending.quoteAttribution.includes("William Safire"));
    assert.ok(ending.contingencyAddress?.includes("heroes in the constellations"));
    assert.ok(ending.contingencySpeechText?.en.includes("stay on the Moon to rest in peace"));

    // Structural Limit Failures
    assert.ok(
      ending.telemetry.terminalVxMs > 1.22,
      `Lateral velocity ${ending.telemetry.terminalVxMs} m/s must exceed 1.22 m/s structural limit`
    );
    assert.ok(
      Math.abs(ending.telemetry.terminalVzMs) > 3.05,
      `Vertical sink rate ${ending.telemetry.terminalVzMs} m/s must exceed 3.05 m/s structural limit`
    );
    assert.ok(
      ending.telemetry.surfaceTiltDeg > 12.0,
      `Surface tilt ${ending.telemetry.surfaceTiltDeg}° must exceed 12.0° structural limit`
    );

    // Debrief narrative verifies strut shearing and nozzle destruction
    assert.ok(ending.debriefReport[0].en.includes("strut sheared off"));
    assert.ok(ending.debriefReport[0].en.includes("Ascent Engine nozzle was crushed"));
  });

  it("ending 4: Bingo Fuel Abort reflects low-altitude wave-off and fuel depletion", () => {
    const ending = getEnding("ending-4");
    assert.ok(ending);
    assertEndingDefinition(ending);

    assert.equal(ending.status, "partial");
    assert.equal(ending.score, 60);
    assert.equal(ending.normalizedId, "ending-4");

    // Quote & Attribution
    assert.ok(ending.quote.includes("Bingo fuel, Houston!"));
    assert.ok(ending.quoteAttribution.includes("Neil A. Armstrong"));

    // Telemetry verifies 0 hover margin and abort at 40 feet
    assert.equal(ending.telemetry.fuelHoverMarginSeconds, 0.0);
    assert.ok(ending.telemetry.fuelRemainingPct <= 0.5, "Propellant depleted down to dry tanks");
    assert.ok(ending.telemetry.getTouchdown.includes("40 ft AGL"));

    // Debrief narrative
    assert.ok(ending.debriefReport[0].en.includes("Bingo Fuel flight rule at 40 feet"));
    assert.ok(ending.debriefReport[1].en.includes("Ascent Stage blasted off directly"));
  });

  it("ending 5: Ascent Catastrophe reflects Max-Q dynamic pressure breakup", () => {
    const ending = getEnding("ending-5");
    assert.ok(ending);
    assertEndingDefinition(ending);

    assert.equal(ending.status, "fatal");
    assert.equal(ending.score, 5);
    assert.equal(ending.normalizedId, "ending-5");

    // Failure reason & quotation
    assert.ok(ending.failureReason?.includes("Max-Q aerodynamic shear"));
    assert.ok(ending.quote.includes("structural shear telemetry at T+83 seconds"));
    assert.ok(ending.quoteAttribution.includes("Booster Systems Engineer"));

    // Telemetry confirms breakup in high-speed atmospheric flight
    assert.ok(ending.telemetry.getTouchdown.includes("Lost during atmospheric ascent"));
    assert.ok(ending.telemetry.terminalVxMs >= 500.0);
    assert.ok(ending.telemetry.terminalVzMs >= 300.0);

    // Debrief narrative
    assert.ok(ending.debriefReport[0].en.includes("Max-Q, 34.3 kPa"));
    assert.ok(ending.debriefReport[0].en.includes("13.4 km altitude"));
  });

  it("endings catalog adheres to bilingual localization, case-insensitive access, and valid schemas", () => {
    const requiredEndings = ["ending-1", "ending-2", "ending-3", "ending-4", "ending-5"];

    for (const id of requiredEndings) {
      const def = ENDINGS_CATALOG[id];
      assert.ok(def, `Catalog must contain ${id}`);
      assertEndingDefinition(def);

      // Verify bilingual titles
      assert.ok(def.title.en && def.title.en.length > 5);
      assert.ok(def.title.vi && def.title.vi.length > 5);

      // Verify bilingual subtitles
      assert.ok(def.subtitle.en && def.subtitle.en.length > 5);
      assert.ok(def.subtitle.vi && def.subtitle.vi.length > 5);

      // Verify bilingual debrief paragraphs
      assert.ok(def.debriefReport.length >= 2);
      for (const p of def.debriefReport) {
        assert.ok(p.en && p.en.length > 20);
        assert.ok(p.vi && p.vi.length > 20);
      }

      // Verify case-insensitive / uppercase alias access
      const upperDef = getEnding(id.toUpperCase());
      assert.equal(upperDef?.id, def.id);
      const lowerDef = getEnding(id.toLowerCase());
      assert.equal(lowerDef?.id, def.id);
    }
  });
});
