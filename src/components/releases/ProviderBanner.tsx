import { Alert } from "@/components/ui/Alert";
import { providerNotConnectedMessage } from "@/lib/provider/errors";

export function ProviderBanner({ connected }: { connected: boolean }) {
  if (connected) return null;
  return (
    <Alert variant="warning" title="Distribution provider">
      {providerNotConnectedMessage()} Approved releases stay in catalog until a provider is connected —
      approval is not the same as delivery or live.
    </Alert>
  );
}
