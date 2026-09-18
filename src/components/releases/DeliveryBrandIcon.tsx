import { siAudiomack, siPandora } from "simple-icons/icons";
import { DSP_BRANDS, type DspBrand } from "@/lib/dsp-brands";

const brandByKey = new Map<string, DspBrand>([
  ...DSP_BRANDS.map((brand) => [brand.key.toLowerCase(), brand] as const),
  ["audiomack", { key: "audiomack", title: siAudiomack.title, path: siAudiomack.path }],
  ["pandora", { key: "pandora", title: siPandora.title, path: siPandora.path }],
]);

const aliases: Record<string, string> = {
  apple: "applemusic",
  applemusic: "applemusic",
  itunes: "applemusic",
  youtube: "youtube",
  youtubecontentid: "youtube",
  youtubemusic: "youtubemusic",
  amazon: "amazonmusic",
  amazonmusic: "amazonmusic",
  metarightsmanager: "facebook",
  facebookinstagram: "facebook",
  facebook: "facebook",
  instagram: "instagram",
  soundcloudmonetization: "soundcloud",
  soundcloud: "soundcloud",
  beatport: "beatport",
  spotify: "spotify",
  tiktok: "tiktok",
  tidal: "tidal",
  deezer: "deezer",
  shazam: "shazam",
  bandcamp: "bandcamp",
  audiomack: "audiomack",
  pandora: "pandora",
};

const officialDomains: Record<string, string> = {
  soundexchange: "soundexchange.com",
  tracklib: "tracklib.com",
  hook: "hookmusic.com",
  hookmusic: "hookmusic.com",
  lyricfind: "lyricfind.com",
  even: "get.even.biz",
  junodownload: "junodownload.com",
  qobuz: "qobuz.com",
  anghami: "anghami.com",
  boomplay: "boomplay.com",
  napster: "napster.com",
  iheartradio: "iheart.com",
  kkbox: "kkbox.com",
  jiosaavn: "jiosaavn.com",
  gaana: "gaana.com",
  joox: "joox.com",
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function DeliveryBrandIcon({
  name,
  className = "h-5 w-5",
}: {
  name: string;
  className?: string;
}) {
  const normalized = normalize(name);
  const key = aliases[normalized] ?? normalized;
  const icon = brandByKey.get(key);

  if (icon) {
    return (
      <svg className={className} role="img" viewBox="0 0 24 24" aria-label={icon.title}>
        <path fill="currentColor" d={icon.path} />
      </svg>
    );
  }

  const domain = officialDomains[key];
  if (domain) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain_url=https://${domain}&sz=64`}
        alt=""
        aria-hidden="true"
        className={`${className} rounded-sm object-contain`}
        loading="lazy"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex items-center justify-center rounded-full border border-current text-[0.55rem] font-bold uppercase`}
    >
      {name.trim().slice(0, 1)}
    </span>
  );
}
