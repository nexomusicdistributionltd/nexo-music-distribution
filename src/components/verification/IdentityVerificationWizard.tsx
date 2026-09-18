"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronLeft, ChevronRight, ShieldCheck, UploadCloud } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { VerifiedBadge } from "@/components/verification/VerifiedBadge";
import { COUNTRY_OPTIONS, countryFlag } from "@/lib/auth/countries";
import { createClient } from "@/lib/supabase/client";
import {
  DOCUMENT_LABELS,
  type IdentityDocumentType,
  type IdentityEvidence,
  type IdentityEvidenceType,
  type IdentityVerification,
} from "@/lib/verification/types";
import {
  recordVerificationEvidenceAction,
  saveVerificationDetailsAction,
  submitVerificationAction,
} from "@/app/(portal)/verification/actions";

type Step = 1 | 2 | 3 | 4 | 5;

function evidenceSet(rows: IdentityEvidence[]) {
  return new Set(rows.map((row) => row.evidence_type));
}

export function IdentityVerificationWizard({
  userId,
  accountType,
  profileFullName,
  profileCountry,
  initialVerification,
  initialEvidence,
}: {
  userId: string;
  accountType: "artist" | "label";
  profileFullName: string;
  profileCountry: string | null;
  initialVerification: IdentityVerification | null;
  initialEvidence: IdentityEvidence[];
}) {
  const router = useRouter();
  const [verification, setVerification] = React.useState(initialVerification);
  const [captured, setCaptured] = React.useState(() => evidenceSet(initialEvidence));
  const [step, setStep] = React.useState<Step>(initialVerification ? 3 : 1);
  const [countryCode, setCountryCode] = React.useState(initialVerification?.country_code ?? "");
  const [legalName, setLegalName] = React.useState(
    initialVerification?.legal_full_name || profileFullName || ""
  );
  const [dateOfBirth, setDateOfBirth] = React.useState(initialVerification?.date_of_birth ?? "");
  const [documentType, setDocumentType] = React.useState<IdentityDocumentType>(
    initialVerification?.document_type ?? "national_id"
  );
  const [consent, setConsent] = React.useState(Boolean(initialVerification?.consented_at));
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (countryCode || !profileCountry) return;
    const match = COUNTRY_OPTIONS.find((c) => c.name === profileCountry);
    if (match) setCountryCode(match.code);
  }, [countryCode, profileCountry]);

  const status = verification?.status;

  if (status === "verified") {
    return (
      <StatusCard
        title="Identity verified"
        description="Your Nexo artist or label account has completed identity verification."
        tone="success"
      >
        <div className="mt-4 flex items-center gap-3">
          <VerifiedBadge />
          <Button type="button" onClick={() => router.push("/dashboard")}>
            Continue to dashboard
          </Button>
        </div>
      </StatusCard>
    );
  }

  if (status === "submitted" || status === "under_review") {
    return (
      <StatusCard
        title={status === "under_review" ? "Verification under review" : "Verification submitted"}
        description="Your live document and face captures were received securely. Nexo administrators can now review them."
        tone="default"
      >
        <p className="mt-3 text-caption text-[var(--nexo-text-muted)]">
          You will see the result here in realtime. No manual document upload is available.
        </p>
      </StatusCard>
    );
  }

  if (status === "declined" && step !== 1) {
    return (
      <StatusCard
        title="Verification declined"
        description={verification?.decline_reason || "Your verification could not be approved."}
        tone="error"
      >
        <Button
          type="button"
          className="mt-4"
          onClick={() => {
            setError(null);
            setCaptured(new Set());
            setStep(1);
          }}
        >
          Start a fresh verification
        </Button>
      </StatusCard>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {status === "additional_information_required" ? (
        <Alert variant="warning" title="Additional information required">
          {verification?.additional_information_request ||
            "Please update the requested information and submit again."}
        </Alert>
      ) : null}

      <div className="rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-caption uppercase tracking-[0.14em] text-[var(--nexo-text-muted)]">
              Identity verification
            </p>
            <h1 className="mt-1 text-h2">Verify your {accountType} account</h1>
          </div>
          <span className="text-caption text-[var(--nexo-text-muted)]">Step {step} of 5</span>
        </div>
        <div className="mt-4 grid grid-cols-5 gap-2" aria-hidden>
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className={
                n <= step
                  ? "h-1.5 rounded-full bg-[var(--nexo-text)]"
                  : "h-1.5 rounded-full bg-[var(--nexo-border)]"
              }
            />
          ))}
        </div>
      </div>

      {error ? <Alert variant="error" title="Verification issue">{error}</Alert> : null}

      {step === 1 ? (
        <section className="space-y-5 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <div>
            <h2 className="text-h3">Your legal details</h2>
            <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
              Your full name and date of birth must exactly match the identity document you capture.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="text-label">Country</span>
            <Select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} required>
              <option value="">Select country</option>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {countryFlag(country.code)} {country.name}
                </option>
              ))}
            </Select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-label">Full legal name</span>
            <Input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              autoComplete="name"
              placeholder="Exactly as shown on your ID"
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-label">Date of birth</span>
            <Input
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              required
            />
          </label>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => {
                setError(null);
                if (!countryCode) return setError("Select your country.");
                if (legalName.trim().length < 2) {
                  return setError("Enter your full legal name exactly as it appears on your ID.");
                }
                if (!dateOfBirth) return setError("Enter your date of birth.");
                setStep(2);
              }}
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="space-y-5 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <div>
            <h2 className="text-h3">Select your document</h2>
            <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
              Choose the original document you will capture live using your device camera.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(DOCUMENT_LABELS) as IdentityDocumentType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setDocumentType(type)}
                className={
                  documentType === type
                    ? "rounded-[var(--nexo-radius-lg)] border-2 border-[var(--nexo-text)] bg-[var(--nexo-elevated)] p-4 text-left"
                    : "rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-left hover:bg-[var(--nexo-ghost-hover)]"
                }
              >
                <span className="font-medium">{DOCUMENT_LABELS[type]}</span>
              </button>
            ))}
          </div>

          <label className="flex items-start gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small">
            <input
              type="checkbox"
              className="mt-1"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I consent to Nexo Music Distribution securely storing and reviewing my identity
              details, live ID captures, and face capture for account verification, fraud
              prevention, compliance, and future dispute investigation.
            </span>
          </label>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="button"
              disabled={busy || !consent}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const result = await saveVerificationDetailsAction({
                  countryCode,
                  legalFullName: legalName,
                  dateOfBirth,
                  documentType,
                  consent,
                });
                setBusy(false);
                if (!result.ok) return setError(result.error);
                setVerification(result.data);
                if (status === "declined") setCaptured(new Set());
                setStep(3);
              }}
            >
              {busy ? "Saving…" : "Continue to camera"} <Camera className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 3 && verification ? (
        <section className="space-y-6 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <div>
            <h2 className="text-h3">Capture your {DOCUMENT_LABELS[documentType]}</h2>
            <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
              Camera capture is required. Manual gallery or file uploads are disabled.
            </p>
          </div>

          <CameraCapture
            title="Front of document"
            facingMode="environment"
            completed={captured.has("document_front")}
            onCapture={(capture) => uploadCapture("document_front", capture)}
          />
          <CameraCapture
            title="Back of document"
            facingMode="environment"
            completed={captured.has("document_back")}
            onCapture={(capture) => uploadCapture("document_back", capture)}
          />

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="button"
              disabled={!captured.has("document_front") || !captured.has("document_back")}
              onClick={() => setStep(4)}
            >
              Face verification <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 4 && verification ? (
        <section className="space-y-6 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <div>
            <h2 className="text-h3">Verify your face</h2>
            <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
              Use the live front camera. Look directly at the camera, remove sunglasses, and keep
              your face clearly visible. Nexo administrators compare this capture with your ID.
            </p>
          </div>

          <CameraCapture
            title="Live face capture"
            facingMode="user"
            completed={captured.has("selfie")}
            roundPreview
            onCapture={(capture) => uploadCapture("selfie", capture)}
          />

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(3)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button type="button" disabled={!captured.has("selfie")} onClick={() => setStep(5)}>
              Review submission <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}

      {step === 5 && verification ? (
        <section className="space-y-5 rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0" />
            <div>
              <h2 className="text-h3">Submit for review</h2>
              <p className="mt-1 text-small text-[var(--nexo-text-muted)]">
                Confirm the details below. After submission, the current verification is locked
                while an administrator reviews it.
              </p>
            </div>
          </div>

          <dl className="grid gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4 text-small sm:grid-cols-2">
            <Summary label="Country" value={`${countryFlag(countryCode)} ${COUNTRY_OPTIONS.find((c) => c.code === countryCode)?.name || countryCode}`} />
            <Summary label="Full legal name" value={legalName} />
            <Summary label="Date of birth" value={dateOfBirth} />
            <Summary label="Document" value={DOCUMENT_LABELS[documentType]} />
            <Summary label="Document front" value={captured.has("document_front") ? "Captured live" : "Missing"} />
            <Summary label="Document back" value={captured.has("document_back") ? "Captured live" : "Missing"} />
            <Summary label="Face" value={captured.has("selfie") ? "Captured live" : "Missing"} />
          </dl>

          <Alert>
            Your verification images are stored in a private Supabase Storage bucket and are not
            public profile media.
          </Alert>

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(4)}>
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                const result = await submitVerificationAction(verification.id);
                setBusy(false);
                if (!result.ok) return setError(result.error);
                setVerification(result.data);
                router.refresh();
              }}
            >
              {busy ? "Submitting…" : "Submit verification"} <UploadCloud className="h-4 w-4" />
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );

  async function uploadCapture(
    evidenceType: IdentityEvidenceType,
    capture: CameraResult
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    if (!verification) return { ok: false, error: "Verification session is not ready." };
    setError(null);

    try {
      const supabase = createClient();
      const suffix =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const path = `${userId}/${verification.id}/${evidenceType}-${suffix}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("identity-verification")
        .upload(path, capture.blob, {
          cacheControl: "0",
          contentType: "image/jpeg",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const result = await recordVerificationEvidenceAction({
        verificationId: verification.id,
        evidenceType,
        storagePath: path,
        mimeType: "image/jpeg",
        sizeBytes: capture.blob.size,
        captureMetadata: {
          source: "live_camera",
          captured_at: new Date().toISOString(),
          width: capture.width,
          height: capture.height,
          facing_mode: capture.facingMode,
          user_agent: navigator.userAgent,
        },
      });

      if (!result.ok) return { ok: false, error: result.error };

      setCaptured((current) => {
        const next = new Set(current);
        next.add(evidenceType);
        return next;
      });
      return { ok: true };
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not upload live camera capture.";
      setError(message);
      return { ok: false, error: message };
    }
  }
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-caption text-[var(--nexo-text-muted)]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

function StatusCard({
  title,
  description,
  tone,
  children,
}: {
  title: string;
  description: string;
  tone: "success" | "error" | "default";
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-[var(--nexo-radius-xl)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-7">
      <Alert variant={tone} title={title}>
        {description}
      </Alert>
      {children}
    </div>
  );
}

type CameraResult = {
  blob: Blob;
  width: number;
  height: number;
  facingMode: "user" | "environment";
};

function CameraCapture({
  title,
  facingMode,
  completed,
  onCapture,
  roundPreview = false,
}: {
  title: string;
  facingMode: "user" | "environment";
  completed: boolean;
  onCapture: (result: CameraResult) => Promise<{ ok: true } | { ok: false; error: string }>;
  roundPreview?: boolean;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [active, setActive] = React.useState(false);
  const [working, setWorking] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [cameraError, setCameraError] = React.useState<string | null>(null);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  React.useEffect(() => stopCamera, [stopCamera]);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function startCamera() {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("This browser cannot access a live camera. Open Nexo in a modern mobile browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      setActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setCameraError(
        "Camera permission is required for verification. Manual image upload is not available."
      );
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
      setCameraError("Camera is still starting. Try again in a moment.");
      return;
    }

    setWorking(true);
    setCameraError(null);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setWorking(false);
      setCameraError("Could not initialize camera capture.");
      return;
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92)
    );
    if (!blob) {
      setWorking(false);
      setCameraError("Could not create camera image.");
      return;
    }

    const result = await onCapture({
      blob,
      width: canvas.width,
      height: canvas.height,
      facingMode,
    });
    setWorking(false);
    if (!result.ok) {
      setCameraError(result.error);
      return;
    }

    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(blob));
    stopCamera();
  }

  return (
    <div className="space-y-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium">{title}</p>
          <p className="text-caption text-[var(--nexo-text-muted)]">
            {completed ? "Live capture received" : "Live camera capture required"}
          </p>
        </div>
        {completed ? (
          <span className="inline-flex items-center gap-1 text-small font-medium">
            <Check className="h-4 w-4" /> Captured
          </span>
        ) : null}
      </div>

      {cameraError ? <Alert variant="error">{cameraError}</Alert> : null}

      {active ? (
        <div className="space-y-3">
          <div
            className={
              roundPreview
                ? "mx-auto aspect-square max-w-sm overflow-hidden rounded-full bg-black"
                : "aspect-[4/3] overflow-hidden rounded-[var(--nexo-radius-lg)] bg-black"
            }
          >
            <video
              ref={videoRef}
              muted
              playsInline
              autoPlay
              className="h-full w-full object-cover"
            />
          </div>
          <div className="flex justify-center gap-2">
            <Button type="button" variant="outline" onClick={stopCamera} disabled={working}>
              Cancel
            </Button>
            <Button type="button" onClick={capture} disabled={working}>
              <Camera className="h-4 w-4" />
              {working ? "Uploading…" : "Take picture"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={title}
              className={
                roundPreview
                  ? "mx-auto aspect-square w-40 rounded-full object-cover"
                  : "max-h-64 rounded-[var(--nexo-radius)] object-contain"
              }
            />
          ) : null}
          <Button type="button" variant={completed ? "outline" : "primary"} onClick={startCamera}>
            <Camera className="h-4 w-4" />
            {completed ? "Retake with camera" : "Open camera"}
          </Button>
        </div>
      )}
    </div>
  );
}
