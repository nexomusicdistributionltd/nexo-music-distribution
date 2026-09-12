import { EmptyState } from "@/components/ui/EmptyState";

export function ComingSoonPanel({
  title,
  description = "This area is ready in the product shell. Data, uploads, and distribution connections are not wired yet — nothing here is fabricated.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <EmptyState title={title} description={description} />
  );
}
