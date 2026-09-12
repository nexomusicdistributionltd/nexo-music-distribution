import type { Metadata } from "next";
import { ComingSoonPanel } from "@/components/app/ComingSoonPanel";
import { Alert } from "@/components/ui/Alert";
import { RequireAdmin } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Audit Logs",
  robots: { index: false, follow: false },
};

export default async function AuditLogsPage() {
  await RequireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, created_at, actor_user_id")
    .order("created_at", { ascending: false })
    .limit(25);

  return (
    <div className="space-y-4">
      <h1 className="text-h2">Audit Logs</h1>
      <Alert>
        Foundation only — passwords and tokens are never stored. Showing recent events when available.
      </Alert>
      {error ? (
        <ComingSoonPanel
          title="Audit log unavailable"
          description="Could not load audit logs. Confirm migrations and RLS policies are applied."
        />
      ) : !data?.length ? (
        <ComingSoonPanel title="No audit events yet" description="Login, logout, signup, and profile updates will appear here." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)]">
          <table className="min-w-full text-left text-small">
            <thead className="border-b border-[var(--nexo-border)] bg-[var(--nexo-surface)] text-caption text-[var(--nexo-text-muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Entity</th>
                <th className="px-4 py-3 font-medium">Actor</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b border-[var(--nexo-divider)]">
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{row.action}</td>
                  <td className="px-4 py-3">{row.entity_type}</td>
                  <td className="px-4 py-3 font-mono text-caption">{row.actor_user_id ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
