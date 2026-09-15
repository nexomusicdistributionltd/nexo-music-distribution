export { getSiteUrl, absoluteUrl, DEFAULT_SITE_URL } from "@/lib/site-url";

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

export const CONFIRMED_STATS = [
  { value: "30+", label: "Artists" },
  { value: "50+", label: "Releases" },
  { value: "10+", label: "New Releases / Month" },
  { value: "450+", label: "Platforms" },
] as const;
