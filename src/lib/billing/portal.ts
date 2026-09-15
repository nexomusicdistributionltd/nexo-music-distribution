import "server-only";

import type { AppRole } from "@/lib/auth/types";
import { billingAccountTypeFromRoles } from "./eligibility";

export function authorizeCustomerPortal(input: {
  authenticated: boolean;
  roles: AppRole[];
  profileAccountType?: string | null;
  requestedCustomerId?: unknown;
}): { ok: true } | { ok: false; error: string; status: number } {
  if (!input.authenticated) {
    return { ok: false, error: "Sign in to manage billing.", status: 401 };
  }
  if (
    input.requestedCustomerId !== undefined &&
    input.requestedCustomerId !== null &&
    input.requestedCustomerId !== ""
  ) {
    return { ok: false, error: "Client customer_id is not accepted.", status: 400 };
  }
  const accountType = billingAccountTypeFromRoles(input.roles, input.profileAccountType);
  if (!accountType) {
    return { ok: false, error: "Only artist and label accounts can open the customer portal.", status: 403 };
  }
  return { ok: true };
}
