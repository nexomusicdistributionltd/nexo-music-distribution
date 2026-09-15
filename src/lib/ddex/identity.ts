import { compactDpid } from "./dpid";

/** Locked production sender identity — never invent a different DPID. */
export const LOCKED_NEXO_PARTY_NAME = "NEXO MUSIC DISTRIBUTION LTD" as const;
export const LOCKED_NEXO_DPID_DISPLAY = "PA-DPIDA-2026021501-H" as const;
export const LOCKED_NEXO_DPID_COMPACT = "PADPIDA2026021501H" as const;

export class ProductionDpidGuardError extends Error {
  readonly code = "DDEX_PRODUCTION_DPID_GUARD";
  constructor(
    message = "Production delivery blocked: sender DPID is not the locked NEXO MUSIC DISTRIBUTION LTD DPID PA-DPIDA-2026021501-H."
  ) {
    super(message);
    this.name = "ProductionDpidGuardError";
  }
}

export function isLockedNexoDpid(raw: string | null | undefined): boolean {
  return compactDpid(raw) === LOCKED_NEXO_DPID_COMPACT;
}

/** BLOCK delivery when sender DPID is not the locked production value. */
export function assertLockedSenderForDelivery(raw: string | null | undefined): string {
  const compact = compactDpid(raw);
  if (compact !== LOCKED_NEXO_DPID_COMPACT) {
    throw new ProductionDpidGuardError();
  }
  return compact;
}
