import { cn } from "@/lib/utils";
import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  glow?: "coral" | "lime" | "none";
}

export function Card({ children, glow = "none", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-bg-surface border border-border rounded-xl p-5 transition-all duration-200",
        {
          "hover:border-coral/30 hover:shadow-lg hover:shadow-coral/5": glow === "coral",
          "hover:border-lime/30 hover:shadow-lg hover:shadow-lime/5": glow === "lime",
        },
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center justify-between mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("font-sora font-semibold text-text-primary text-sm", className)}
      {...props}
    >
      {children}
    </h3>
  );
}
