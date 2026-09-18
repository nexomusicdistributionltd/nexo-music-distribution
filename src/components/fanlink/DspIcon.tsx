import { DSP_BRANDS, type DspBrand } from "@/lib/dsp-brands";

const brandByKey = new Map<string, DspBrand>(
  DSP_BRANDS.map((brand) => [brand.key.toLowerCase(), brand])
);

const aliases: Record<string, string> = {
  apple_music: "applemusic",
  youtube_music: "youtubemusic",
  amazon: "amazonmusic",
  amazon_music: "amazonmusic",
};

export function DspIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const normalized = name.toLowerCase();
  const key = aliases[normalized] ?? normalized;
  const icon = brandByKey.get(key);
  if (!icon) return null;

  return (
    <svg className={className} role="img" viewBox="0 0 24 24" aria-label={icon.title}>
      <path fill="currentColor" d={icon.path} />
    </svg>
  );
}
