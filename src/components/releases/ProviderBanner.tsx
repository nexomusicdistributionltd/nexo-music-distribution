import Link from "next/link";
import { Alert } from "@/components/ui/Alert";

export function ProviderBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <Alert variant="warning" title="Distribution Engine authorization required">
      The Distribution Engine is configured but has not completed secure authorization.{" "}
      <Link className="underline" href="/admin/distribution/provider">
        Open connection settings
      </Link>
      .
    </Alert>
  );
}