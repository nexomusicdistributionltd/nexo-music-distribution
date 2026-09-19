import { createClient } from "@/lib/supabase/server";
import { markAnnouncementReadAction } from "@/app/(portal)/announcements/actions";
import { Button } from "@/components/ui/Button";

export async function PortalAnnouncements({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: announcements }, { data: reads }] = await Promise.all([
    supabase
      .from("admin_announcements")
      .select("id,title,body,severity,starts_at,ends_at")
      .eq("active", true)
      .lte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(10),
    supabase
      .from("admin_announcement_reads")
      .select("announcement_id")
      .eq("user_id", userId),
  ]);
  const readIds = new Set((reads ?? []).map((row) => row.announcement_id));
  const unread = (announcements ?? []).filter((row) => !readIds.has(row.id));
  if (!unread.length) return null;

  return (
    <div className="mb-5 space-y-2">
      {unread.map((row) => (
        <section
          key={row.id}
          className={[
            "rounded-[var(--nexo-radius-lg)] border px-4 py-3",
            row.severity === "critical"
              ? "border-red-600/40 bg-red-600/10"
              : row.severity === "warning"
                ? "border-[var(--nexo-warning)]/40 bg-[var(--nexo-warning-bg)]"
                : "border-[var(--nexo-border)] bg-[var(--nexo-card)]",
          ].join(" ")}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold">{row.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-small text-[var(--nexo-text-secondary)]">{row.body}</p>
            </div>
            <form action={markAnnouncementReadAction}>
              <input type="hidden" name="announcement_id" value={row.id} />
              <Button type="submit" size="sm" variant="ghost">Dismiss</Button>
            </form>
          </div>
        </section>
      ))}
    </div>
  );
}
