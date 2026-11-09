use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn init_simulation_panic_hook() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn ping() -> String {
    todo!("sim-wasm ping placeholder")
}

#[wasm_bindgen]
pub fn run_step(_config: JsValue) -> JsValue {
    todo!("run_step placeholder")
}
