import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/i18n";
import { safeLocalStorage } from "@/lib/safeStorage";

export interface SettingsState {
  locale: Locale;
  pixelFX: boolean;
  /** true forces reduced motion; false follows the OS setting. */
  reduceMotion: boolean;
  setLocale: (locale: Locale) => void;
  togglePixelFX: () => void;
  setReduceMotion: (value: boolean) => void;
}

/**
 * Per-player preferences. Persisted, but rehydration is manual (see Providers) so the
 * server render and first client render agree, then saved settings apply.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      locale: DEFAULT_LOCALE,
      pixelFX: true,
      reduceMotion: false,
      setLocale: (locale) => set({ locale }),
      togglePixelFX: () => set((s) => ({ pixelFX: !s.pixelFX })),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
    }),
    {
      name: "moonbound.settings",
      version: 1,
      storage: safeLocalStorage,
      skipHydration: true,
      partialize: ({ locale, pixelFX, reduceMotion }) => ({ locale, pixelFX, reduceMotion }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        return {
          ...current,
          locale: isLocale(p.locale) ? p.locale : current.locale,
          pixelFX: typeof p.pixelFX === "boolean" ? p.pixelFX : current.pixelFX,
          reduceMotion: typeof p.reduceMotion === "boolean" ? p.reduceMotion : current.reduceMotion,
        };
      },
    },
  ),
);
