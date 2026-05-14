import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "lime";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        "inline-flex items-center justify-center font-sans font-medium rounded-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral disabled:opacity-40 disabled:cursor-not-allowed",
        {
          "bg-coral hover:bg-coral-hover text-white shadow-lg shadow-coral/20 hover:shadow-coral/30":
            variant === "primary",
          "bg-bg-elevated hover:bg-border text-text-primary border border-border":
            variant === "secondary",
          "bg-transparent hover:bg-bg-elevated text-text-muted hover:text-text-primary":
            variant === "ghost",
          "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20":
            variant === "danger",
          "bg-lime hover:bg-lime-hover text-bg-base shadow-lg shadow-lime/20":
            variant === "lime",
          "px-3 py-1.5 text-sm gap-1.5": size === "sm",
          "px-4 py-2.5 text-sm gap-2": size === "md",
          "px-6 py-3 text-base gap-2.5": size === "lg",
        },
        className
      )}
      {...props}
    >
      {isLoading && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {children}
    </button>
  );
}
