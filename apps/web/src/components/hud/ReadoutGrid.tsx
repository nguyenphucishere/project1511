import { cn } from "@/lib/utils";

/** Live console readouts: a grid of label / monospace value cells. */
export function ReadoutGrid({ items, className }: { items: [label: string, value: string][]; className?: string }) {
  return (
    <dl className={cn("grid gap-px bg-space-blue/60", className)}>
      {items.map(([label, value]) => (
        <div key={label} className="bg-space-deep/85 px-3 py-2">
          <dt className="text-xs text-foreground/65">{label}</dt>
          <dd className="font-mono text-lg tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
