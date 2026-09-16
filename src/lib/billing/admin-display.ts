import type { BillingSubscriptionRow } from "./types";

export type BillingProfileLite = {
  id: string;
  email: string | null;
  display_name: string | null;
  full_name: string | null;
};

export type AdminBillingSubscriptionRow = BillingSubscriptionRow & {
  profile_email: string | null;
  profile_name: string | null;
};

export function profileDisplayName(profile: BillingProfileLite | null | undefined): string | null {
  if (!profile) return null;
  const name = profile.display_name?.trim() || profile.full_name?.trim() || "";
  return name || profile.email?.trim() || null;
}

export function attachProfilesToBillingRows(
  rows: BillingSubscriptionRow[],
  profiles: BillingProfileLite[]
): AdminBillingSubscriptionRow[] {
  const map = new Map(profiles.map((p) => [p.id, p]));
  return rows.map((row) => {
    const profile = map.get(row.user_id) ?? null;
    return {
      ...row,
      profile_email: profile?.email?.trim() || null,
      profile_name: profileDisplayName(profile),
    };
  });
}

export function billingUserCell(row: Pick<AdminBillingSubscriptionRow, "user_id" | "profile_name" | "profile_email">): {
  title: string;
  subtitle: string | null;
} {
  const title = row.profile_name || row.profile_email || row.user_id.slice(0, 8);
  const subtitle =
    row.profile_email && row.profile_email !== title
      ? row.profile_email
      : row.profile_name
        ? row.user_id.slice(0, 8)
        : null;
  return { title, subtitle };
}
