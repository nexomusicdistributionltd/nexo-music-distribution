/** Public, unauthenticated policy routes (Paddle verification + Cookies). */
export const PADDLE_VERIFICATION_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/cookies", label: "Cookies" },
] as const;
