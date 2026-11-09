import { create } from "zustand";
import type { SpacecraftComponent } from "@space-sim/shared-schema";

export interface EditorState {
  selectedSlot: number | null;
  selectedComponent: SpacecraftComponent | null;
  setSelectedSlot: (slot: number | null) => void;
  setSelectedComponent: (component: SpacecraftComponent | null) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedSlot: null,
  selectedComponent: null,
  setSelectedSlot: (slot) => set({ selectedSlot: slot }),
  setSelectedComponent: (component) => set({ selectedComponent: component }),
}));
