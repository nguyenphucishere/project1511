"use client";

import React from "react";
import type { SpacecraftComponent } from "@space-sim/shared-schema";

export interface ComponentDrawerProps {
  components?: SpacecraftComponent[];
  onSelectComponent?: (component: SpacecraftComponent) => void;
}

export function ComponentDrawer(_props: ComponentDrawerProps) {
  // TODO: Implement ComponentDrawer
  return <div className="border border-dashed p-4 text-center">ComponentDrawer Placeholder</div>;
}
