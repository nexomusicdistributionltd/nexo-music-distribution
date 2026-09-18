"use client";

import * as React from "react";
import { Camera, Check, RefreshCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Props = {
  label: string;
  description: string;
  facingMode: "user" | "environment";
  complete: boolean;
  disabled?: boolean;
  onCapture: (blob: Blob) => Promise<void> | void;
};

export function CameraCapture({
  label,
  description,
  facingMode,
  complete,
  disabled = false,
  onCapture,
}: Props) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser does not support live camera capture. Use a current mobile browser with camera access.");
      return;
    }
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1600 },
          height: { ideal: 1200 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setOpen(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Camera access was denied or unavailable. Allow camera permission in your browser and try again.");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || video.videoWidth < 1 || video.videoHeight < 1) {
      setError("The camera is not ready yet. Wait a moment and try again.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const maxWidth = 1800;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Camera capture unavailable");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("Could not capture photo"))),
          "image/jpeg",
          0.9
        );
      });
      const url = URL.createObjectURL(blob);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      stopCamera();
      setOpen(false);
      await onCapture(blob);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not capture photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--nexo-radius-lg)] border border-[var(--nexo-border)] bg-[var(--nexo-surface)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-small font-semibold">{label}</h3>
          <p className="mt-1 text-caption text-[var(--nexo-text-muted)]">{description}</p>
        </div>
        {complete ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--nexo-success-bg)] px-2 py-1 text-caption text-[var(--nexo-success)]">
            <Check className="h-3.5 w-3.5" aria-hidden /> Captured
          </span>
        ) : null}
      </div>

      {preview ? (
        <div className="mt-4 overflow-hidden rounded-[var(--nexo-radius)] border border-[var(--nexo-border)] bg-black">
          {/* browser-created camera snapshot only */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="max-h-80 w-full object-contain" />
        </div>
      ) : null}

      {open ? (
        <div className="mt-4 space-y-3">
          <div className="relative overflow-hidden rounded-[var(--nexo-radius)] bg-black">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className={`max-h-[55vh] w-full object-cover ${facingMode === "user" ? "-scale-x-100" : ""}`}
            />
            <div className="pointer-events-none absolute inset-3 rounded-[var(--nexo-radius)] border border-white/35" />
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={capture} disabled={busy} className="flex-1">
              <Camera className="h-4 w-4" aria-hidden />
              {busy ? "Capturing…" : "Take photo"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                stopCamera();
                setOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant={complete ? "outline" : "primary"}
          className="mt-4 w-full"
          onClick={startCamera}
          disabled={disabled || busy}
        >
          {complete ? <RefreshCcw className="h-4 w-4" aria-hidden /> : <Camera className="h-4 w-4" aria-hidden />}
          {complete ? "Retake with camera" : "Open live camera"}
        </Button>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-caption text-[var(--nexo-text-muted)]">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
        Manual file uploads are disabled. This step only accepts a live camera capture.
      </p>

      {error ? <p className="mt-2 text-caption text-[var(--nexo-error)]">{error}</p> : null}
    </section>
  );
}
