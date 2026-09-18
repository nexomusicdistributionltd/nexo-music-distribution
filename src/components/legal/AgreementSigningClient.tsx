"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { signDistributionAgreementAction } from "@/app/(verification)/distribution-agreement/actions";

export function AgreementSigningClient({
  legalName,
  alreadySignedId,
}: {
  legalName: string;
  alreadySignedId?: string | null;
}) {
  const router = useRouter();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawing = React.useRef(false);
  const [method, setMethod] = React.useState<"typed" | "drawn">("typed");
  const [typedName, setTypedName] = React.useState(legalName);
  const [accepted, setAccepted] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function position(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = e.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    if (method !== "drawn") return;
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = position(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || method !== "drawn") return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = position(e);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111";
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }

  function stop() {
    drawing.current = false;
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function sign() {
    setBusy(true);
    setError(null);
    try {
      const drawnSignatureDataUrl =
        method === "drawn" ? canvasRef.current?.toDataURL("image/png") ?? null : null;
      const result = await signDistributionAgreementAction({
        legalName: typedName,
        signatureMethod: method,
        drawnSignatureDataUrl,
        declarationsAccepted: accepted,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(`/distribution-agreement?agreement=${result.agreementId}&signed=1`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (alreadySignedId) {
    return (
      <div className="space-y-4">
        <Alert variant="success" title="Agreement signed">
          Your distribution agreement is active. Keep a copy for your records.
        </Alert>
        <a
          href={`/api/agreements/${alreadySignedId}/download`}
          className="inline-flex h-10 items-center rounded-[var(--nexo-radius)] bg-[var(--nexo-text)] px-4 text-small font-semibold [color:var(--nexo-text-inverse)]"
        >
          Download signed PDF
        </a>
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard")}>
          Continue to dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <Alert variant="error">{error}</Alert> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMethod("typed")}
          className={`rounded-[var(--nexo-radius-lg)] border p-4 text-left ${method === "typed" ? "border-[var(--nexo-text)] bg-[var(--nexo-elevated)]" : "border-[var(--nexo-border)]"}`}
        >
          <strong className="block">Type legal name</strong>
          <span className="text-caption text-[var(--nexo-text-muted)]">Must exactly match approved verification.</span>
        </button>
        <button
          type="button"
          onClick={() => setMethod("drawn")}
          className={`rounded-[var(--nexo-radius-lg)] border p-4 text-left ${method === "drawn" ? "border-[var(--nexo-text)] bg-[var(--nexo-elevated)]" : "border-[var(--nexo-border)]"}`}
        >
          <strong className="block">Draw signature</strong>
          <span className="text-caption text-[var(--nexo-text-muted)]">Sign directly with your finger, stylus, or pointer.</span>
        </button>
      </div>

      <label className="block space-y-1.5">
        <span className="text-label">Verified full legal name</span>
        <Input value={typedName} onChange={(e) => setTypedName(e.target.value)} autoComplete="name" />
      </label>

      {method === "drawn" ? (
        <div className="space-y-2">
          <p className="text-label">Live signature</p>
          <canvas
            ref={canvasRef}
            width={900}
            height={260}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={stop}
            onPointerCancel={stop}
            className="h-40 w-full touch-none rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-white"
            aria-label="Draw your signature"
          />
          <Button type="button" size="sm" variant="ghost" onClick={clearSignature}>
            Clear signature
          </Button>
        </div>
      ) : null}

      <label className="flex items-start gap-3 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] p-4">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-1"
        />
        <span className="text-small">
          I confirm my legal name matches my approved verification; I have read and agree to the
          Agreement; I own or control the distribution rights I submit; I accept the artificial
          streaming/fraud terms, the applicable royalty commission, and electronic execution.
        </span>
      </label>

      <Button type="button" disabled={busy || !accepted || !typedName.trim()} onClick={() => void sign()}>
        {busy ? "Executing agreement…" : "Sign and execute agreement"}
      </Button>
    </div>
  );
}
