/* tslint:disable */
/* eslint-disable */

export function calculate_dsn_telemetry(json_str: string): string;

export function calculate_landing_radar(json_str: string): string;

export function calculate_score(json_str: string): string;

export function evaluate_mission_design_budget(json_str: string): string;

/**
 * Vehicle presets and launch commit criteria the console offers.
 */
export function get_launch_catalog(): string;

export function get_lunar_environment_constants(): string;

export function init_simulation_panic_hook(): void;

export function ping(): string;

/**
 * Launch planning for the mission-control console (vehicle, payload, propellant load, orbit, weather).
 */
export function plan_launch(json_str: string): string;

export function run_descent_step(json_str: string): string;

export function run_step(config: any): any;

/**
 * Scene 4: Saturn V ascent profile from liftoff to parking-orbit insertion.
 */
export function simulate_ascent(json_str: string): string;

/**
 * Scene 6: LM powered descent profile from PDI to the low gate.
 */
export function simulate_powered_descent(json_str: string): string;

export function validate_launch(json_str: string): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly calculate_dsn_telemetry: (a: number, b: number) => [number, number];
    readonly calculate_landing_radar: (a: number, b: number) => [number, number];
    readonly calculate_score: (a: number, b: number) => [number, number];
    readonly evaluate_mission_design_budget: (a: number, b: number) => [number, number];
    readonly get_launch_catalog: () => [number, number];
    readonly get_lunar_environment_constants: () => [number, number];
    readonly init_simulation_panic_hook: () => void;
    readonly ping: () => [number, number];
    readonly plan_launch: (a: number, b: number) => [number, number];
    readonly run_descent_step: (a: number, b: number) => [number, number];
    readonly run_step: (a: any) => any;
    readonly simulate_ascent: (a: number, b: number) => [number, number];
    readonly simulate_powered_descent: (a: number, b: number) => [number, number];
    readonly validate_launch: (a: number, b: number) => [number, number];
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
