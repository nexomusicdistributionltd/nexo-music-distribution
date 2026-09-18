"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { signDistributionAgreementAction } from "@/app/distribution-agreement/actions";

export function AgreementSigningClient({
  legalName,
  declarations,
}: {
  legalName: string;
  declarations: readonly string[];
}) {
  const router = useRouter();
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const drawingRef = React.useRef(false);
  const [accepted, setAccepted] = React.useState<boolean[]>(
    declarations.map(() => false)
  );
  const [confirmedName, setConfirmedName] = React.useState("");
  const [method, setMethod] = React.useState<"typed" | "drawn">("typed");
  const [typedSignature, setTypedSignature] = React.useState("");
  const [hasDrawing, setHasDrawing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * ratio));
    canvas.height = Math.max(1, Math.round(rect.height * ratio));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, [method]);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function startDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(e.pointerId);
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    setHasDrawing(true);
  }

  function stopDrawing(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // no-op
    }
  }

  function clearDrawing() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    setHasDrawing(false);
  }

  const allAccepted = accepted.every(Boolean);
  const canSubmit =
    allAccepted &&
    confirmedName.trim().length > 0 &&
    (method === "typed" ? typedSignature.trim().length > 0 : hasDrawing);

  async function submit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    try {
      const drawnSignatureDataUrl =
        method === "drawn" ? canvasRef.current?.toDataURL("image/png") : undefined;
      const result = await signDistributionAgreementAction({
        legalName: confirmedName,
        declarationsAccepted: accepted,
        signatureMethod: method,
        typedSignature: method === "typed" ? typedSignature : undefined,
        drawnSignatureDataUrl,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign the agreement.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6 rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-card)] p-5 sm:p-6">
      <div>
        <h2 className="text-h3">Electronic execution</h2>
        <p className="mt-2 text-small text-[var(--nexo-text-muted)]">
          Your verified legal name is <strong className="text-[var(--nexo-text)]">{legalName}</strong>.
          The signing name must match it.
        </p>
      </div>

      <div className="space-y-3">
        {declarations.map((declaration, index) => (
          <label key={declaration} className="flex items-start gap-3 text-small">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={accepted[index]}
              onChange={(e) =>
                setAccepted((current) =>
                  current.map((value, i) => (i === index ? e.target.checked : value))
                )
              }
            />
            <span>{declaration}</span>
          </label>
        ))}
      </div>

      <label className="block space-y-2">
        <span className="text-small font-medium">Full legal name / legal entity name</span>
        <Input
          value={confirmedName}
          onChange={(e) => setConfirmedName(e.target.value)}
          placeholder={legalName}
          autoComplete="name"
        />
      </label>

      <div className="space-y-3">
        <p className="text-small font-medium">Signature method</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={method === "typed" ? "primary" : "secondary"}
            onClick={() => setMethod("typed")}
          >
            Type legal name
          </Button>
          <Button
            type="button"
            variant={method === "drawn" ? "primary" : "secondary"}
            onClick={() => setMethod("drawn")}
          >
            Draw signature
          </Button>
        </div>

        {method === "typed" ? (
          <Input
            value={typedSignature}
            onChange={(e) => setTypedSignature(e.target.value)}
            placeholder="Type your verified full legal name"
          />
        ) : (
          <div className="space-y-2">
            <canvas
              ref={canvasRef}
              className="h-40 w-full touch-none rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-white"
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              onPointerCancel={stopDrawing}
              aria-label="Draw signature"
            />
            <Button type="button" variant="secondary" onClick={clearDrawing}>
              Clear signature
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <Alert variant="error" title="Agreement not signed">
          {error}
        </Alert>
      ) : null}

      <Button type="button" disabled={!canSubmit || busy} onClick={submit}>
        {busy ? "Signing securely…" : "Sign agreement and continue"}
      </Button>
    </section>
  );
}
