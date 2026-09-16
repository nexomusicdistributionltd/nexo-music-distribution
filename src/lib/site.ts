export { getSiteUrl, absoluteUrl, DEFAULT_SITE_URL } from "@/lib/site-url";
export {
  BRAND_PUBLIC_URL,
  BRAND_SOCIAL,
  BRAND_SOCIAL_LINKS,
  BRAND_SOCIAL_NAV_LABEL,
} from "@/lib/brand/social";

export const SITE_URL = "https://nexomusicdistribution.com";
export const SITE_NAME = "NEXO Music Distribution";
export const COMPANY_LEGAL = "NEXO MUSIC DISTRIBUTION LTD";
export const PUBLISHING_DIVISION = "Nexo Publishing Group";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/distribution", label: "Distribution" },
  { href: "/publishing", label: "Publishing", badge: "New" as const },
  { href: "/music", label: "Music" },
  { href: "/artists", label: "For Artists" },
  { href: "/labels", label: "For Labels" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
  { href: "/services", label: "Services" },
  { href: "/about", label: "About" },
] as const;

/** Compact primary nav — SwarVision composition, Nexo destinations. */
export const PUBLIC_NAV_PRIMARY = [
  { href: "/artists", label: "Artists" },
  { href: "/labels", label: "Labels" },
  { href: "/distribution", label: "Platform" },
  { href: "/services", label: "Services" },
  { href: "/pricing", label: "Plans" },
] as const;

export const PUBLIC_NAV_MORE = [
  { href: "/publishing", label: "Publishing" },
  { href: "/music", label: "Music" },
  { href: "/blog", label: "Blog" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
] as const;

export const CONFIRMED_STATS = [
  { value: "30+", label: "Artists" },
  { value: "50+", label: "Releases" },
  { value: "10+", label: "New Releases / Month" },
  { value: "450+", label: "Platforms" },
] as const;
