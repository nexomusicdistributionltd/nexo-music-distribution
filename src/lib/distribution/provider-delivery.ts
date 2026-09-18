import type { ProviderDspDeliveryStatus } from "@/lib/provider/types";

type Json = Record<string, unknown>;

const ARRAY_KEYS = new Set([
  "deliverylog",
  "deliverylogs",
  "deliveries",
  "storestatuses",
  "platformstatuses",
  "servicestatuses",
  "stores",
  "services",
  "platforms",
]);

function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Json)
    : null;
}

function scalar(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function firstString(record: Json, keys: string[]): string | null {
  for (const key of keys) {
    const value = scalar(record[key]);
    if (value) return value;
  }
  return null;
}

function keyShape(key: string): string {
  return key.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function normalizeEntry(
  value: unknown,
  allowGenericName: boolean
): ProviderDspDeliveryStatus | null {
  const row = asRecord(value);
  if (!row) return null;

  const dsp =
    firstString(row, [
      "dsp",
      "dsp_name",
      "dspName",
      "store",
      "store_name",
      "storeName",
      "platform",
      "platform_name",
      "platformName",
      "service",
      "service_name",
      "serviceName",
    ]) ?? (allowGenericName ? firstString(row, ["name"]) : null);

  const status = firstString(row, [
    "status",
    "delivery_status",
    "deliveryStatus",
    "state",
  ]);

  if (!dsp || !status) return null;

  const message = firstString(row, [
    "message",
    "error",
    "error_message",
    "errorMessage",
    "reason",
    "details",
  ]);
  const updatedAt = firstString(row, [
    "updated_at",
    "updatedAt",
    "delivered_at",
    "deliveredAt",
    "completed_at",
    "completedAt",
    "timestamp",
  ]);

  return {
    dsp,
    status,
    ...(message ? { message } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

function collectDspStatuses(
  value: unknown,
  out: ProviderDspDeliveryStatus[],
  depth = 0
): void {
  if (depth > 4) return;
  const record = asRecord(value);
  if (!record) return;

  const explicit = normalizeEntry(record, false);
  if (explicit) out.push(explicit);

  for (const [key, nested] of Object.entries(record)) {
    const shaped = keyShape(key);

    if (Array.isArray(nested)) {
      if (ARRAY_KEYS.has(shaped)) {
        for (const item of nested) {
          const entry = normalizeEntry(item, true);
          if (entry) out.push(entry);
          const child = asRecord(item);
          if (child) collectDspStatuses(child, out, depth + 1);
        }
      }
      continue;
    }

    if (asRecord(nested)) {
      collectDspStatuses(nested, out, depth + 1);
    }
  }
}

export function extractReleaseStatus(
  payload: unknown,
  fallback?: string | null
): string {
  const outer = asRecord(payload) ?? {};
  const data = asRecord(outer.data);
  const release = asRecord(outer.release);
  const dataRelease = asRecord(data?.release);

  const records = [outer, data, release, dataRelease].filter(
    (value): value is Json => Boolean(value)
  );
  for (const record of records) {
    const found = firstString(record, [
      "status",
      "release_status",
      "releaseStatus",
      "delivery_status",
      "deliveryStatus",
    ]);
    if (found) return found;
  }
  return fallback?.trim() || "unknown";
}

export function extractDspDeliveryStatuses(
  payload: unknown
): ProviderDspDeliveryStatus[] {
  const rows: ProviderDspDeliveryStatus[] = [];
  collectDspStatuses(payload, rows);

  const latestByDsp = new Map<string, ProviderDspDeliveryStatus>();
  for (const row of rows) {
    latestByDsp.set(row.dsp.trim().toLowerCase(), row);
  }

  return [...latestByDsp.values()].sort((a, b) =>
    a.dsp.localeCompare(b.dsp)
  );
}

export function normalizeProviderDeliveryPayload(
  payload: unknown,
  fallbackStatus?: string | null
): {
  releaseStatus: string;
  dspStatuses: ProviderDspDeliveryStatus[];
} {
  return {
    releaseStatus: extractReleaseStatus(payload, fallbackStatus),
    dspStatuses: extractDspDeliveryStatuses(payload),
  };
}
