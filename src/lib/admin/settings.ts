export const ADMIN_SETTING_KEYS = [
  "qc.default_priority",
  "qc.auto_claim",
  "support.sla_hours",
  "contact.auto_assign",
  "operations.maintenance_notice",
  "reports.retention_days",
] as const;

export type AdminSettingKey = (typeof ADMIN_SETTING_KEYS)[number];

export function isAllowedAdminSettingKey(key: string): key is AdminSettingKey {
  return (ADMIN_SETTING_KEYS as readonly string[]).includes(key);
}
