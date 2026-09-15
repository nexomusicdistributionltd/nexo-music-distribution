"use client";

import * as React from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { hardRedirectToLogin, performClientLogout } from "@/lib/auth/logout-client";
import { cn } from "@/lib/utils";

export function LogoutButton({
  className,
  variant = "menu",
  label = "Sign out",
}: {
  className?: string;
  variant?: "menu" | "button" | "icon";
  label?: string;
}) {
  const [loggingOut, setLoggingOut] = React.useState(false);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await performClientLogout();
      hardRedirectToLogin();
    } finally {
      setLoggingOut(false);
    }
  }

  if (variant === "button") {
    return (
      <Button
        variant="outline"
        size="sm"
        className={className}
        onClick={logout}
        disabled={loggingOut}
        aria-label="Sign out"
      >
        {loggingOut ? "Signing out…" : label}
      </Button>
    );
  }

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="icon"
        className={className}
        onClick={logout}
        disabled={loggingOut}
        aria-label="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "flex w-full items-center gap-2 rounded-[var(--nexo-radius-sm)] px-3 py-2 text-left text-small text-[var(--nexo-text-secondary)] transition-colors duration-[var(--nexo-duration)] hover:bg-[var(--nexo-ghost-hover)] hover:text-[var(--nexo-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--nexo-ring)] disabled:opacity-60",
        className
      )}
      onClick={logout}
      disabled={loggingOut}
      aria-label="Sign out"
    >
      <LogOut className="h-4 w-4" />
      {loggingOut ? "Signing out…" : label}
    </button>
  );
}
