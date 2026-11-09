"use client";

import React from "react";
import type { SpacecraftComponent } from "@space-sim/shared-schema";

export interface SubsystemInspectorProps {
  selectedComponent?: SpacecraftComponent | null;
}

export function SubsystemInspector(_props: SubsystemInspectorProps) {
  // TODO: Implement SubsystemInspector
  return <div className="border border-dashed p-4 text-center">SubsystemInspector Placeholder</div>;
}
