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

export function validateVideoInput(input: { title: string; video_url: string; notes?: string }) {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 300) return { ok: false as const, error: "Title must be 2–300 characters." };
  const url = input.video_url.trim();
  if (!parseHttpUrl(url)) return { ok: false as const, error: "Video URL must be http(s)." };
  const notes = (input.notes ?? "").trim();
  if (notes.length > 4000) return { ok: false as const, error: "Notes are too long." };
  return { ok: true as const, title, url, notes: notes || null };
}

export function validatePayeeInput(input: { name: string; email?: string; role_label?: string }) {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 200) return { ok: false as const, error: "Name is required." };
  const email = (input.email ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "A valid payee email is required." };
  }
  const allowedRoles = new Set(["artist", "label", "producer", "songwriter", "featured", "publisher", "other"]);
  const role_label = (input.role_label ?? "other").trim() || "other";
  if (!allowedRoles.has(role_label)) return { ok: false as const, error: "Invalid payee role." };
  return { ok: true as const, name, email, role_label };
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
  if (input.shares.some((share) => !share.payeeId || !/^[0-9a-f-]{36}$/i.test(share.payeeId))) {
    return { ok: false as const, error: "Every split share must use an approved payee." };
  }
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
