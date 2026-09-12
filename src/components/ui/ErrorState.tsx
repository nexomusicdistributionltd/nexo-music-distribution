import * as React from "react";
import { Alert } from "./Alert";
import { cn } from "@/lib/utils";

export function ErrorState({
  title = "Something went wrong",
  description,
  className,
}: {
  title?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Alert variant="error" title={title} className={cn(className)}>
      {description ?? "Please try again. If the problem continues, contact support."}
    </Alert>
  );
}
