import { describe, expect, it } from "vitest";
import { attachProfilesToBillingRows, billingUserCell } from "./admin-display";
import type { BillingSubscriptionRow } from "./types";

const row = {
  id: "sub-row",
  user_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  account_type: "artist",
  paddle_subscription_id: "sub_01real",
  paddle_customer_id: "ctm_01real",
  paddle_product_id: null,
  paddle_price_id: null,
  plan_id: "artist_pro",
  interval: "month",
  status: "active",
  collection_mode: null,
  trial_starts_at: null,
  trial_ends_at: null,
  current_period_starts_at: null,
  current_period_ends_at: null,
  scheduled_change_action: null,
  scheduled_change_effective_at: null,
  canceled_at: null,
  paused_at: null,
  occurred_at: null,
} as BillingSubscriptionRow;

describe("admin billing display", () => {
  it("prefers profile name and email over truncated user id", () => {
    const [attached] = attachProfilesToBillingRows([row], [
      {
        id: row.user_id,
        email: "ada@nexo.test",
        display_name: "Ada Nexo",
        full_name: "Ada",
      },
    ]);
    expect(attached.profile_name).toBe("Ada Nexo");
    expect(attached.profile_email).toBe("ada@nexo.test");
    const cell = billingUserCell(attached);
    expect(cell.title).toBe("Ada Nexo");
    expect(cell.subtitle).toBe("ada@nexo.test");
  });

  it("falls back to email then truncated id — never invents a subscriber", () => {
    const [emailOnly] = attachProfilesToBillingRows([row], [
      { id: row.user_id, email: "solo@nexo.test", display_name: null, full_name: null },
    ]);
    expect(billingUserCell(emailOnly).title).toBe("solo@nexo.test");

    const [missing] = attachProfilesToBillingRows([row], []);
    expect(missing.profile_email).toBeNull();
    expect(billingUserCell(missing).title).toBe(row.user_id.slice(0, 8));
  });
});
