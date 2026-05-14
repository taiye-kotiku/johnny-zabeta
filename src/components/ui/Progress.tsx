import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  variant?: "coral" | "lime" | "lavender";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animated?: boolean;
  className?: string;
}

export function Progress({
  value,
  max = 100,
  variant = "lime",
  size = "md",
  showLabel = false,
  animated = false,
  className,
}: ProgressProps) {
  const pct = Math.min(100, (value / max) * 100);

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn("w-full rounded-full bg-bg-elevated overflow-hidden", {
          "h-1.5": size === "sm",
          "h-2": size === "md",
          "h-3": size === "lg",
        })}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", {
            "bg-coral": variant === "coral",
            "bg-lime": variant === "lime",
            "bg-lavender": variant === "lavender",
            "animate-pulse_lime": animated && variant === "lime",
          })}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className="text-xs font-grotesk text-text-muted mt-1 text-right">
          {Math.round(pct)}%
        </p>
      )}
    </div>
  );
}
