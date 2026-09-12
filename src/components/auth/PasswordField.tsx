"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { validatePassword } from "@/lib/auth/password";
import { cn } from "@/lib/utils";

export function PasswordField({
  id,
  name = "password",
  label = "Password",
  autoComplete = "current-password",
  showStrength = false,
  required = true,
  value,
  onChange,
  className,
}: {
  id?: string;
  name?: string;
  label?: string;
  autoComplete?: string;
  showStrength?: boolean;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  const strength = showStrength ? validatePassword(value) : null;
  const fieldId = id ?? name;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={fieldId} className="text-label block">
        {label}
      </label>
      <div className="relative">
        <Input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10"
          aria-describedby={showStrength ? `${fieldId}-strength` : undefined}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[var(--nexo-text-muted)] hover:text-[var(--nexo-text)]"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {showStrength && value ? (
        <div id={`${fieldId}-strength`} className="space-y-1">
          <div className="flex gap-1" aria-hidden>
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  (strength?.score ?? 0) >= i
                    ? i <= 2
                      ? "bg-[var(--nexo-error)]"
                      : i <= 3
                        ? "bg-[var(--nexo-warning)]"
                        : "bg-[var(--nexo-success)]"
                    : "bg-[var(--nexo-border)]"
                )}
              />
            ))}
          </div>
          {!strength?.ok ? (
            <p className="text-caption text-[var(--nexo-text-muted)]">
              Needs: {strength?.errors.join(" · ")}
            </p>
          ) : (
            <p className="text-caption text-[var(--nexo-success)]">Strong password</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
