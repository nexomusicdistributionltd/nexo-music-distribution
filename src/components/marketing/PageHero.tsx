import type { ReactNode } from "react";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { DisplayHeading } from "@/components/public/DisplayHeading";
import { cn } from "@/lib/utils";

export function PageHero({
  title,
  description,
  eyebrow,
  crumbs,
  children,
  className,
  aside,
  showAside = true,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  crumbs: { label: string; href?: string }[];
  children?: ReactNode;
  className?: string;
  aside?: ReactNode;
  showAside?: boolean;
}) {
  return (
    <div className={cn("pub-page-hero", className)}>
      <div className="mx-auto max-w-[92rem]">
        <Breadcrumb items={crumbs} />
        <div
          className={cn(
            "mt-8 grid gap-8 lg:items-end",
            description ? "lg:grid-cols-[1.2fr_0.8fr]" : undefined
          )}
        >
          <div>
            {eyebrow ? <p className="pub-kicker">{eyebrow}</p> : null}
            <DisplayHeading as="h1" size="lg" className="mt-4 max-w-[16ch]">
              {title}
            </DisplayHeading>
            {children ? <div className="mt-8">{children}</div> : null}
          </div>
          {description ? <p className="pub-body max-w-md lg:justify-self-end">{description}</p> : null}
        </div>
        {showAside && aside ? <div className="mt-12 max-w-xl lg:ml-auto">{aside}</div> : null}
      </div>
    </div>
  );
}
