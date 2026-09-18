import type { Metadata } from "next";
import { RequireAdminPermission } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/PageHeader";
import { allPortalPageDefs } from "@/lib/portal/ia";
import { listPortalFeatureControls } from "@/lib/portal/controls";
import { PortalFeatureControlsClient } from "@/components/admin/PortalFeatureControlsClient";

export const metadata: Metadata = {
  title: "Portal features",
  robots: { index: false, follow: false },
};

export default async function AdminPortalFeaturesPage() {
  await RequireAdminPermission("admin:settings");
  const controls = await listPortalFeatureControls();
  const byHref = new Map(controls.map((row) => [row.href, row]));
  const staticItems = allPortalPageDefs();
  const unique = new Map<string, string>();
  for (const item of staticItems) unique.set(item.href, item.label);
  for (const row of controls) if (!unique.has(row.href)) unique.set(row.href, row.label);

  const rows = [...unique.entries()]
    .map(([href, label]) => {
      const saved = byHref.get(href);
      return {
        href,
        label,
        enabledArtist: saved?.enabled_artist ?? true,
        enabledLabel: saved?.enabled_label ?? true,
        adminNote: saved?.admin_note ?? "",
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Artist & Label portal features"
        description="Enable or disable portal destinations by account type without deleting routes or data."
      />
      <PortalFeatureControlsClient rows={rows} />
    </div>
  );
}
