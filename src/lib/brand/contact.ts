/**
 * Public + outbound mailbox constants for NEXO MUSIC DISTRIBUTION LTD.
 * Public website is nexomusicdistribution.com. Zoho SMTP From stays on the
 * verified @nexomusicdistro.space mailbox unless EMAIL_FROM overrides it.
 */

export const PRIMARY_CONTACT_EMAIL = "contact@nexomusicdistro.space";
export const INQUIRIES_EMAIL = "nexomusicdistribution@gmail.com";

/** @deprecated Use PRIMARY_CONTACT_EMAIL — kept as the legal/support mailbox alias. */
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
