import { cn } from "@/lib/utils";

export function NumberedLabel({
  index,
  children,
  className,
}: {
  index: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={cn("pub-kicker", className)}>
      {index} / {children}
    </p>
  );
}
