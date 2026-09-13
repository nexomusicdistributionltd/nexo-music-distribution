import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusKind, statusLabel, type ReleaseStatus } from "@/lib/releases/types";

export function ReleaseStatusBadge({ status }: { status: ReleaseStatus }) {
  return <StatusBadge status={statusKind(status)} label={statusLabel(status)} />;
}
