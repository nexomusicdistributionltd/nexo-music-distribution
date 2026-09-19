"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { DeliveryFailurePanel } from "@/components/distribution/DeliveryFailurePanel";
import type { DeliveryFailureDiagnosis } from "@/lib/distribution/delivery-diagnostics";
import {
  queueReleaseAction,
  submitJobAction,
  syncJobAction,
  retryJobAction,
  takedownAction,
  reinstateAction,
} from "@/app/admin/distribution/actions";

function Result({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="mt-2 text-caption text-[var(--nexo-text-muted)]">{msg}</p>;
}

export function QueueReleaseButton({ releaseId }: { releaseId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await queueReleaseAction(releaseId);
            setMsg(r.ok ? "Queued for distribution." : r.error);
          })
        }
      >
        Queue for distribution
      </Button>
      <Result msg={msg} />
    </div>
  );
}

export function SubmitJobButton({
  jobId,
  providerConnected,
}: {
  jobId: string;
  providerConnected: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        disabled={pending || !providerConnected}
        title={!providerConnected ? "Distribution Engine authorization required" : undefined}
        onClick={() =>
          start(async () => {
            const r = await submitJobAction(jobId);
            setMsg(
              r.ok
                ? "Submitted to Distribution Engine."
                : r.code === "PROVIDER_NOT_CONNECTED"
                  ? "Distribution Engine authorization required."
                  : r.error
            );
            router.refresh();
          })
        }
      >
        {providerConnected ? "Submit to Distribution Engine" : "Authorization required"}
      </Button>
      <Result msg={msg} />
    </div>
  );
}

export function SyncJobButton({
  jobId,
  providerConnected,
}: {
  jobId: string;
  providerConnected: boolean;
}) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        disabled={pending || !providerConnected}
        title={!providerConnected ? "Distribution Engine authorization required" : undefined}
        onClick={() =>
          start(async () => {
            const r = await syncJobAction(jobId);
            setMsg(
              r.ok
                ? "TooLost delivery status refreshed."
                : r.code === "PROVIDER_NOT_CONNECTED"
                  ? "Distribution Engine authorization required."
                  : r.error
            );
          })
        }
      >
        {providerConnected ? "Refresh TooLost" : "Authorization required"}
      </Button>
      <Result msg={msg} />
    </div>
  );
}

export function RetryJobButton({ jobId }: { jobId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<DeliveryFailureDiagnosis | null>(null);
  return (
    <div className="space-y-3">
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            setDiagnosis(null);
            const r = await retryJobAction(jobId);
            if (r.ok) {
              setMsg("Nexo delivery retry submitted successfully.");
            } else {
              setDiagnosis(r.diagnosis);
            }
            router.refresh();
          })
        }
      >
        {pending ? "Retrying…" : "Retry Nexo delivery"}
      </Button>
      <Result msg={msg} />
      {diagnosis ? <DeliveryFailurePanel diagnosis={diagnosis} /> : null}
    </div>
  );
}

export function TakedownButton({ releaseId }: { releaseId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await takedownAction(releaseId, "Admin takedown request");
            setMsg(r.ok ? "Takedown requested." : r.error);
          })
        }
      >
        Request takedown
      </Button>
      <Result msg={msg} />
    </div>
  );
}

export function ReinstateButton({ releaseId }: { releaseId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await reinstateAction(releaseId, "Admin reinstate");
            setMsg(r.ok ? "Reinstated." : r.error);
          })
        }
      >
        Reinstate
      </Button>
      <Result msg={msg} />
    </div>
  );
}
