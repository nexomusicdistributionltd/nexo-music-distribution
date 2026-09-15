import { evaluateReleaseReadiness, type ReadinessReport } from "./readiness";
import type { DdexRuntimeConfig } from "./config";
import type { DdexCatalogSnapshot, DspTargetRow } from "./types";
import { isLockedNexoDpid } from "./identity";

export type DdexValidationReport = ReadinessReport & {
  identity: {
    senderConfigured: boolean;
    lockedProductionSender: boolean;
    recipientConfigured: boolean;
    testTarget: boolean;
  };
};

export function validateReleaseForDdexFromSnapshot(
  snapshot: DdexCatalogSnapshot,
  cfg: DdexRuntimeConfig,
  target?: DspTargetRow | null
): DdexValidationReport {
  const recipientConfigured = Boolean(cfg.recipientPartyId);
  const readiness = evaluateReleaseReadiness({
    upc: snapshot.release.upc,
    copyright_line: snapshot.release.copyright_line,
    phonogram_line: snapshot.release.phonogram_line,
    artist_profile_id: snapshot.release.artist_profile_id,
    primary_artist_name: snapshot.release.primary_artist_name,
    genre: snapshot.release.genre,
    territories: snapshot.release.territories,
    release_date: snapshot.release.release_date,
    tracks: snapshot.tracks,
    contributors: snapshot.contributors,
    assets: snapshot.assets,
    deals: snapshot.deals,
    senderConfigured: Boolean(cfg.senderPartyId),
    recipientConfigured,
  });

  return {
    ...readiness,
    identity: {
      senderConfigured: Boolean(cfg.senderPartyId),
      lockedProductionSender: isLockedNexoDpid(cfg.senderDpidDisplay),
      recipientConfigured,
      testTarget: Boolean(target?.is_test),
    },
  };
}
