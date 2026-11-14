# Compact Agent Handoff Brief — Apollo 11 NASA Realism Expansion

**Workspace**: `/workspaces/project1511`

## 1. What Is Already Done (100% Verified)
- **Phase 1 (Base Apollo 11 Mission, Narrative Branching, Endings, Engine & Full-Stack)**: 100% complete (`EndingScene.tsx`, `ConsequenceBeat.tsx`, 5 decisions, 5 endings, Saturn V ascent, Kepler solver, LM descent, Open-Meteo KSC weather).
- **Phase 2 Milestone 1 — Backend NASA Data Services (`apps/server`)**: **DONE (92/92 unit tests pass)**
  - `apps/server/src/services/nasa/nasaHorizonsService.ts`: JPL Horizons DE441 Earth-Moon ephemeris, range, velocity, light-time + 1969 fallback.
  - `apps/server/src/services/nasa/nasaDsnService.ts`: NASA DSN Now parser (Goldstone, Madrid, Canberra/Honeysuckle Creek, 2.56s RTLT, S-band carrier lock, lunar occultation) + 1969 fallback.
  - `apps/server/src/services/nasa/nasaSpaceWeatherService.ts`: NASA DONKI solar flare/CME/SEP radiation alerts + 1969 fallback.
  - `apps/server/src/services/nasa/nasaMdlService.ts`: EASEP science package (PSEP, LRRR, SWC) & lunar environment specs.
  - `apps/server/src/routes/nasaRoutes.ts` mounted at `/api/nasa/*` in `apps/server/src/app.ts`.
  - Tests: `apps/server/src/__tests__/nasaData.test.ts`.
- **Phase 2 Milestone 2 — Simulation Core NASA Physics & WASM (`crates/sim-core`, `crates/sim-wasm`)**: **DONE (49/49 Rust tests pass)**
  - `crates/sim-core/src/mission_design.rs`: Goddard MDL Mass Equipment List (MEL) with 15-20% Mass Growth Allowance (MGA), multi-maneuver Delta-V budget (TLI, LOI, PDI, Ascent, TEI + 10% 3-sigma reserve), and JPL Concept Maturity Level (CML 1-4) scoring.
  - `crates/sim-core/src/descent.rs`: Ryan 4-beam Doppler Landing Radar (`calculate_landing_radar`, High/Low scale shift at 762m, crater terrain elevation delta).
  - `crates/sim-core/src/kepler.rs`: Lunar mascon gravitational anomaly (+280 mGal) and DSN telemetry (`calculate_dsn_telemetry`, RTLT, path loss dB, lunar occultation).
  - `crates/sim-wasm/src/lib.rs`: Exported `calculate_landing_radar`, `evaluate_mission_design_budget`, `calculate_dsn_telemetry` to WASM (`apps/web/public/wasm`).
  - Tests: `crates/sim-core/tests/nasa_physics_test.rs` & `crates/sim-wasm/tests/wasm_api_test.rs`.
- **Phase 2 E2E Test Suite (`tests/e2e`)**: **DONE (191/191 E2E tests pass)**
  - Added 77 new NASA realism E2E tests across all 4 tiers (`feature9-nasa-realism.test.ts`, `boundary-nasa-realism.test.ts`, `combo-nasa-realism.test.ts`, `scenario-nasa-realism.test.ts`, `scenario-margin-wave-off.test.ts`).

## 2. What Remains To Do (Milestone 3 & Final Build Check)
- **Milestone 3 — Frontend NASA Telemetry & Interactive UI (`apps/web`)**:
  1. `apps/web/src/lib/simulation/nasa.adapter.ts`: Client fetch helpers for `/api/nasa/ephemeris`, `/api/nasa/dsn/status`, `/api/nasa/space-weather`, `/api/nasa/mission-design/easep`, `/api/nasa/lunar-environment` with offline fallback.
  2. `apps/web/src/workers/simulation.worker.ts` & `apps/web/src/hooks/useSimulationWasm.ts`: Expose WASM worker calls for `calculate_landing_radar`, `evaluate_mission_design_budget`, and `calculate_dsn_telemetry`.
  3. Frontend UI Components in `apps/web/src/`:
     - `components/hud/DsnTrackingStatus.tsx`: DSN ground station dish, carrier lock, dBm, and 2.56s RTLT indicator.
     - `components/hud/SpaceWeatherWidget.tsx`: DONKI solar alert badge & radiation dosimeter.
     - `components/dashboard/MdlBudgetGauges.tsx` & `components/dashboard/BuildItYourselfPanel.tsx`: Goddard MDL mass/MGA, power (>=30%), Delta-V margin, and JPL CML 1-4 "Build It Yourself" trade study panel.
     - `scenes/lunar-descent/LandingRadarProfile.tsx`: Dual AGC inertial vs Doppler radar altitude display with scale mode 1/2 indicator.
  4. Wire components into `MissionControlScene.tsx` and `LunarDescentScene.tsx` and add Vitest unit tests.
- **Milestone 4 — Final Verification**:
  - Run `export PATH="$HOME/.cargo/bin:$PATH" && cargo test --workspace && pnpm test && pnpm run test:e2e && pnpm turbo run build`.
