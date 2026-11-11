import { CircleCheck, CircleDashed, FlaskConical, TriangleExclamationPoint, OctagonExclamationPoint } from "lucide-react";
import { cn } from "@/lib/utils";

export type Status = "go" | "pending" | "caution" | "fault" | "demo";

const styles: Record<Status, { className: string; Icon: typeof CircleCheck }> = {
  go: { className: "text-foreground bg-surface/50", Icon: CircleCheck },
  pending: { className: "text-foreground/75 bg-transparent shadow-[inset_0_0_0_1px_rgb(var(--border)/0.35)]", Icon: CircleDashed },
  caution: { className: "text-space-deep bg-primary", Icon: TriangleExclamationPoint },
  fault: { className: "text-space-deep bg-warning", Icon: OctagonExclamationPoint },
  demo: {
    className: "text-foreground bg-transparent shadow-[inset_0_0_0_1px_rgb(var(--primary)/0.8)]",
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
