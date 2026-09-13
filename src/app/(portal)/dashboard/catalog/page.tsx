import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Catalog",
  robots: { index: false, follow: false },
};

/** First-class catalog route — same data as /dashboard/releases. */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const q = qs.toString();
  redirect(`/dashboard/releases${q ? `?${q}` : ""}`);
}
