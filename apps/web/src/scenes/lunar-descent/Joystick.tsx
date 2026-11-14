"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface StickValue {
  /** -1 (left) .. 1 (right). */
  x: number;
  /** -1 (pulled down) .. 1 (pushed up). */
  y: number;
}

interface JoystickProps {
  onChange: (value: StickValue) => void;
  disabled?: boolean;
  className?: string;
  /** Accessible name. */
  label: string;
  /** Short labels at the four edges of the pad. */
  hints?: { up: string; down: string; left: string; right: string };
}

/** Within this fraction of the pad's radius the stick reads zero, so a resting thumb does not fire thrusters. */
const DEAD_ZONE = 0.1;
/** The knob can travel this fraction of the pad radius; full deflection is reached there. */
const THROW = 0.62;

/**
 * An on-screen joystick for mouse and touch. Press and drag anywhere on the pad: the knob follows
 * the pointer and the output is analog (-1..1 on each axis). Letting go snaps it back to centre.
 */
export function Joystick({ onChange, disabled = false, className, label, hints }: JoystickProps) {
  const pad = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const emit = (x: number, y: number) => {
    setKnob({ x, y });
    // Rescale past the dead zone so the output still starts from zero.
    const mag = Math.hypot(x, y);
    if (mag < DEAD_ZONE) return onChange({ x: 0, y: 0 });
    const k = (mag - DEAD_ZONE) / (1 - DEAD_ZONE) / mag;
    onChange({ x: x * k, y: y * k });
  };

  const move = (e: React.PointerEvent) => {
    const el = pad.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const radius = (r.width / 2) * THROW;
    let dx = (e.clientX - (r.left + r.width / 2)) / radius;
    let dy = -(e.clientY - (r.top + r.height / 2)) / radius;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    emit(dx, dy);
  };

  const release = () => {
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange({ x: 0, y: 0 });
  };

  return (
    <div
      ref={pad}
      role="application"
      aria-label={label}
      aria-disabled={disabled}
      className={cn(
        "relative mx-auto aspect-square w-full max-w-[9.5rem] touch-none select-none rounded-full border border-primary/40 bg-space-deep/70 shadow-[inset_0_0_18px_rgb(var(--nasa-blue)/0.55)]",
        disabled ? "opacity-40" : "cursor-grab active:cursor-grabbing",
        className,
      )}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        setActive(true);
        move(e);
      }}
      onPointerMove={(e) => {
        if (active) move(e);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {/* Crosshair and range ring. */}
      <span aria-hidden className="absolute inset-x-[8%] top-1/2 h-px -translate-y-1/2 bg-foreground/15" />
      <span aria-hidden className="absolute inset-y-[8%] left-1/2 w-px -translate-x-1/2 bg-foreground/15" />
      <span aria-hidden className="absolute inset-[19%] rounded-full border border-dashed border-foreground/15" />
      {hints && (
        <>
          <span aria-hidden className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 text-[9px] uppercase tracking-wide text-foreground/50">{hints.up}</span>
          <span aria-hidden className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-wide text-foreground/50">{hints.down}</span>
          <span aria-hidden className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-foreground/50">{hints.left}</span>
          <span aria-hidden className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] uppercase tracking-wide text-foreground/50">{hints.right}</span>
        </>
      )}
      {/* The knob. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute h-[34%] w-[34%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/85 shadow-[0_0_14px_rgb(var(--primary)/0.6)]",
          active ? "" : "transition-[left,top] duration-150 ease-out",
        )}
        style={{ left: `${50 + knob.x * THROW * 50}%`, top: `${50 - knob.y * THROW * 50}%` }}
      />
    </div>
  );
}
