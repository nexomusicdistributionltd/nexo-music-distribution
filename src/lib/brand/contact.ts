/**
 * Public mailbox defaults for NEXO MUSIC DISTRIBUTION LTD.
 *
 * Outbound SMTP can continue using the verified sender configured in server
 * environment. These addresses are the public-facing website/legal defaults.
 */

export const PRIMARY_CONTACT_EMAIL = "support@nexomusicdistribution.com";
export const SUPPORT_EMAIL = "support@nexomusicdistribution.com";
export const DMCA_EMAIL = "dmca@nexomusicdistribution.com";
export const INQUIRIES_EMAIL = SUPPORT_EMAIL;

/** @deprecated Use PRIMARY_CONTACT_EMAIL for general legal/support contact. */
export const LEGAL_CONTACT_EMAIL = PRIMARY_CONTACT_EMAIL;

export const BRANDED_FROM_DOMAINS = [
  "nexomusicdistribution.com",
  "nexomusicdistro.space",
] as const;

export function isBrandedFromAddress(address: string): boolean {
  const lower = address.trim().toLowerCase();
  const at = lower.lastIndexOf("@");
  if (at < 0) return false;
  const domain = lower.slice(at + 1).replace(/>$/, "");
  return (BRANDED_FROM_DOMAINS as readonly string[]).includes(domain);
}

export function isPublicBrandedEmail(address: string): boolean {
  const lower = address.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lower)) return false;
  const domain = lower.slice(lower.lastIndexOf("@") + 1);
  return (BRANDED_FROM_DOMAINS as readonly string[]).includes(domain);
}
