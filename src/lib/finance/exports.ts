/** Finance export types allowed via Batch 5 report_exports. */

export const FINANCE_REPORT_TYPES = [
  "ledger_entries",
  "royalty_statement",
  "payouts",
  "publishing_works",
  "royalty_import_batch",
] as const;

export type FinanceReportType = (typeof FINANCE_REPORT_TYPES)[number];

export function isAllowedFinanceReportType(t: string): t is FinanceReportType {
  return (FINANCE_REPORT_TYPES as readonly string[]).includes(t);
}
