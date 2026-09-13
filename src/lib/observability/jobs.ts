import "server-only";

/**
 * Best-effort job run recording helpers.
 * Never invents success for unavailable integrations.
 */
export type JobRunStatus =
  | "started"
  | "succeeded"
  | "failed"
  | "skipped_unavailable";

export function unavailableJobMeta(integration: string) {
  return {
    integration,
    connected: false,
    note: "NOT CONNECTED — no fake success recorded",
  };
}
