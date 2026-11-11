"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { LocaleToggle } from "@/components/hud/LocaleToggle";
import { useSettingsStore } from "@/game/settingsStore";
import { assetManifest } from "@/lib/assets";
import { useT } from "@/i18n/useT";

/** Developer kit page: every P0 primitive on one screen for visual review. Not part of the game flow. */
const SWATCHES = [
  { name: "space-deep", hex: "#112936", role: "Background", className: "bg-space-deep" },
  { name: "space-blue", hex: "#20556A", role: "Panels, surfaces", className: "bg-space-blue" },
  { name: "space-mist", hex: "#D0E0D5", role: "Text, hairlines", className: "bg-space-mist" },
  { name: "space-gold", hex: "#E9BC54", role: "Actions, selection", className: "bg-space-gold" },
  { name: "space-orange", hex: "#CB6944", role: "Warnings only", className: "bg-space-orange" },
];

export default function UiKitPage() {
  const t = useT();
  const { pixelFX, togglePixelFX, reduceMotion, setReduceMotion } = useSettingsStore();
  const [fuel, setFuel] = useState(72);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-12 px-4 py-8 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">UI kit</h1>
          <p className="text-sm text-foreground/70">Phase 0 primitives. Developer page, not part of the game.</p>
        </div>
        <LocaleToggle />
      </header>

      <section aria-labelledby="palette" className="flex flex-col gap-4">
        <h2 id="palette" className="text-xl font-semibold">Palette</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {SWATCHES.map((s) => (
            <li key={s.name} className="bezel bezel-sm flex flex-col">
              <div className={`h-16 shadow-[inset_0_-1px_0_rgb(var(--border)/0.28)] ${s.className}`} />
              <div className="flex flex-col gap-0.5 p-3">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="font-mono text-xs text-foreground/70">{s.hex}</span>
                <span className="text-xs text-foreground/70">{s.role}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-3">
        <h2 id="type" className="text-xl font-semibold">Type</h2>
        <p className="text-4xl font-semibold sm:text-5xl">Moonbound</p>
        <p className="text-2xl font-semibold sm:text-3xl">Mission Control</p>
        <p className="max-w-prose text-base">
          Inter carries every label and sentence. Tiếng Việt có dấu hiển thị đầy đủ: Trung tâm điều khiển, phi hành gia.
        </p>
        <p className="font-mono text-2xl text-primary">T-00:00:10</p>
        <p className="font-mono text-sm text-foreground/80">ALT 1,842.0 m · V/S −12.4 m/s · FUEL 72%</p>
      </section>

      <section aria-labelledby="buttons" className="flex flex-col gap-4">
        <h2 id="buttons" className="text-xl font-semibold">Buttons</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg">Launch</Button>
          <Button>Start mission</Button>
          <Button variant="secondary">Adjust parameters</Button>
          <Button variant="ghost">Skip</Button>
          <Button variant="danger">Abort launch</Button>
          <Button disabled>Locked</Button>
        </div>
      </section>

      <section aria-labelledby="status" className="flex flex-col gap-4">
        <h2 id="status" className="text-xl font-semibold">Status</h2>
        <div className="flex flex-wrap gap-3">
          <StatusBadge status="go">Systems go</StatusBadge>
          <StatusBadge status="pending">Awaiting check</StatusBadge>
          <StatusBadge status="caution">Fuel margin low</StatusBadge>
          <StatusBadge status="fault">Stage 2 anomaly</StatusBadge>
          <StatusBadge status="demo">{t.common.demoData}</StatusBadge>
        </div>
      </section>

      <section aria-labelledby="gauges" className="flex max-w-md flex-col gap-4">
        <h2 id="gauges" className="text-xl font-semibold">Gauges</h2>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-sm">
            <span>Fuel load</span>
            <span className="font-mono">{fuel}%</span>
          </div>
          <Progress value={fuel} aria-label="Fuel load" tone={fuel < 40 ? "warning" : "default"} />
          {fuel < 40 && <StatusBadge status="caution">Below required margin</StatusBadge>}
          <input
            type="range"
            min={0}
            max={100}
            value={fuel}
            onChange={(e) => setFuel(Number(e.target.value))}
            aria-label="Set fuel load"
            className="accent-space-gold"
          />
        </div>
      </section>

      <section aria-labelledby="tabs" className="flex flex-col gap-4">
        <h2 id="tabs" className="text-xl font-semibold">Tabs</h2>
        <Tabs defaultValue="vehicle" className="max-w-xl">
          <TabsList>
            <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
            <TabsTrigger value="payload">Payload</TabsTrigger>
            <TabsTrigger value="window">Launch window</TabsTrigger>
          </TabsList>
          <TabsContent value="vehicle" className="text-sm text-foreground/80">Choose the launch vehicle.</TabsContent>
          <TabsContent value="payload" className="text-sm text-foreground/80">Pick crew module and lander.</TabsContent>
          <TabsContent value="window" className="text-sm text-foreground/80">Pick a launch time.</TabsContent>
        </Tabs>
      </section>

      <section aria-labelledby="overlays" className="flex flex-col gap-4">
        <h2 id="overlays" className="text-xl font-semibold">Dialogs and tooltips</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="secondary">Open dialog</Button>
            </DialogTrigger>
            <DialogContent closeLabel={t.common.close}>
              <DialogHeader>
                <DialogTitle>Cleared for flight</DialogTitle>
                <DialogDescription>All three medical checks passed. Head to the workshop next.</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button>Continue</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">Open warning</Button>
            </DialogTrigger>
            <DialogContent tone="warning" closeLabel={t.common.close}>
              <DialogHeader>
                <StatusBadge status="fault" className="w-fit">
                  Anomaly at T+02:14
                </StatusBadge>
                <DialogTitle>Stage 2 ran out of fuel</DialogTitle>
                <DialogDescription>
                  The rocket did not reach parking orbit. Increase the fuel load or choose a lighter payload, then launch again.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary">Adjust parameters</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost">What is TLI?</Button>
            </TooltipTrigger>
            <TooltipContent>Trans-lunar injection: the engine burn that sends the spacecraft from Earth orbit toward the Moon.</TooltipContent>
          </Tooltip>
        </div>
      </section>

      <section aria-labelledby="settings" className="flex flex-col gap-4">
        <h2 id="settings" className="text-xl font-semibold">Settings store</h2>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" aria-pressed={pixelFX} onClick={togglePixelFX}>
            {t.settings.pixelEffect}: {pixelFX ? t.settings.on : t.settings.off}
          </Button>
          <Button variant="secondary" aria-pressed={reduceMotion} onClick={() => setReduceMotion(!reduceMotion)}>
            {t.settings.reducedMotion}: {reduceMotion ? t.settings.on : t.settings.off}
          </Button>
        </div>
      </section>

      <section aria-labelledby="manifest" className="flex flex-col gap-4">
        <h2 id="manifest" className="text-xl font-semibold">Asset manifest</h2>
        <ul className="flex flex-col gap-2 text-sm">
          {Object.entries(assetManifest.videos).map(([id, v]) => (
            <li key={id} className="flex flex-wrap items-center gap-3">
              <StatusBadge status={v.status === "final" ? "go" : "pending"}>{v.status}</StatusBadge>
              <span className="font-medium">{id}</span>
              <span className="font-mono text-xs text-foreground/70">{v.mp4}</span>
            </li>
          ))}
          {Object.entries(assetManifest.portraits).map(([id, p]) => (
            <li key={id} className="flex flex-wrap items-center gap-3">
              <StatusBadge status={p.status === "final" ? "go" : "pending"}>{p.status}</StatusBadge>
              <span className="font-medium">{p.displayName}</span>
              <span className="font-mono text-xs text-foreground/70">{p.src}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
