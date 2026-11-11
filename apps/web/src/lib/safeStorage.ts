import { createJSONStorage, type StateStorage } from "zustand/middleware";

/**
 * localStorage that never throws: private windows, blocked site data, and quota errors
 * degrade to "nothing saved" instead of crashing the game.
 */
const guarded: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value);
    } catch {
      /* not saved; the game keeps running */
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

export const safeLocalStorage = createJSONStorage(() => guarded);
