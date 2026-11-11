/**
 * Named input actions. Gameplay asks "is lookLeft held?", never "is ArrowLeft held?";
 * bindings are data so they can be remapped later without touching scene code.
 * Keys are matched by KeyboardEvent.code (physical position), so WASD works on any layout.
 */
export type Action = "lookLeft" | "lookRight" | "lookUp" | "lookDown";

export const BINDINGS: Record<Action, string[]> = {
  lookLeft: ["ArrowLeft", "KeyA"],
  lookRight: ["ArrowRight", "KeyD"],
  lookUp: ["ArrowUp", "KeyW"],
  lookDown: ["ArrowDown", "KeyS"],
};

export function actionFor(code: string): Action | undefined {
  return (Object.keys(BINDINGS) as Action[]).find((a) => BINDINGS[a].includes(code));
}

/** Keys typed into a field or used by a widget (tabs, radio groups) must not move the camera. */
export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el?.closest("input, textarea, select, [contenteditable='true'], [role='group'], [role='tablist'], [role='slider']");
}
