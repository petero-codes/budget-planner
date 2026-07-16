"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "password" | "number" | "date";
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  className?: string;
};

/** Labeled input using the portal's `.glass-select` field styling. */
export function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
  required,
  hint,
  className,
}: TextFieldProps) {
  const [reveal, setReveal] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && reveal ? "text" : type;

  return (
    <label className={cn("block text-meta", className)}>
      {label}
      <span className="relative mt-1 block">
        <input
          type={inputType}
          className={cn("glass-select", isPassword && "pr-9")}
          value={value}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          onChange={(e) => onChange(e.target.value)}
        />
        {isPassword ? (
          <button
            type="button"
            aria-label={reveal ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-neutral-400 transition hover:text-kengen-navy"
            onClick={() => setReveal((v) => !v)}
            tabIndex={-1}
          >
            {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        ) : null}
      </span>
      {hint ? <span className="mt-1 block text-meta text-neutral-400">{hint}</span> : null}
    </label>
  );
}
