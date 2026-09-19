"use client";

import type { DeliveryFailureDiagnosis } from "@/lib/distribution/delivery-diagnostics";

function ownerLabel(owner: DeliveryFailureDiagnosis["owner"]) {
  if (owner === "artist_or_label") return "Artist / label correction";
  if (owner === "system") return "Nexo / provider issue";
  return "Admin correction";
}

export function DeliveryFailurePanel({
  diagnosis,
}: {
  diagnosis: DeliveryFailureDiagnosis;
}) {
  return (
    <div className="space-y-3 rounded-[var(--nexo-radius)] border border-[var(--nexo-error)]/30 bg-[var(--nexo-error-bg)] p-4 text-small">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-[var(--nexo-error)]">{diagnosis.summary}</p>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">
            Failed stage: {diagnosis.stage}
          </p>
        </div>
        <span className="rounded-full border border-[var(--nexo-border)] px-2 py-1 text-caption">
          {ownerLabel(diagnosis.owner)}
        </span>
      </div>

      <dl className="grid gap-3">
        {diagnosis.field ? (
          <div>
            <dt className="font-semibold">Affected field</dt>
            <dd className="mt-1 font-medium text-[var(--nexo-text-secondary)]">
              {diagnosis.field}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="font-semibold">Why it failed</dt>
          <dd className="mt-1 whitespace-pre-wrap text-[var(--nexo-text-secondary)]">
            {diagnosis.reason}
          </dd>
        </div>
        <div>
          <dt className="font-semibold">What to fix</dt>
          <dd className="mt-1 text-[var(--nexo-text-secondary)]">{diagnosis.fix}</dd>
        </div>
        <div>
          <dt className="font-semibold">Where to fix it</dt>
          <dd className="mt-1 text-[var(--nexo-text-secondary)]">{diagnosis.where}</dd>
        </div>
        <div>
          <dt className="font-semibold">Next action</dt>
          <dd className="mt-1 text-[var(--nexo-text-secondary)]">{diagnosis.nextAction}</dd>
        </div>
      </dl>
    </div>
  );
}
