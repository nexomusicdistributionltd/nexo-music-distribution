"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSignature, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { distributionAgreementSections } from "@/lib/legal/distribution-agreement";
import { signDistributionAgreementAction } from "@/app/(verification)/distribution-agreement/actions";

export function DistributionAgreementForm({
  legalName,
  accountType,
  agreementVersion,
  commissionBps,
  planId,
  companyLegalName,
  companyAuthorizedName,
  companyAuthorizedTitle,
}: {
  legalName: string;
  accountType: "artist" | "label";
  agreementVersion: string;
  commissionBps: number;
  planId: string | null;
  companyLegalName: string;
  companyAuthorizedName: string;
  companyAuthorizedTitle: string;
}) {
  const router = useRouter();
  const [rights, setRights] = React.useState(false);
  const [authority, setAuthority] = React.useState(false);
  const [fraud, setFraud] = React.useState(false);
  const [electronic, setElectronic] = React.useState(false);
  const [signature, setSignature] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const sections = distributionAgreementSections({ accountType, commissionBps });
  const allChecked = rights && authority && fraud && electronic;
  const signatureMatches =
    signature.trim().replace(/\s+/g, " ").toLocaleLowerCase() ===
    legalName.trim().replace(/\s+/g, " ").toLocaleLowerCase();

  async function submit() {
    if (!allChecked || !signatureMatches) return;
    setBusy(true);
    setError(null);
    try {
      const result = await signDistributionAgreementAction({
        signatureText: signature,
        declarations: {
          ownsRights: rights,
          hasAuthority: authority,
          acceptsFraudPolicy: fraud,
          acceptsElectronicSignature: electronic,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--nexo-border)] px-3 py-1 text-caption">
          <ShieldCheck className="h-4 w-4" /> Identity verified
        </div>
        <h1 className="text-h2">Distribution Agreement {agreementVersion}</h1>
        <p className="max-w-2xl text-small text-[var(--nexo-text-muted)]">
          Review and sign before using Nexo distribution services. Your verified legal name is used for this agreement.
        </p>
      </header>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <section className="grid gap-3 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 sm:grid-cols-2">
        <Fact label="Client legal name" value={legalName} />
        <Fact label="Account" value={accountType === "label" ? "Label" : "Artist"} />
        <Fact label="Current plan" value={planId ?? "Free / grandfathered"} />
        <Fact label="Nexo commission" value={`${commissionBps / 100}%`} />
      </section>

      <article className="space-y-5 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 sm:p-7">
        {sections.map((section) => (
          <section key={section.heading} className="space-y-1.5">
            <h2 className="text-h4">{section.heading}</h2>
            <p className="text-small leading-6 text-[var(--nexo-text-secondary)]">{section.body}</p>
          </section>
        ))}
        <section className="border-t border-[var(--nexo-border)] pt-5">
          <h2 className="text-h4">Nexo company authorization</h2>
          <p className="mt-1 text-small text-[var(--nexo-text-secondary)]">
            {companyAuthorizedName}, {companyAuthorizedTitle}, for {companyLegalName}. Company authorization is stored with this agreement version.
          </p>
        </section>
      </article>

      <section className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 sm:p-7">
        <div className="flex items-center gap-2"><FileSignature className="h-5 w-5" /><h2 className="text-h4">Sign electronically</h2></div>
        <Declaration checked={rights} onChange={setRights}>I own or control the rights required for the music and assets I submit.</Declaration>
        <Declaration checked={authority} onChange={setAuthority}>I have authority to enter this agreement for this {accountType} account.</Declaration>
        <Declaration checked={fraud} onChange={setFraud}>I accept the artificial-streaming, fraud, royalty hold, offset and repayment provisions above.</Declaration>
        <Declaration checked={electronic} onChange={setElectronic}>I consent to electronic records and intend my typed legal name to be my electronic signature.</Declaration>

        <label className="block space-y-1.5 pt-2">
          <span className="text-label">Type your verified legal name</span>
          <Input
            value={signature}
            onChange={(event) => setSignature(event.target.value)}
            placeholder={legalName}
            autoComplete="name"
          />
          {signature && !signatureMatches ? (
            <span className="text-caption text-red-600">Signature must exactly match your verified legal name: {legalName}</span>
          ) : null}
        </label>

        <Button
          type="button"
          className="w-full rounded-full"
          disabled={!allChecked || !signatureMatches || busy}
          onClick={() => void submit()}
        >
          {busy ? "Signing securely…" : "Sign agreement and continue"}
        </Button>
        <p className="text-caption text-[var(--nexo-text-muted)]">
          Nexo records the agreement version, verification reference, timestamp and document SHA-256 hash.
        </p>
      </section>
    </div>
  );
}

function Declaration({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--nexo-border)] p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4"
      />
      <span className="text-small">{children}</span>
    </label>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div><p className="text-caption text-[var(--nexo-text-muted)]">{label}</p><p className="mt-1 text-small font-medium">{value}</p></div>;
}
