import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("artist and label royalty portal", () => {
  it("keeps royalty screens customer-facing", () => {
    const sources = [
      read("src/app/(portal)/earnings/page.tsx"),
      read("src/app/(portal)/earnings/transactions/page.tsx"),
      read("src/app/(portal)/earnings/statements/page.tsx"),
      read("src/app/(portal)/earnings/payouts/page.tsx"),
      read("src/app/(portal)/earnings/splits/page.tsx"),
      read("src/components/finance/PayoutMethodsManager.tsx"),
      read("src/components/portal/PortalForms.tsx"),
    ].join("\n");

    for (const phrase of [
      "Balances are derived from the royalty ledger",
      "No financial data available yet",
      "No royalty entries have been posted yet",
      "ROYALTY / ADJUSTMENT / DEDUCTION / FEE / PAYOUT / REFUND",
      "Nexo Finance processes approved payout requests",
      "Published statements from real ledger data",
      "No fabricated figures",
      "Historical rules used in ledger calculations",
      "Nexo Finance approval",
      "Nexo Finance review",
      "sent to Nexo Finance",
    ]) {
      expect(sources).not.toContain(phrase);
    }
  });

  it("loads current provider sales without exposing provider diagnostics", () => {
    const earnings = read("src/app/(portal)/earnings/page.tsx");
    const provider = read("src/lib/provider/distribution-reference.ts");

    expect(earnings).toContain('loadSalesSnapshot(user.userId, "overview")');
    expect(earnings).toContain('export const dynamic = "force-dynamic"');
    expect(earnings).toContain("Reported royalties");
    expect(provider).toContain('cache: "no-store"');
    expect(provider).toContain('apiLive(withQuery("/sales/releases/');
  });

  it("keeps payout requests compatible with the cleaned form API", () => {
    const payouts = read("src/app/(portal)/earnings/payouts/page.tsx");
    const forms = read("src/components/portal/PortalForms.tsx");

    expect(payouts).not.toContain("paymentMessage=");
    expect(forms).not.toContain("paymentMessage:");
    expect(forms).toContain("Payout request submitted.");
  });
});
