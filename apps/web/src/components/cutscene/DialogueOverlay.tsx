"use client";

import React from "react";

export interface DialogueOverlayProps {
  speaker?: string;
  text?: string;
  onNext?: () => void;
}

export function DialogueOverlay(_props: DialogueOverlayProps) {
  // TODO: Implement DialogueOverlay
  return <div className="border border-dashed p-4 text-center">DialogueOverlay Placeholder</div>;
}
