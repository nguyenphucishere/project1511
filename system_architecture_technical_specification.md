# Collaborative Space Mission Simulator: System Architecture & Technical Specification

This document details the complete technical architecture, project directory layout, technology stack, and component subsystem designs for the collaborative educational space mission engineering simulator.

## 1. Technology Stack

### 1.1 Core Simulation Engine

* **Language:** Rust (2021 edition)

* **Compilation targets:**

  * `wasm32` via `wasm-bindgen` for client-side, zero-latency design verification.

  * Native target (`x86_64` / `aarch64`) for server-side authoritative simulation, anti-cheat validation, and scoring runs.

* **Key crates:**

  * `nalgebra` / `glam`: Vector, matrix, and orbital state vector mathematics.

  * `petgraph`: DAG for continuous multi-resource propagation.

  * `serde`, `serde_json`: High-throughput serialization across the FFI boundary.

### 1.2 Frontend Application

* **Framework:** Next.js (app router) + react + typescript.

* **Styling & Design System:** Tailwind CSS + Radix UI primitives (`shadcn/ui`) for mission control telemetry dashboards.

* **Graphics & Rendering Pipeline:**

  * **2.5D World:** Three.js via `@react-three/fiber` and `@react-three/drei`.

  * **Pixel pipeline:** Custom downscale-upscale FBO render targets with nearest-neighbor texture sampling and post-processing shaders.

  * **2D Cutscenes & Narrative:** Rive / Spine Web Runtime + HTML5 multi-plane parallax canvas.

* **Client State Management:**

  * `zustand`: Ephemeral local UI state, active HUD modes, and camera viewports.

  * Web Workers: Off-thread execution of simulation loops using the WASM module.

  * `uPlot`: Low-overhead 60 FPS real-time resource graphs.

### 1.3 Real-Time Synchronization & Multiplayer

* **State Synchronization:** Yjs (Conflict-free Replicated Data Type - CRDT).

* **Transport Protocol:** WebSockets (`y-websocket`) with role-based field locking.

* **Signaling & Session Server:** Node.js (TypeScript) or Go running on a standalone container.

### 1.4 Backend, Storage & Infrastructure

* **Server Platform:** TypeScript

* **Database:** PostgreSQL (relational schema for user accounts, missions, and leaderboards; JSONB columns for design schematics).

* **Cache & Pub/Sub:** Redis (room matchmaking, user presence, and session locks).

* **Packaging & Monorepo Tooling:** `pnpm` workspaces + Turborepo + Cargo workspaces.

## 2. Monorepo Project Structure

```
space-mission-sim/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # Build, lint, test, and WASM compilation
│       └── deploy.yml
├── apps/
│   ├── web/                           # Next.js Frontend Application
│   │   ├── public/
│   │   │   ├── assets/
│   │   │   │   ├── cutscenes/         # Rive/Spine files, vector art, audio stems
│   │   │   │   ├── sprites/           # Modular satellite parts, UI atlas sheets
│   │   │   │   └── fonts/             # Retro monospace and sci-fi typography
│   │   │   └── wasm/                  # Generated WASM artifacts and bindings
│   │   ├── src/
│   │   │   ├── app/                   # Next.js App Router
│   │   │   │   ├── (auth)/            # Auth routes & room lobby
│   │   │   │   ├── mission/
│   │   │   │   │   ├── [id]/          # Collaborative multi-user mission editor
│   │   │   │   │   └── sandbox/       # Single-player unconstrained sandbox
│   │   │   │   ├── debrief/           # Post-mission reports & analysis
│   │   │   │   └── leaderboards/      # Score rankings
│   │   │   ├── components/
│   │   │   │   ├── cutscene/          # 2D cutscene players and dialogue systems
│   │   │   │   │   ├── CutscenePlayer.tsx
│   │   │   │   │   ├── DialogueOverlay.tsx
│   │   │   │   │   └── ParallaxCanvas.tsx
│   │   │   │   ├── dashboard/         # Real-time resource monitors & gauges
│   │   │   │   │   ├── DataBufferPlot.tsx
│   │   │   │   │   ├── PowerBudgetGauge.tsx
│   │   │   │   │   └── ResourceTimeline.tsx
│   │   │   │   ├── editor/            # Bus assembly and slot-socket controls
│   │   │   │   │   ├── BusSocketGrid.tsx
│   │   │   │   │   ├── ComponentDrawer.tsx
│   │   │   │   │   └── SubsystemInspector.tsx
│   │   │   │   ├── ui/                # Common UI primitives
│   │   │   │   └── viewport/          # 2.5D Semi-3D rendering engine
│   │   │   │       ├── LightingRig.tsx
│   │   │   │       ├── PixelCamera.tsx
│   │   │   │       ├── PixelPostProcess.tsx
│   │   │   │       ├── SpacecraftBillboard.tsx
│   │   │   │       └── WorldCanvas.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useMultiplayerRoom.ts # Yjs CRDT hook
│   │   │   │   ├── usePixelGridSnap.ts   # Sub-pixel anti-jitter hook
│   │   │   │   └── useSimulationWasm.ts  # Web Worker FFI bridge
│   │   │   ├── shaders/               # Custom GLSL shaders
│   │   │   │   ├── dither.frag
│   │   │   │   └── pixelate.frag
│   │   │   ├── stores/                # Ephemeral local state (Zustand)
│   │   │   │   ├── editorStore.ts
│   │   │   │   └── sessionStore.ts
│   │   │   └── workers/
│   │   │       └── simulation.worker.ts  # Web Worker executing sim-wasm
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── server/                        # WebSocket sync & authoritative runner
│       ├── src/
│       │   ├── handlers/              # Connection management & presence
│       │   ├── services/
│       │   │   ├── authService.ts
│       │   │   └── missionService.ts
│       │   ├── sync/                  # Yjs WebSocket persistence provider
│       │   ├── validator/             # Native Rust simulation validation bridge
│       │   └── index.ts
│       ├── Dockerfile
│       └── package.json
│
├── packages/
│   ├── shared-schema/                 # Shared TypeScript models and Zod schemas
│   │   ├── src/
│   │   │   ├── mission.ts             # Mission goals, constraints, scoring thresholds
│   │   │   ├── orbit.ts               # Orbit Keplerian parameters & launch enums
│   │   │   ├── payload.ts             # Modular components & specification catalog
│   │   │   └── roles.ts               # Subsystem permission rules & locks
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── eslint-config/                 # Monorepo linting configurations
│
├── crates/                            # Rust Workspace (Simulation Core)
│   ├── sim-core/                      # Pure, platform-agnostic simulation engine
│   │   ├── src/
│   │   │   ├── evaluator.rs           # Mission failure tracer & composite scoring
│   │   │   ├── kepler.rs              # Conic sections, orbital mechanics, J2 drift
│   │   │   ├── launch.rs              # Launch vehicle envelope & delta-V validator
│   │   │   ├── lib.rs
│   │   │   └── resource_graph.rs      # Continuous DAG resource propagation solver
│   │   └── Cargo.toml
│   │
│   └── sim-wasm/                      # WebAssembly export layer for browser client
│       ├── src/
│       │   └── lib.rs                 # wasm-bindgen exported classes and methods
│       └── Cargo.toml
│
├── docker-compose.yml                 # Local dev orchestration (PostgreSQL, Redis)
├── package.json                       # Root scripts and workspace settings
├── pnpm-workspace.yaml
├── turbo.json                         # Turborepo task pipeline
└── Cargo.toml                         # Cargo workspace configuration

```

## 3. High-Level System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                          Client Browser                                │
│                                                                        │
│  ┌─────────────────────────┐           ┌────────────────────────────┐  │
│  │   UI & HUD Dashboards   │           │ 2.5D Semi-3D Render View   │  │
│  │  (Tailwind + Radix UI)  │           │   (Three.js / R3F + FBO)   │  │
│  └────────────┬────────────┘           └─────────────┬──────────────┘  │
│               │                                      │                 │
│               ▼                                      ▼                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   Zustand & Yjs Local Store                      │  │
│  │     - Role assignments    - Spacecraft bus & component graph     │  │
│  │     - Orbit elements      - Ephemeral selection & cursors        │  │
│  └────────────┬──────────────────────────────────────┬──────────────┘  │
│               │                                      │                 │
│               ▼                                      ▼                 │
│  ┌─────────────────────────┐           ┌────────────────────────────┐  │
│  │   Simulation Worker     │           │   Yjs WebSocket Client     │  │
│  │   (sim-wasm via Worker) │           │   (State Synchronization)  │  │
│  └─────────────────────────┘           └─────────────┬──────────────┘  │
└──────────────────────────────────────────────────────┼─────────────────┘
                                                       │ WebSocket
                                                       ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Backend Infrastructure                          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                    Multiplayer Sync Server                       │  │
│  │          - Room Authority          - Role Field-Level Locks      │  │
│  │          - Yjs Persistence         - Redis Session Store         │  │
│  └────────────┬──────────────────────────────────────┬──────────────┘  │
│               │                                      │                 │
│               ▼                                      ▼                 │
│  ┌─────────────────────────┐           ┌────────────────────────────┐  │
│  │  Authoritative Runner   │           │   PostgreSQL Database      │  │
│  │  (sim-core Native Run)  │           │   - Missions & Schematics  │  │
│  │  - Final score verification         │   - User data & Records    │  │
│  │  - Anti-cheat evaluation│           │   - Leaderboards           │  │
│  └─────────────────────────┘           └────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘

```

## 4. Subsystem Architectures

### 4.1 Frontend Architecture

The frontend integrates standard dashboard interfaces with a low-resolution retro 3D viewport and rich 2D story sequences.

```
                    ┌─────────────────────────┐
                    │    Root App Layout      │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         ▼                       ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ 2.5D Viewport   │     │ Telemetry HUD   │     │ 2D Cutscene     │
│ (WorldCanvas)   │     │ (Dashboard UI)  │     │ Player (Overlay)│
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         ▼                       │                       │
┌─────────────────┐              │                       │
│ Low-Res FBO     │              │                       │
│ Render Target   │              │                       │
└────────┬────────┘              │                       │
         │ Upscale /             │                       │
         ▼ Nearest-Filter        │                       │
┌─────────────────┐              │                       │
│ Screen Canvas   │◄─────────────┴───────────────────────┘
└─────────────────┘

```

#### A. 2.5D Semi-3D Rendering Pipeline

1. **Low-Resolution Off-Screen Pass:** The scene is rendered to a low-resolution Framebuffer Object (e.g., $320 \times 180$ or $640 \times 360$).

2. **Fixed Pitch Camera:** An orthographic or low-FOV camera fixed at $\arctan(1/2) \approx 26.565^\circ$ provides depth without angular distortion.

3. **Billboard Sprites:** Satellite modules, scientific sensors, and celestial bodies are 2D quads textured with `NearestFilter` and `depthWrite: true`. Cylindrical billboarding ensures sprites align toward the viewing plane.

4. **Post-processing pass:** The off-screen buffer is upscaled via a full-screen quad using custom fragment shaders applying optional palette quantization, Bayer dithering, and cell shading.

5. **Sub-pixel snapping:** Vertex positions are snapped to the virtual pixel grid via `usePixelGridSnap` to avoid pixel crawling and visual jitter during camera translation.

#### B. 2D Cutscene & Narrative Engine

* Built using **Rive** or **Spine Web Runtime** combined with a layered Canvas2D/WebGL component.

* Supports multi-plane parallax scrolling (e.g., distant starfield, planetary horizon, cockpit frame).

* Coordinated through a centralized cutscene director supporting typewriter text pacing, choice branches, and audio ducking.

### 4.2 Core Simulation Engine (`crates/sim-core` & `crates/sim-wasm`)

The simulation engine is fully decoupled from the UI and rendering code. It is deterministic: identical inputs yield identical outputs across all architectures.

```
                    ┌───────────────────────────┐
                    │   Mission Configuration   │
                    │   - Spacecraft Components │
                    │   - Target Orbit Elements │
                    │   - Launch Vehicle Choice │
                    └─────────────┬─────────────┘
                                  │
         ┌────────────────────────┴────────────────────────┐
         ▼                                                 ▼
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│       Kepler Orbit Engine       │       │       Launch Matcher            │
│  - State Vectors & Propagation  │       │  - Payload Mass vs Target Curve │
│  - Eclipse Duration Calculator  │       │  - Delta-V Capacity Check       │
│  - Ground Station Line-of-Sight │       │  - Structural Envelope Check    │
└────────────────┬────────────────┘       └────────────────┬────────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      │
                                      ▼
                 ┌─────────────────────────────────────────┐
                 │          Resource Graph (DAG)           │
                 │  - Power: Solar / Battery / Subsystems  │
                 │  - Data: Sensors -> Buffers -> Downlink │
                 │  - Mass & Thermal Balances              │
                 │  - Propagation over T = 0..N Steps      │
                 └────────────────────┬────────────────────┘
                                      │
                                      ▼
                 ┌─────────────────────────────────────────┐
                 │       Evaluator & Failure Tracer        │
                 │  - Constraint Checking & Anomaly Tracing│
                 │  - Causal Failure Chain Construction    │
                 │  - Multi-Criteria Scoring Formula       │
                 └─────────────────────────────────────────┘

```

#### A. Keplerian Orbit Module (`kepler.rs`)

* Solves Kepler's equation:
  

  $$
  M = E - e \sin(E)
  $$

  
  to determine eccentric and true anomalies over time.

* Calculates solar eclipse intervals (umbra and penumbra) for power balance.

* Applies secular perturbations caused by Earth's oblateness ($J_2$ effect) to verify Sun-synchronous orbits:
  

  $$
  \dot{\Omega} = -\frac{3}{2} J_2 \left(\frac{R_E}{p}\right)^2 n \cos(i)
  $$

* Determines line-of-sight access intervals to ground stations for communication link windows.

#### B. Launch Vehicle Envelope Matcher (`launch.rs`)

* Evaluates total wet and dry mass against the launch vehicle's payload capacity curve for the selected orbital inclination and apogee/perigee altitudes.

* Rejects invalid configurations and emits diagnostics (e.g., mass exceeds booster capacity, target orbit apogee exceeds second-stage reach).

#### C. Continuous Resource DAG Engine (`resource_graph.rs`)

* Built upon a Directed Acyclic Graph where components act as:

  * **Producers:** Solar arrays (output depends on solar distance and eclipse status).

  * **Storage:** Batteries, solid-state memory recorders, propellant tanks.

  * **Consumers:** Transponders, attitude control thrusters, scientific sensors, payload electronics.

* Iterates through discrete time-steps ($\Delta t$) over the planned mission lifecycle, evaluating depletion, overflow, and thermal thresholds.

#### D. Evaluator & Diagnostic Tracer (`evaluator.rs`)

* Identifies failures and constructs a causal failure trace (e.g., *Battery Depleted* $\rightarrow$ *Instrument Shutdown* $\rightarrow$ *Zero Science Return*).

* Calculates the final mission score using weighted criteria:
  

  $$
  \text{Score} = w_s \cdot S - w_c \cdot C - w_r \cdot R
  $$

  
  where $S$ is total scientific return, $C$ is budget utilization, and $R$ is the risk factor.

### 4.3 Real-Time & Multiplayer Layer

Multiplayer sessions support up to four distinct functional roles:

| Role | Responsibilities | Modifiable Subsystems | 
| ----- | ----- | ----- | 
| **Mission Commander** | Budget, timeline, trajectory, launch vehicle selection | Mission objective, orbit parameters, booster selection | 
| **Systems Engineer** | Bus structural layout, power systems, thermal controls | Structure dimensions, solar panels, batteries | 
| **Payload Scientist** | Science instruments, operational duty cycles | Science instruments, experiment scheduling | 
| **Comms / Operations** | Telemetry, antenna gain, ground station scheduling | Antennas, transponders, onboard memory | 

```
[Client 1: Commander]    [Client 2: Systems]    [Client 3: Science]    [Client 4: Comms]
         │                        │                      │                     │
         │ Edit Orbit             │ Edit Bus             │ Edit Sensors        │ Edit Antenna
         └───────────┬────────────┴──────────────┬───────┴─────────────────────┘
                     │                           │
                     ▼                           ▼
          ┌─────────────────────────────────────────────┐
          │         Yjs Shared Document (CRDT)          │
          │  - Y.Map("orbit")       [Locked to Cmdr]    │
          │  - Y.Map("spacecraft")  [Locked to Systems] │
          │  - Y.Array("payload")   [Locked to Science] │
          │  - Y.Map("comms")       [Locked to Comms]   │
          └──────────────────────┬──────────────────────┘
                                 │
                                 ▼ WebSocket
          ┌─────────────────────────────────────────────┐
          │              y-websocket Server             │
          │  - Verifies role authorization per key      │
          │  - Persists doc state to PostgreSQL         │
          │  - Broadcasts delta updates to peers        │
          └─────────────────────────────────────────────┘

```

#### A. Role-Based Field Locking

* The mission design state is represented as a single Yjs document containing scoped `Y.Map` and `Y.Array` sub-trees.

* Field-level mutations are validated before being committed to the shared CRDT document. Unassigned roles can view the configuration in real-time but cannot mutate fields outside their assigned domain.

#### B. Optimistic Local Feedback Loop

* Whenever a player modifies a parameter (e.g., the Systems Engineer adds a battery module):

  1. The change applies optimistically to the local CRDT document.

  2. The local Web Worker intercepts the change and runs the `sim-wasm` engine.

  3. UI telemetry graphs update instantly ($< 16\,\text{ms}$) without waiting for network round-trips.

  4. The delta is pushed via WebSocket to teammates, whose local Web Workers re-evaluate telemetry graphs in parallel.

#### C. Authoritative Mission Commitment

* When the team initiates the mission simulation phase:

  1. The server serializes the final Yjs mission document into standard JSON.

  2. The native `sim-core` executable re-runs the simulation on the server.

  3. The server generates the authoritative debrief report, assigns leaderboard scores, and stores the results in PostgreSQL.