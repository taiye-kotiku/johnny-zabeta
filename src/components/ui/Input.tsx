import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label
          htmlFor={id}
          className="block text-sm font-sans font-medium text-text-muted"
        >
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          "w-full bg-bg-elevated border rounded-lg px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-disabled transition-colors outline-none",
          "border-border focus:border-coral/50 focus:ring-1 focus:ring-coral/20",
          { "border-red-500/50 focus:border-red-500/50 focus:ring-red-500/20": !!error },
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-red-400 font-sans">{error}</p>}
    </div>
  );
}
