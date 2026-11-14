"use client";

import { useEffect, useState } from "react";
import { fetchDsnLink, fetchEngineApollo11, fetchEngineStatus } from "@/lib/simulation/engine.adapter";
import type { DsnLinkData, EngineApollo11Data, EngineStatusData } from "@/lib/simulation/nasa.types";

export interface ServerEngineData {
  status: EngineStatusData | null;
  apollo11: EngineApollo11Data | null;
  /** Engine link budget on the live Earth–Moon distance (null until / unless the server answers). */
  dsnLink: DsnLinkData | null;
}

/** Server-side engine results for the HUD; every field stays null when the server is offline. */
export function useServerEngine(options: { apollo11?: boolean } = {}): ServerEngineData {
  const wantApollo = options.apollo11 ?? true;
  const [data, setData] = useState<ServerEngineData>({ status: null, apollo11: null, dsnLink: null });
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchEngineStatus(),
      wantApollo ? fetchEngineApollo11() : Promise.resolve(null),
      fetchDsnLink(),
    ]).then(([status, apollo11, dsnLink]) => {
      if (alive) setData({ status, apollo11, dsnLink });
    });
    return () => {
      alive = false;
    };
  }, [wantApollo]);
  return data;
}
