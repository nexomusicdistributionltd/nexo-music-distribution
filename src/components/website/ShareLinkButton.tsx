"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function ShareLinkButton({
  url,
  label = "Copy link",
}: {
  url: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="gap-1.5 rounded-full"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          /* ignore */
        }
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
