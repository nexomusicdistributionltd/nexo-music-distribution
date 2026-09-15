import { StatusBadge } from "@/components/ui/StatusBadge";
import { ddexUiStatusKind, type DdexUiStatus } from "@/lib/ddex/ui-status";

export function DdexStatusBadge({ status }: { status: DdexUiStatus }) {
  return <StatusBadge status={ddexUiStatusKind(status)} label={status} />;
}
