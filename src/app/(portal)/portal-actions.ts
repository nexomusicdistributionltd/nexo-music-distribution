"use server";

import { revalidatePath } from "next/cache";
import { RequireVerifiedPortal, assertCanMutateCatalog } from "@/lib/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { publicErrorMessage } from "@/lib/http/safe-error";
import { RATE_LIMITS, checkRateLimit } from "@/lib/security/rate-limit";
import {
  validateMemberInput,
  validatePayeeInput,
  validatePayoutRequestInput,
  validateRecoupmentInput,
  validateServiceRequestInput,
  validateSplitCreateInput,
  validateTaxInput,
  validateVideoInput,
} from "@/lib/portal/validate";
import type { SplitShareInput } from "@/lib/finance/splits";

export type PortalActionResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function requirePortal() {
  return RequireVerifiedPortal();
}

function revalidatePortal() {
  revalidatePath("/dashboard");
  revalidatePath("/catalog", "layout");
  revalidatePath("/marketing", "layout");
  revalidatePath("/analytics", "layout");
  revalidatePath("/rights", "layout");
  revalidatePath("/help", "layout");
  revalidatePath("/splitshare", "layout");
  revalidatePath("/account", "layout");
  revalidatePath("/earnings", "layout");
  revalidatePath("/dashboard/videos");
}

export async function createServiceRequestAction(input: {
  kind: string;
  title: string;
  body?: string;
  related_url?: string;
  release_id?: string;
}): Promise<PortalActionResult<{ id: string }
