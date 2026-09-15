import { sanitizeCmsHtml } from "@/lib/website/sanitize";

export function SafeHtml({
  html,
  className,
}: {
  html: string | null | undefined;
  className?: string;
}) {
  const clean = sanitizeCmsHtml(html);
  if (!clean) return null;
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
