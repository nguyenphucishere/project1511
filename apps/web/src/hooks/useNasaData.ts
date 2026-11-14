"use client";

import { useEffect, useState } from "react";
import { fetchNasaMissionData, OFFLINE_NASA_DATA, type NasaMissionData } from "@/lib/simulation/nasa.adapter";

/**
 * NASA mission feeds for the HUD. Renders the Apollo 11 baseline immediately, then swaps in the
 * server's data when it arrives (never throws; offline keeps the baseline).
 */
export function useNasaData(): NasaMissionData {
  const [data, setData] = useState<NasaMissionData>(OFFLINE_NASA_DATA);
  useEffect(() => {
    let alive = true;
    fetchNasaMissionData().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);
  return data;
}
