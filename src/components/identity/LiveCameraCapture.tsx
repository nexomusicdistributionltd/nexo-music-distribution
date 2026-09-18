"use client";

import * as React from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function LiveCameraCapture({
  facingMode,
  title,
  onCapture,
  onCancel,
}: {
  facingMode: "user" | "environment";
  title: string;
  onCapture: (blob: Blob) => void;
  onCancel: () => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [starting, setStarting] = React.useState(true);

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const start = React.useCallback(async () => {
    stop();
    setError(null);
    setStarting(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Live camera access is not supported by this browser.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Camera access was denied. Allow camera access and try again."
      );
    } finally {
      setStarting(false);
    }
  }, [facingMode, stop]);

  React.useEffect(() => {
    void start();
    return stop;
  }, [start, stop]);

  function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError("Camera is not ready yet.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setError("Could not capture camera image.");
      return;
    }
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Could not create captured image.");
          return;
        }
        stop();
        onCapture(blob);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-xs text-white/60">Live camera capture only</p>
        </div>
        <button
          type="button"
          aria-label="Close camera"
          onClick={() => {
            stop();
            onCancel();
          }}
          className="rounded-full p-2 hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`max-h-full max-w-full object-contain ${facingMode === "user" ? "-scale-x-100" : ""}`}
        />
        <div className="pointer-events-none absolute inset-[8%] rounded-2xl border-2 border-white/60" />
        {starting ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm">
            Starting camera…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-x-4 top-4 rounded-xl bg-red-600/90 p-3 text-sm">
            {error}
          </div>
        ) : null}
      </div>
      <div className="flex items-center justify-center gap-3 p-5">
        <Button
          type="button"
          variant="outline"
          onClick={() => void start()}
          className="border-white/30 [color:white] hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Restart
        </Button>
        <Button type="button" onClick={capture} disabled={starting || Boolean(error)}>
          <Camera className="h-4 w-4" />
          Take photo
        </Button>
      </div>
    </div>
  );
}
