# Project: Apollo 11 Mission Simulation & Interactive Narrative

## Architecture
A full-stack space mission simulation and interactive narrative application consisting of:
1. **Simulation Engine (`crates/sim-core`, `crates/sim-wasm`)**:
   - High-fidelity Rust physics engine implementing Saturn V multi-stage ascent, Keplerian orbital propagation, lunar powered descent throttling, DAG multi-resource propagation, and multi-criteria scoring.
   - Compiled to WebAssembly (`sim-wasm`) via `wasm-pack` with web-targeted bindings output to `apps/web/public/wasm`.
2. **Web Server (`apps/server`)**:
   - Express HTTP and WebSocket service providing endpoints for launch data, real-time Cape Canaveral weather (with deterministic offline Apollo 11 fallback), mission validation, and authoritative simulation execution.
3. **Web Frontend (`apps/web`)**:
   - Next.js interactive narrative application featuring Apollo 11 historical missions, branching narrative decisions affecting gameplay state, multiple reachable endings with dedicated ending scenes, and full-stack integration with `apps/server` and `sim-wasm`.
4. **Data Flow**:
   - User inputs / launch configuration -> `apps/web`
   - External Launch Data (Weather, Map, Mass) fetched via `apps/server` (Open-Meteo / OSM / Horizons with offline fallback) -> fed into `apps/web` and `sim-core`
   - Simulation state propagated via `crates/sim-wasm` in a background Web Worker (`simulation.worker.ts`) -> reactive telemetry streamed to HUD & UI scenes
   - Authoritative mission scoring & validation verified server-side via `simBridge.ts`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---|---|---|---|
| 1 | Multi-Stage Saturn V Ascent Physics | Implements ascent acceleration, dynamic pressure, gravity losses, drag, and mass depletion across S-IC, S-II, and S-IVB stages | M1 | Telemetry Catalog §1.1 |
| 2 | Keplerian Orbit Solver & Propagation | Solves Kepler's equation via Newton-Raphson, calculates orbital period, velocity, and state vectors for Earth and Moon orbits | M1 | Telemetry Catalog §4.2 |
| 3 | Earth J2 Secular Nodal Precession | Computes nodal precession rate for low Earth orbit operations | M1 | Architecture Spec §4.2.A |
| 4 | Lunar Eclipse & Shadow Calculator | Cylindrical shadow model calculating spacecraft eclipse duration behind the Moon | M1 | Telemetry Catalog §4.2 |
| 5 | LM Powered Descent Throttle Model | Implements 10-60% continuous and 92.5-100% FTP throttling, enforcing prohibited cavitation band (60.1-92.4%) and fuel burn rates | M1 | Telemetry Catalog §2.4 |
| 6 | Touchdown Structural Validator | Evaluates contact conditions: Vx <= 1.22 m/s, Vz <= 2.13-3.05 m/s, surface tilt <= 12 deg, angular rate <= 2 deg/s | M1 | Telemetry Catalog §4.3 |
| 7 | Apollo 11 Telemetry Channels (20 Metrics) | Computes and exposes GET, GLOM, TWR, Altitude, Inertial Velocity, Max-Q Dynamic Pressure, Axial Acceleration, AGC CPU Duty Cycle, IMU Gimbal Angles, DPS Propellant, etc. | M1 | Telemetry Catalog §1-7 |
| 8 | DAG Continuous Multi-Resource Propagation | Propagates electrical power (Fuel Cells, Batteries), propellants, and consumables across discrete time-steps | M1 | Telemetry Catalog §2.2 |
| 9 | Multi-Criteria Scoring & Failure Tracing | Computes composite score Score = ws*S - wc*C - wr*R and constructs failure chain diagnostics | M1 | Telemetry Catalog §5.1 |
| 10 | WASM Export Layer (`sim-wasm`) | Exposes core simulation calculations, step propagation, and health check via `wasm-bindgen` | M1 | Architecture Spec §4.1 |
| 11 | Automated Engine Calculation Tests | Unit and integration tests validating calculations against technical research telemetry catalog specs | M1 | ORIGINAL_REQUEST.md AC |
| 12 | External Launch Weather API & Fallback | Retrieves KSC Pad 39A weather via Open-Meteo with deterministic offline fallback to Apollo 11 July 16, 1969 data | M2 | ORIGINAL_REQUEST.md R2 |
| 13 | External Map & Geography API & Fallback | Retrieves Pad 39A and Tranquility Base coordinates via OSM/NASA GIBS with offline fallback | M2 | ORIGINAL_REQUEST.md R2 |
| 14 | External Mass / Ephemeris API & Fallback | Retrieves AS-506 component masses via NASA Horizons/NTRS with offline fallback | M2 | ORIGINAL_REQUEST.md R2 |
| 15 | Server Launch Telemetry & Weather Endpoints | Express REST endpoints (`/api/launch/telemetry`, `/api/weather/ksc`) providing integrated launch data | M2 | ORIGINAL_REQUEST.md R2, R3 |
| 16 | Server Authoritative Sim Bridge | Server-side validation and scoring bridge using `sim-core` logic | M2 | Architecture Spec §4.3 |
| 17 | Apollo 11 Vehicles & Payload Configuration | Replaces fictional vehicles with Saturn V AS-506, CSM Columbia, LM Eagle, and EASEP science package | M3 | ORIGINAL_REQUEST.md R1 |
| 18 | Apollo 11 Historical Crew & Mission Characters | Armstrong, Aldrin, Collins, Kranz, Bales, Garman replacing fictional personas | M3 | ORIGINAL_REQUEST.md R1 |
| 19 | Narrative Branching State Machine | 5 historical decision nodes (Inspection, Weather Go/Hold, TLC Trajectory, AGC 1201/1202 Alarm, P66 Landing vs Abort) affecting gameplay state | M3 | ORIGINAL_REQUEST.md R1 |
| 20 | Multiple Distinct Reachable Endings | 5 reachable endings: Historic Landing, Safe Abort to Orbit, Rough Landing/Stranded, Bingo Fuel Abort, Ascent Catastrophe | M3 | ORIGINAL_REQUEST.md R1 |
| 21 | Dedicated Ending Placeholder Scenes | Specialized scene components, debrief reports, and failure diagnostics for each ending | M3 | ORIGINAL_REQUEST.md R1 |
| 22 | Frontend Launch Adapter Server Integration | Client adapter fetching launch telemetry and weather from server with local fallback | M4 | ORIGINAL_REQUEST.md R3 |
| 23 | Web Worker & WASM Simulation Bridge | Browser Web Worker executing `sim-wasm` calculations and streaming telemetry to UI state | M4 | ORIGINAL_REQUEST.md R3 |
| 24 | Full-Stack Scene & HUD Telemetry Wiring | Wires real engine telemetry into Launch, Orbit, and Lunar Descent scenes without errors | M4 | ORIGINAL_REQUEST.md R3 |
| 25 | End-to-End Application Integrity | Full-stack connectivity verified without unhandled errors, broken promises, or crashes | M4 | ORIGINAL_REQUEST.md R3 |
| 26 | E2E Test Suite (Tiers 1-4) 100% Pass | Full verification against requirements-driven test suite | M5 | Project Pattern Final Milestone |
| 27 | Tier 5 Adversarial Coverage Hardening | White-box adversarial testing, edge case hardening, and bug fixing | M5 | Project Pattern Final Milestone |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| M1 | Sim Engine Calculations & WASM Export | `crates/sim-core`, `crates/sim-wasm`: Implement physical equations, orbital mechanics, descent dynamics, 20 telemetry channels, scoring, and automated tests. Export via `wasm-pack`. | none | DONE |
| M2 | External Launch Data & Server Endpoints | `apps/server`: LaunchDataService for weather, map, mass APIs with robust offline fallbacks, REST endpoints (`/api/launch/telemetry`, `/api/weather/ksc`), and simBridge. | none (contract with M1) | DONE |
| M3 | Apollo 11 Narrative Branching & Multiple Endings | `apps/web/src/game`, `apps/web/src/components/cutscene`, `apps/web/src/mocks`: Saturn V AS-506, historical characters, 5 branching points, 5 distinct endings, and ending scenes. | none | DONE |
| M4 | Full-Stack Integration & WASM Worker Wiring | `apps/web/src/lib/simulation`, `apps/web/src/workers`, `apps/web/src/hooks`: Connect frontend to server endpoints, wire Web Worker to `sim-wasm`, integrate HUD telemetry, verify clean runtime. | M1, M2, M3 | DONE |
| M5 | E2E Verification & Adversarial Hardening | Run 100% of E2E tests (Tiers 1-4 from `TEST_READY.md`), fix all integration defects, and execute Tier 5 adversarial hardening loop. | M4, E2E Track | DONE |

## Interface Contracts

### 1. `crates/sim-core` ↔ `crates/sim-wasm`
- `LaunchConfiguration`: `{ vehicle_mass: f64, propellant_mass: f64, payload_mass: f64, stage_count: u32, target_orbit_km: f64, wind_speed_kmh: f64 }`
- `LaunchValidation`: `{ is_valid: bool, glom_kg: f64, liftoff_twr: f64, max_q_kpa: f64, max_q_time_s: f64, payload_margin_kg: f64, failure_reason: Option<String> }`
- `OrbitalState`: `{ semi_major_axis_km: f64, eccentricity: f64, inclination_deg: f64, period_seconds: f64, apoapsis_km: f64, periapsis_km: f64, is_in_eclipse: bool }`
- `DescentState`: `{ altitude_m: f64, vertical_velocity_mps: f64, horizontal_velocity_mps: f64, throttle_pct: f64, propellant_remaining_kg: f64, agc_cpu_duty_pct: f64, is_bingo_fuel: bool, is_landed: bool, touchdown_status: String }`
- `SimulationResult`: `{ success: bool, final_score: f64, telemetry: Vec<TelemetryPoint>, failure_chain: Vec<String> }`

### 2. `apps/server` REST API ↔ `apps/web`
- `GET /api/weather/ksc`: Returns `{ temperature_c: number, pressure_kpa: number, wind_speed_kmh: number, wind_direction_deg: number, humidity_pct: number, status: "GO" | "HOLD" | "NO-GO", source: "api" | "offline_fallback" }`
- `GET /api/launch/telemetry`: Returns `{ mission_id: "AS-506", target: "Tranquility Base", coordinates: { lat: number, lon: number }, vehicle: { glom_kg: number, stages: [...] }, weather: LaunchWeather, source: "api" | "offline_fallback" }`
- `POST /api/simulation/validate`: Accepts `MissionDesign`, returns authoritative `SimulationResult`.

### 3. `crates/sim-wasm` ↔ `apps/web` (Web Worker)
- `init_wasm()`: Loads `sim_wasm_bg.wasm`.
- `ping()`: Returns `"sim-wasm v1.0.0 (Apollo 11 engine)"`.
- `validate_launch(json_str)`: Returns serialized `LaunchValidation`.
- `run_descent_step(json_str)`: Computes 1s physics step and returns serialized `DescentState`.
- `calculate_score(json_str)`: Returns composite evaluation score.

## Code Layout
- Existing conventions respected across monorepo:
  - `crates/sim-core/src/`: Core physics algorithms and unit tests
  - `crates/sim-wasm/src/`: Wasm-bindgen exports
  - `apps/server/src/`: Express app, routes, services, validators
  - `apps/web/src/game/`: Narrative flow, script, character data, game store
  - `apps/web/src/components/cutscene/`: Dialogue, cutscenes, ending screens
  - `apps/web/src/lib/simulation/`: Client simulation adapters
  - `apps/web/src/workers/`: Background simulation worker
