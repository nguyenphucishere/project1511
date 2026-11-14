"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { handleWorkerMessage, type WorkerRequestMessage } from "@/workers/simulation.worker";

export interface WasmLaunchConfigInput {
  vehicle_mass?: number;
  propellant_mass?: number;
  payload_mass?: number;
  stage_count?: number;
  target_orbit_km?: number;
  wind_speed_kmh?: number;
}

export interface WasmLaunchValidationResult {
  is_valid: boolean;
  glom_kg: number;
  liftoff_twr: number;
  max_q_kpa: number;
  max_q_time_s: number;
  payload_margin_kg: number;
  failure_reason: string | null;
}

export interface WasmDescentState {
  altitude_m: number;
  vertical_velocity_mps: number;
  horizontal_velocity_mps: number;
  throttle_pct: number;
  propellant_remaining_kg: number;
  agc_cpu_duty_pct: number;
  is_bingo_fuel: boolean;
  is_landed: boolean;
  touchdown_status: string;
}

export interface WasmScoreInput {
  science_score?: number;
  cost_score?: number;
  risk_penalty?: number;
  weight_science?: number;
  weight_cost?: number;
  weight_risk?: number;
  active_anomalies?: string[];
}

export interface WasmScoreResult {
  is_success: boolean;
  final_score: number;
  science_score: number;
  cost_score: number;
  risk_penalty: number;
  failure_chain: string[];
}

export function useSimulationWasm() {
  const [isReady, setIsReady] = useState(false);
  const [version, setVersion] = useState<string>("sim-wasm v1.0.0 (Apollo 11 engine)");
  const [lastValidation, setLastValidation] = useState<WasmLaunchValidationResult | null>(null);
  const [lastDescentState, setLastDescentState] = useState<WasmDescentState | null>(null);
  const [lastScore, setLastScore] = useState<WasmScoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reqCounter = useRef(0);

  const dispatchMessage = useCallback(async <T,>(type: WorkerRequestMessage["type"], payload?: unknown): Promise<T> => {
    const id = `wasm-req-${++reqCounter.current}`;
    const response = await handleWorkerMessage({ id, type, payload });
    if (response.type === "ERROR") {
      const errMsg = response.error ?? "Unknown WASM simulation error";
      setError(errMsg);
      throw new Error(errMsg);
    }
    return response.result as T;
  }, []);

  useEffect(() => {
    let mounted = true;
    dispatchMessage<{ version: string }>("INIT")
      .then((res) => {
        if (!mounted) return;
        if (res?.version) setVersion(res.version);
        setIsReady(true);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
        setIsReady(true);
      });
    return () => {
      mounted = false;
    };
  }, [dispatchMessage]);

  const ping = useCallback(async (): Promise<string> => {
    return dispatchMessage<string>("PING");
  }, [dispatchMessage]);

  const validateLaunch = useCallback(
    async (config: WasmLaunchConfigInput): Promise<WasmLaunchValidationResult> => {
      const res = await dispatchMessage<WasmLaunchValidationResult>("VALIDATE_LAUNCH", config);
      setLastValidation(res);
      return res;
    },
    [dispatchMessage],
  );

  const stepDescent = useCallback(
    async (state: WasmDescentState): Promise<WasmDescentState> => {
      const res = await dispatchMessage<WasmDescentState>("STEP_DESCENT", state);
      setLastDescentState(res);
      return res;
    },
    [dispatchMessage],
  );

  const calculateScore = useCallback(
    async (input: WasmScoreInput): Promise<WasmScoreResult> => {
      const res = await dispatchMessage<WasmScoreResult>("CALCULATE_SCORE", input);
      setLastScore(res);
      return res;
    },
    [dispatchMessage],
  );

  const runSimulation = useCallback(
    async (config: unknown): Promise<WasmLaunchValidationResult> => {
      return validateLaunch((config ?? {}) as WasmLaunchConfigInput);
    },
    [validateLaunch],
  );

  return {
    isReady,
    version,
    error,
    lastValidation,
    lastDescentState,
    lastScore,
    ping,
    validateLaunch,
    stepDescent,
    calculateScore,
    runSimulation,
  };
}
