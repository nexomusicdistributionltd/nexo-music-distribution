import { isPortalServiceKind, type PortalServiceKind } from "@/lib/portal/service-kinds";
import { parseHttpUrl } from "@/lib/dsp/profile-links";
import { validateSplitShares, type SplitShareInput } from "@/lib/finance/splits";

export type PortalActionError = { ok: false; error: string };
export type PortalActionOk<T = unknown> = { ok: true; data: T };

export function validateServiceRequestInput(input: {
  kind: string;
  title: string;
  body?: string;
  related_url?: string;
}): PortalActionError | { ok: true; kind: PortalServiceKind; title: string; body: string | null; url: string | null } {
  if (!isPortalServiceKind(input.kind)) return { ok: false, error: "Unknown request type." };
  const title = input.title.trim();
  if (title.length < 2 || title.length > 200) return { ok: false, error: "Title must be 2–200 characters." };
  const body = (input.body ?? "").trim();
  if (body.length > 8000) return { ok: false, error: "Details are too long." };
  const urlRaw = (input.related_url ?? "").trim();
  if (urlRaw && !parseHttpUrl(urlRaw)) return { ok: false, error: "URL must be http(s)." };
  return { ok: true, kind: input.kind, title, body: body || null, url: urlRaw || null };
}

export function validateVideoInput(input: {
  title: string;
  video_url: string;
  primary_artist_name?: string;
  genre?: string;
  language?: string;
  release_date?: string;
  video_type?: string;
  age_restriction?: string;
  is_cover_version?: boolean;
  reference_upc?: string;
  reference_isrc?: string;
  deliver_apple_music?: boolean;
  deliver_vevo?: boolean;
  confirm_rights?: boolean;
  notes?: string;
}) {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 300) {
    return { ok: false as const, error: "Title must be 2–300 characters." };
  }
  const url = input.video_url.trim();
  const parsedUrl = parseHttpUrl(url);
  if (!parsedUrl || parsedUrl.protocol !== "https:") {
    return { ok: false as const, error: "Video URL must be a valid HTTPS URL." };
  }
  const primaryArtistName = (input.primary_artist_name ?? "").trim();
  if (primaryArtistName && primaryArtistName.length > 300) {
    return { ok: false as const, error: "Primary artist name is too long." };
  }
  const referenceUpc = (input.reference_upc ?? "").trim();
  if (referenceUpc && !/^[0-9]{12,14}$/.test(referenceUpc)) {
    return { ok: false as const, error: "Reference UPC must be 12–14 digits." };
  }
  const referenceIsrc = (input.reference_isrc ?? "").trim().toUpperCase();
  if (referenceIsrc && !/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/.test(referenceIsrc)) {
    return { ok: false as const, error: "Reference ISRC is invalid." };
  }
  if (input.confirm_rights !== true) {
    return { ok: false as const, error: "Confirm that you control the rights to distribute this video." };
  }
  const notes = (input.notes ?? "").trim();
  if (notes.length > 4000) return { ok: false as const, error: "Notes are too long." };
  return {
    ok: true as const,
    title,
    url,
    primaryArtistName: primaryArtistName || null,
    genre: (input.genre ?? "").trim() || null,
    language: (input.language ?? "").trim() || null,
    releaseDate: (input.release_date ?? "").trim() || null,
    videoType: (input.video_type ?? "").trim() || null,
    ageRestriction: (input.age_restriction ?? "").trim() || null,
    isCoverVersion: input.is_cover_version === true,
    referenceUpc: referenceUpc || null,
    referenceIsrc: referenceIsrc || null,
    deliverAppleMusic: input.deliver_apple_music !== false,
    deliverVevo: input.deliver_vevo !== false,
    notes: notes || null,
  };
}

export function validatePayeeInput(input: { name: string; email?: string; role_label?: string }) {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 200) return { ok: false as const, error: "Name is required." };
  const email = (input.email ?? "").trim().toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Invalid email." };
  const role_label = (input.role_label ?? "other").trim() || "other";
  return { ok: true as const, name, email: email || null, role_label };
}

export function validateMemberInput(input: { email: string; display_name?: string; role_label?: string }) {
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false as const, error: "Valid email is required." };
  const display_name = (input.display_name ?? "").trim() || null;
  const role_label = (input.role_label ?? "member").trim() || "member";
  return { ok: true as const, email, display_name, role_label };
}

export function validatePayoutRequestInput(input: { amountMinor: number; currency?: string }) {
  const amountMinor = Math.trunc(Number(input.amountMinor));
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false as const, error: "Amount must be a positive integer (minor units)." };
  }
  const currency = (input.currency ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false as const, error: "Currency must be a 3-letter code." };
  return { ok: true as const, amountMinor, currency };
}

export function validateSplitCreateInput(input: {
  name: string;
  shares: SplitShareInput[];
  effectiveFrom?: string;
}) {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 200) return { ok: false as const, error: "Split name is required." };
  const check = validateSplitShares(input.shares);
  if (!check.ok) return { ok: false as const, error: check.reason ?? "Invalid shares." };
  const effectiveFrom = (input.effectiveFrom ?? "").trim() || new Date().toISOString().slice(0, 10);
  return { ok: true as const, name, shares: input.shares, effectiveFrom };
}

export function validateRecoupmentInput(input: { title: string; amountMinor: number; currency?: string }) {
  const title = input.title.trim();
  if (title.length < 2) return { ok: false as const, error: "Title is required." };
  const amountMinor = Math.trunc(Number(input.amountMinor));
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return { ok: false as const, error: "Amount must be a positive integer (minor units)." };
  }
  const currency = (input.currency ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { ok: false as const, error: "Invalid currency." };
  return { ok: true as const, title, amountMinor, currency };
}

export function validateTaxInput(input: { legal_name?: string; country?: string; tax_id?: string }) {
  const legal_name = (input.legal_name ?? "").trim().slice(0, 200) || null;
  const country = (input.country ?? "").trim().toUpperCase().slice(0, 2) || null;
  if (country && !/^[A-Z]{2}$/.test(country)) return { ok: false as const, error: "Country must be ISO-2." };
  const tax_id = (input.tax_id ?? "").trim().slice(0, 80) || null;
  return { ok: true as const, legal_name, country, tax_id };
}
