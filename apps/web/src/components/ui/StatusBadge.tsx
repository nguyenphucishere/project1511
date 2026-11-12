import { CircleCheck, CircleDashed, FlaskConical, TriangleExclamationPoint, OctagonExclamationPoint } from "lucide-react";
import { cn } from "@/lib/utils";

export type Status = "go" | "pending" | "caution" | "fault" | "demo";

const styles: Record<Status, { className: string; Icon: typeof CircleCheck }> = {
  go: { className: "text-white bg-space-emerald/90 shadow-[0_0_8px_rgba(16,185,129,0.35)]", Icon: CircleCheck },
  pending: { className: "text-foreground/80 bg-space-blue/30 shadow-[inset_0_0_0_1px_rgb(var(--border)/0.35)]", Icon: CircleDashed },
  caution: { className: "text-space-deep bg-space-gold font-semibold shadow-[0_0_8px_rgba(255,199,44,0.35)]", Icon: TriangleExclamationPoint },
  fault: { className: "text-white bg-nasa-red font-semibold shadow-[0_0_8px_rgba(252,61,33,0.45)]", Icon: OctagonExclamationPoint },
  demo: {
    className: "text-space-cyan bg-space-blue/40 shadow-[inset_0_0_0_1px_rgb(var(--space-cyan)/0.7)]",
    Icon: FlaskConical,
  },
};

interface StatusBadgeProps {
  status: Status;
  /** Visible text. Status is always spelled out, never shown by colour alone. */
  children: React.ReactNode;
  className?: string;
}

export function StatusBadge({ status, children, className }: StatusBadgeProps) {
  const { className: tone, Icon } = styles[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 px-2 text-xs font-medium",
        tone,
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {children}
    </span>
  );
}
