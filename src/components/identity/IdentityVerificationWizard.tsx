"use client";

import * as React from "react";
import Link from "next/link";
import { Camera, CheckCircle2, FileCheck2, ShieldCheck } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { LiveCameraCapture } from "@/components/identity/LiveCameraCapture";
import { IdentityVerifiedBadge } from "@/components/identity/IdentityVerifiedBadge";
import { createClient } from "@/lib/supabase/client";
import {
  IDENTITY_COUNTRY_CODES,
  countryFlag,
} from "@/lib/identity/countries";
import {
  IDENTITY_DOCUMENT_LABELS,
  type IdentityDocumentType,
  type IdentityVerification,
} from "@/lib/identity/types";
import {
  beginIdentityVerificationAction,
  submitIdentityVerificationAction,
} from "@/app/(verification)/verify-identity/actions";

type CaptureKind = "document-front" | "document-back" | "selfie";

export function IdentityVerificationWizard({
  userId,
  email,
  current,
}: {
  userId: string;
  email: string;
  current: IdentityVerification | null;
}) {
  const [countryCode, setCountryCode] = React.useState(current?.country_code ?? "");
  const [legalName, setLegalName] = React.useState(current?.legal_name ?? "");
  const [dateOfBirth, setDateOfBirth] = React.useState(current?.date_of_birth ?? "");
  const [documentType, setDocumentType] = React.useState<IdentityDocumentType>(
    current?.document_type ?? "nin"
  );
  const [step, setStep] = React.useState<"details" | "document" | "face" | "review">("details");
  const [camera, setCamera] = React.useState<CaptureKind | null>(null);
  const [verificationId, setVerificationId] = React.useState<string | null>(null);
  const [submissionId, setSubmissionId] = React.useState<string | null>(null);
  const [paths, setPaths] = React.useState<Record<CaptureKind, string | null>>({
    "document-front": null,
    "document-back": null,
    selfie: null,
  });
  const [previews, setPreviews] = React.useState<Record<CaptureKind, string | null>>({
    "document-front": null,
    "document-back": null,
    selfie: null,
  });
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  const countries = React.useMemo(() => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    return IDENTITY_COUNTRY_CODES.map((code) => ({
      code,
      name: names.of(code) ?? code,
    })).sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const locked =
    current?.status === "submitted" ||
    current?.status === "under_review" ||
    current?.status === "verified";

  async function startAttempt() {
    setBusy(true);
    setError(null);
    try {
      const result = await beginIdentityVerificationAction({
        countryCode,
        legalName,
        dateOfBirth,
        documentType,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setVerificationId(result.data.verificationId);
      setSubmissionId(result.data.submissionId);
      setStep("document");
    } finally {
      setBusy(false);
    }
  }

  async function uploadCapture(kind: CaptureKind, blob: Blob) {
    if (!submissionId) {
      setError("Verification session is missing. Start again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const path = `${userId}/${submissionId}/${kind}.jpg`;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("identity-verification")
        .upload(path, blob, {
          contentType: "image/jpeg",
          upsert: true,
          cacheControl: "0",
        });
      if (uploadError) throw uploadError;
      setPaths((prev) => ({ ...prev, [kind]: path }));
      setPreviews((prev) => {
        if (prev[kind]) URL.revokeObjectURL(prev[kind]!);
        return { ...prev, [kind]: URL.createObjectURL(blob) };
      });
      setCamera(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload live camera capture.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!verificationId || !submissionId) {
      setError("Verification session is missing. Start again.");
      return;
    }
    if (!paths["document-front"] || !paths["document-back"] || !paths.selfie) {
      setError("Front, back, and face captures are all required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await submitIdentityVerificationAction({
        verificationId,
        submissionId,
        documentFrontPath: paths["document-front"],
        documentBackPath: paths["document-back"],
        selfiePath: paths.selfie,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (current?.status === "verified") {
    return (
      <div className="mx-auto max-w-xl space-y-5 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-black text-white">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-h3">Identity verified</h1>
          <div className="mt-2 flex justify-center"><IdentityVerifiedBadge /></div>
          <p className="mt-3 text-small text-[var(--nexo-text-muted)]">
            Your Nexo identity verification is approved.
          </p>
        </div>
        <Link href="/dashboard" className="inline-flex rounded-full bg-black px-5 py-2.5 text-sm font-semibold text-white">
          Continue to dashboard
        </Link>
      </div>
    );
  }

  if (done || locked) {
    const label = current?.status === "under_review" ? "Under review" : "Submitted";
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
        <CheckCircle2 className="h-10 w-10" />
        <h1 className="text-h3">{done ? "Verification submitted" : label}</h1>
        <p className="text-small text-[var(--nexo-text-muted)]">
          Your live identity evidence has been securely submitted to Nexo for review. This page updates when staff completes the review.
        </p>
        <p className="text-caption text-[var(--nexo-text-muted)]">Signed in as {email}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <p className="text-label uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">Account verification</p>
        <h1 className="mt-2 text-h2">Verify your identity</h1>
        <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
          Identity verification is required for artist and label accounts. Your legal name and date of birth must match the document you capture.
        </p>
      </div>

      {current?.status === "declined" || current?.status === "additional_info_required" ? (
        <Alert variant="warning" title={current.status === "declined" ? "Verification declined" : "Additional information required"}>
          {current.reason || "Please submit a new live verification attempt."}
        </Alert>
      ) : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid grid-cols-4 gap-2 text-center text-[0.7rem] font-medium">
        {(["details", "document", "face", "review"] as const).map((item, index) => (
          <div key={item} className={step === item ? "text-[var(--nexo-text)]" : "text-[var(--nexo-text-muted)]"}>
            <div className={`mx-auto mb-1 h-1.5 rounded-full ${step === item ? "bg-black dark:bg-white" : "bg-[var(--nexo-border)]"}`} />
            {index + 1}. {item === "details" ? "Details" : item === "document" ? "Document" : item === "face" ? "Face" : "Submit"}
          </div>
        ))}
      </div>

      {step === "details" ? (
        <section className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <label className="block space-y-1.5">
            <span className="text-label">Country</span>
            <Select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} required>
              <option value="">Select country</option>
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {countryFlag(country.code)} {country.name}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-label">Full legal name</span>
            <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} placeholder="Exactly as shown on your ID" required />
          </label>
          <label className="block space-y-1.5">
            <span className="text-label">Date of birth</span>
            <Input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} required />
          </label>
          <div className="space-y-2">
            <p className="text-label">Identity document</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(Object.keys(IDENTITY_DOCUMENT_LABELS) as IdentityDocumentType[]).map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setDocumentType(type)}
                  className={`rounded-xl border p-3 text-left text-sm transition ${documentType === type ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black" : "border-[var(--nexo-border)] hover:bg-[var(--nexo-ghost-hover)]"}`}
                >
                  {IDENTITY_DOCUMENT_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
          <Button type="button" onClick={() => void startAttempt()} disabled={busy || !countryCode || !legalName || !dateOfBirth} className="w-full rounded-full">
            {busy ? "Starting…" : "Continue"}
          </Button>
        </section>
      ) : null}

      {step === "document" ? (
        <section className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <div>
            <h2 className="text-h4">{IDENTITY_DOCUMENT_LABELS[documentType]}</h2>
            <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
              Use the live rear camera. Manual file upload is disabled.
            </p>
          </div>
          <CaptureCard
            label="Front of document"
            preview={previews["document-front"]}
            complete={Boolean(paths["document-front"])}
            onClick={() => setCamera("document-front")}
          />
          <CaptureCard
            label="Back of document"
            preview={previews["document-back"]}
            complete={Boolean(paths["document-back"])}
            onClick={() => setCamera("document-back")}
          />
          <Button type="button" className="w-full rounded-full" disabled={!paths["document-front"] || !paths["document-back"] || busy} onClick={() => setStep("face")}>
            Continue to face verification
          </Button>
        </section>
      ) : null}

      {step === "face" ? (
        <section className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <div>
            <h2 className="text-h4">Face verification</h2>
            <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
              Look directly at the camera in good lighting. This must be a live camera capture.
            </p>
          </div>
          <CaptureCard
            label="Live selfie"
            preview={previews.selfie}
            complete={Boolean(paths.selfie)}
            onClick={() => setCamera("selfie")}
          />
          <Button type="button" className="w-full rounded-full" disabled={!paths.selfie || busy} onClick={() => setStep("review")}>
            Continue
          </Button>
        </section>
      ) : null}

      {step === "review" ? (
        <section className="space-y-4 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <FileCheck2 className="h-8 w-8" />
          <div>
            <h2 className="text-h4">Ready to submit</h2>
            <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
              Confirm that your details match your ID. Nexo staff will review the document and face capture.
            </p>
          </div>
          <dl className="grid gap-3 text-small sm:grid-cols-2">
            <div><dt className="text-[var(--nexo-text-muted)]">Legal name</dt><dd>{legalName}</dd></div>
            <div><dt className="text-[var(--nexo-text-muted)]">Date of birth</dt><dd>{dateOfBirth}</dd></div>
            <div><dt className="text-[var(--nexo-text-muted)]">Country</dt><dd>{countryFlag(countryCode)} {countries.find((c) => c.code === countryCode)?.name ?? countryCode}</dd></div>
            <div><dt className="text-[var(--nexo-text-muted)]">Document</dt><dd>{IDENTITY_DOCUMENT_LABELS[documentType]}</dd></div>
          </dl>
          <Button type="button" onClick={() => void submit()} disabled={busy} className="w-full rounded-full">
            {busy ? "Submitting securely…" : "Submit verification"}
          </Button>
        </section>
      ) : null}

      {camera ? (
        <LiveCameraCapture
          facingMode={camera === "selfie" ? "user" : "environment"}
          title={camera === "document-front" ? "Capture document front" : camera === "document-back" ? "Capture document back" : "Capture live selfie"}
          onCapture={(blob) => void uploadCapture(camera, blob)}
          onCancel={() => setCamera(null)}
        />
      ) : null}
    </div>
  );
}

function CaptureCard({
  label,
  preview,
  complete,
  onClick,
}: {
  label: string;
  preview: string | null;
  complete: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-4 rounded-xl border border-[var(--nexo-border)] p-4 text-left hover:bg-[var(--nexo-ghost-hover)]">
      <div className="flex h-16 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--nexo-elevated)]">
        {preview ? <img src={preview} alt="" className="h-full w-full object-cover" /> : <Camera className="h-6 w-6 text-[var(--nexo-text-muted)]" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{label}</p>
        <p className="text-caption text-[var(--nexo-text-muted)]">{complete ? "Captured securely · tap to retake" : "Tap to open live camera"}</p>
      </div>
      {complete ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : null}
    </button>
  );
}
