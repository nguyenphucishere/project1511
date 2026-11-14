# E2E Test Infra: Apollo 11 Mission Simulation & Interactive Narrative

## Test Philosophy
- **Opaque-Box & Requirement-Driven**: Tests are derived strictly from `ORIGINAL_REQUEST.md` (R1, R2, R3) and `apollo_program_technical_research_simulation_telemetry_catalog.md`, treating the system under test as a black box. No dependency on private internal implementation details.
- **Methodology**: Systematic 4-tier test engineering combining Category-Partition Equivalence Class testing (Tier 1), Boundary Value Analysis (Tier 2), Pairwise Combinatorial Interaction testing (Tier 3), and Real-World Workload/Mission Simulation testing (Tier 4).
- **Zero-External Network Dependency**: All tests run 100% offline and in-process. Server endpoints are tested against real in-process ephemeral Express+WebSocket servers; physics and calculations are tested against compiled WebAssembly binaries executed in Node.js; narrative states are tested against real game state machines.

## Feature Inventory & Test Matrix
| # | Feature | Requirement Source | Tier 1 (Features) | Tier 2 (Boundaries) | Tier 3 (Combinations) | Tier 4 (Workloads) |
|---|---|---|:---:|:---:|:---:|:---:|
| 1 | Apollo 11 Narrative Branching State Machine | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | Multiple Distinct Reachable Endings & Scenes | ORIGINAL_REQUEST §R1 | 5 | - | ✓ | ✓ |
| 3 | Multi-Stage Saturn V Ascent Physics & Max-Q | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 4 | Keplerian Orbit Solver & Lunar Eclipse Shadow | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 5 | LM Powered Descent Throttle & Touchdown Limits | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 6 | Apollo 11 Telemetry (20 Channels) & DAG Consumables | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 7 | External Launch Data REST APIs & Offline Fallback | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 8 | Full-Stack End-to-End Integration & WASM Wiring | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| **Total** | **8 Core Feature Areas** | | **40 tests** | **35 tests** | **5 tests** | **5 scenarios** |

## Test Architecture
- **Test Runner**: Node.js Native Test Runner driven by `tsx --test`
- **Location**: `/workspaces/project1511/tests/e2e`
- **Invocation Command**:
  ```bash
  pnpm run test:e2e
  ```
  *(Direct execution: `./apps/server/node_modules/.bin/tsx --test "tests/e2e/**/*.test.ts"`)*
- **Pass/Fail Semantics**: Standard Node.js exit codes (exit code 0 on all tests passing, non-zero on any failure or unhandled rejection).
- **Directory Layout**:
  ```
  tests/e2e/
  ├── harness/
  │   ├── serverHarness.ts       # Ephemeral in-process Express + WS server lifecycle
  │   ├── wasmHarness.ts         # sim-wasm WebAssembly direct loader & type wrappers
  │   ├── gameFlowHarness.ts     # Narrative branching and game state engine
  │   └── assertions.ts          # Telemetry, physics tolerances, and schema validators
  ├── tier1-feature-coverage/
  │   ├── feature1-narrative-branching.test.ts
  │   ├── feature2-endings-scenes.test.ts
  │   ├── feature3-saturn-v-ascent.test.ts
  │   ├── feature4-kepler-orbit.test.ts
  │   ├── feature5-powered-descent.test.ts
  │   ├── feature6-telemetry-dag.test.ts
  │   ├── feature7-external-apis.test.ts
  │   └── feature8-fullstack-wiring.test.ts
  ├── tier2-boundaries/
  │   ├── boundary-vehicle-limits.test.ts
  │   ├── boundary-throttle-cavitation.test.ts
  │   ├── boundary-bingo-propellant.test.ts
  │   ├── boundary-agc-overflow.test.ts
  │   └── boundary-network-degradation.test.ts
  ├── tier3-combinations/
  │   ├── combo-weather-throttle.test.ts
  │   ├── combo-agc-pitchover.test.ts
  │   ├── combo-obstacle-fuel.test.ts
  │   ├── combo-power-eclipse.test.ts
  │   └── combo-descent-abort.test.ts
  └── tier4-scenarios/
      ├── scenario-historic-landing.test.ts
      ├── scenario-safe-abort.test.ts
      ├── scenario-rough-landing.test.ts
      ├── scenario-bingo-abort.test.ts
      └── scenario-ascent-catastrophe.test.ts
  ```

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Target Ending / Result | Complexity |
|---|---|---|---|---|
| 1 | Historical Apollo 11 Mission | F1, F2, F3, F4, F5, F6, F7, F8 | Historic Landing at Tranquility Base with Armstrong & Aldrin | High |
| 2 | High Gate Trajectory Deviation | F1, F2, F4, F5, F6, F8 | Safe Abort to Lunar Orbit with CSM Columbia Rendezvous | High |
| 3 | Lunar Boulder Field Landing | F1, F2, F5, F6, F8 | Rough Landing / Stranded on Lunar Surface (Gear Failure) | High |
| 4 | P66 Extended Hover Fuel Depletion | F1, F2, F5, F6, F8 | Bingo Fuel Abort (Mandatory DPS to APS Separation) | High |
| 5 | Pad 39A Launch Weather / Pitch Divergence | F1, F2, F3, F7, F8 | Ascent Catastrophe (Max-Q Structural Breakup / Range Safety) | High |

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: ≥5 tests per feature group across all 8 features (≥40 tests minimum).
- **Tier 2 (Boundary & Corner Cases)**: ≥5 tests per boundary domain (mass limits, cavitation band, bingo fuel, AGC overflow, network timeouts) (≥25 tests minimum).
- **Tier 3 (Cross-Feature Combinations)**: Pairwise interaction tests covering flight dynamics, telemetry alarms, consumables, and narrative decision branches (≥5 complex pairwise interactions).
- **Tier 4 (Real-World Application Scenarios)**: Realistic end-to-end mission workflows exercising the full-stack architecture to all 5 distinct endings (≥5 full-mission scenarios).
- **Total Suite Minimum**: ≥75 comprehensive opaque-box test cases.
