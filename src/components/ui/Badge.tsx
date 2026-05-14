import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "coral" | "lime" | "lavender";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-grotesk font-medium",
        {
          "bg-bg-elevated text-text-muted": variant === "default",
          "bg-lime/10 text-lime": variant === "success",
          "bg-yellow-500/10 text-yellow-400": variant === "warning",
          "bg-red-500/10 text-red-400": variant === "danger",
          "bg-coral/10 text-coral": variant === "coral",
          "bg-lime/10 text-lime": variant === "lime",
          "bg-lavender/10 text-lavender": variant === "lavender",
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
