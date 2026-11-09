Hi guys, you can modify the code in all directories as needed. Make sure to follow the coding standards and best practices outlined in the documentation. If you encounter any issues or have questions, feel free to reach out to **@nguyenphucishere** for assistance.

__BIG NOTES:__ You do not need to use the placeholder structure. You can create your own structure as long as it is **performant**, **scalable** and **maintainable**.

### Build verification commands
- Rust Workspace: `cargo check --workspace`, `cargo check --target wasm32-unknown-unknown -p sim-wasm`, and `cargo test --workspace`.
- WASM Build: `wasm-pack build` (generate `.wasm` artifacts in `apps/web/public/wasm`).
- TypeScript & Next.js: `pnpm turbo run build`.