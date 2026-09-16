"use client";

import * as React from "react";
import Image from "next/image";
import { CircularCta } from "@/components/public/CircularCta";
import { DisplayHeading } from "@/components/public/DisplayHeading";

const FALLBACK_SLIDES = [
  { src: "/images/editorial/singer-microphone.jpg", alt: "Vocalist at a microphone" },
  { src: "/images/editorial/live-performance.jpg", alt: "Live performance" },
  { src: "/images/editorial/studio-session.jpg", alt: "Studio session" },
];

export function HeroStage({
  eyebrow,
  title,
  accent,
  body,
  ctaLabel,
  ctaHref,
  heroImage,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  heroImage?: string;
}) {
  const slides = React.useMemo(() => {
    if (heroImage) {
      return [{ src: heroImage, alt: "Nexo editorial" }, ...FALLBACK_SLIDES.filter((s) => s.src !== heroImage)];
    }
    return FALLBACK_SLIDES;
  }, [heroImage]);

  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, 6200);
    return () => window.clearInterval(id);
  }, [slides.length]);

  const pad = String(index + 1).padStart(2, "0");
  const total = String(slides.length).padStart(2, "0");

  return (
    <section className="pub-hero" aria-label="Hero">
      {slides.map((slide, i) => (
        <div key={slide.src} className="pub-hero-slide" data-active={i === index}>
          <Image
            src={slide.src}
            alt={i === index ? slide.alt : ""}
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover"
          />
        </div>
      ))}
      <div className="pub-hero-veil" aria-hidden />
      <p className="pub-scroll-cue">Scroll to explore</p>
      <div className="pub-hero-copy">
        <div className="flex items-start justify-between gap-6">
          <p className="max-w-xs text-sm leading-relaxed" style={{ color: "var(--pub-on-media-muted)" }}>
            {eyebrow}
          </p>
          <p className="pub-kicker shrink-0 pt-1" style={{ color: "var(--pub-on-media-muted)" }}>
            {pad} / {total}
            <span className="ml-3 inline-block h-px w-10 align-middle bg-current opacity-60" />
          </p>
        </div>
        <DisplayHeading as="h1" size="hero" className="mt-8 max-w-[18ch]">
          {title}
          <br />
          {accent}
        </DisplayHeading>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-8 pt-10">
          <p className="max-w-sm text-base leading-relaxed" style={{ color: "var(--pub-on-media-muted)" }}>
            {body}
          </p>
          <p className="pub-kicker" style={{ color: "var(--pub-on-media-muted)" }}>
            450+ platforms
            <br />
            Artists &amp; labels
          </p>
          <CircularCta href={ctaHref}>{ctaLabel}</CircularCta>
        </div>
      </div>
    </section>
  );
}
