## Phase 1 - tới sáng mai (hoặc hết ngày mai):

- Tui với Khoa - setup multiplayer server (hoàn thiện càng nhiều càng tốt)
- My build HUD, theme, 2D cutscene dialogue box (nchung mấy cái components chung chung)
- Giang payload schemas, launch vehicle parameters, and static mass/budget/power validators, og bận thì tui với Khoa nhảy qua làm cung oke.

## Phase 2 - Thu 12/11:
- Phúc: Build sim-wasm wasm-bindgen exports and React Web Worker bridge (useSimulationWasm.ts)
- Khoa: Build modular Spacecraft Editor socket grid (bus, solar panels, batteries, instruments, comms) and local JSON save/load. - tức là chuẩn hóa quy trình gửi socket trong game ấy.
- My: Build Scene 1: Health-Check (subsystem diagnostics) and Scene 2: Pre-Flight Rocket Check (mass vs. launch vehicle capacity validation UI).
- Giang or Phúc or Khoa: Implement Keplerian orbit solver, launch envelope compatibility check, and discrete DAG resource propagation (solar generation, eclipse drain, data buffer vs. downlink).

**Checkpoint 2:** WASM Web Worker successfully sending live tick telemetry into React state - gửi ping được là xong hết phần sườn.

## Phase 3: Fri 13/11
- Phúc: Build Scene 5: In-Space Scene, Scene 6: Landing Scene.
- Khoa: Build Scene 3: Takeoff Check, Scene 4: Atmospheric Escape.
- My: Build cutscene transitions between scenes, telemetry line charts, and real-time warning/alert banners. - transition đồ đó bà, mấy cái video cutscene đồ luôn.

**Checkpoint 3:** All 6 scenes playable in isolation using mocked or live state.

## Phase 4 - Sat 14/11:
- Phúc: Wire full transition loop (lắp cảnh lại).
- Khoa: Connect Spacecraft Editor payload outputs directly into Scene 1–4 parameters; wire Sandbox Mode (unconstrained testing) - cái này cho phần thuyết trình demo, debug đồ đó nha.
- My: Unify HUD overlays across all 6 scenes, hook up SFX/BGM audio triggers, and polish failure diagnostic modals.
- All: Tune scoring weights (Science Value, Efficiency, Cost, Risk), calibrate difficulty presets.

**Checkpoint 4:** Full unbroken playthrough - demo được luôn.

## Phase 5 - ngày cuối:
- Chuẩn bị thuyết trình, quay video; build slide, gặp mentor.
- Deploy lên production.