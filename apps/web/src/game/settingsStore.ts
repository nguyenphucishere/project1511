import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n";
import { safeLocalStorage } from "@/lib/safeStorage";

export interface SettingsState {
  locale: Locale;
  pixelFX: boolean;
  /** true forces reduced motion; false follows the OS setting. */
  reduceMotion: boolean;
  /** Sound effects on or off. Cutscene videos keep their own mute button. */
  sound: boolean;
  setLocale: (locale: Locale) => void;
  togglePixelFX: () => void;
  setReduceMotion: (value: boolean) => void;
  toggleSound: () => void;
}

/**
 * Per-player preferences. Persisted, but rehydration is manual (see Providers) so the
 * server render and first client render agree, then saved settings apply.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      pixelFX: false,
      reduceMotion: false,
      sound: true,
      setLocale: (locale) => set({ locale }),
      togglePixelFX: () => set((s) => ({ pixelFX: !s.pixelFX })),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      toggleSound: () => set((s) => ({ sound: !s.sound })),
    }),
    {
      name: "moonbound.settings",
      version: 2,
      storage: safeLocalStorage,
      skipHydration: true,
      partialize: ({ locale, pixelFX, reduceMotion, sound }) => ({ locale, pixelFX, reduceMotion, sound }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          locale: isLocale(p.locale) ? p.locale : current.locale,
          pixelFX: typeof p.pixelFX === "boolean" ? p.pixelFX : current.pixelFX,
          reduceMotion: typeof p.reduceMotion === "boolean" ? p.reduceMotion : current.reduceMotion,
          sound: typeof p.sound === "boolean" ? p.sound : current.sound,
        };
      },
    },
  ),
);
