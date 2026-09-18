import "server-only";

import { loadDistributionAccessToken } from "./oauth/store";
import { readDistributionOAuthConfig } from "./oauth/config";
import type {
  DistributionProvider,
  ProviderCatalogQuery,
  ProviderDeliveryStatus,
  ProviderReleasePayload,
  ProviderStatusResult,
  ProviderWebhookEvent,
} from "./types";
import { ProviderUnavailableError } from "./errors";

type Json = Record<string, unknown>;

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  const token = await loadDistributionAccessToken();
  if (!token) throw new ProviderUnavailableError("Distribution Engine authorization is unavailable.");
  const cfg = readDistributionOAuthConfig();
  const response = await fetch(`${cfg.apiBaseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) throw new ProviderUnavailableError(`Distribution Engine request failed (HTTP ${response.status}).`);
  if (response.status === 204) return null;
  return response.json();
}

function object(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Json : {};
}
function firstString(o: Json, keys: string[]): string | undefined {
  for (const k of keys) if (typeof o[k] === "string" && o[k]) return o[k] as string;
}
function releaseId(value: unknown): string {
  const o=object(value); const nested=object(o.data);
  const id=firstString(o,["id","release_id","releaseId"]) ?? firstString(nested,["id","release_id","releaseId"]);
  if (!id) throw new ProviderUnavailableError("Distribution Engine did not return a release identifier.");
  return id;
}

/**
 * Private upstream adapter. Provider identity is intentionally not exposed.
 * Endpoint paths are limited to documented resource routes. Payload mapping
 * remains conservative; unsupported operations fail closed.
 */
export class DistributionEngineProvider implements DistributionProvider {
  readonly name = "distribution_engine";
  readonly connected = true;

  async submitRelease(input: ProviderReleasePayload) {
    const payload = {
      title: input.title,
      release_type: input.type,
      primary_artist_name: input.primaryArtistName,
      upc: input.upc ?? undefined,
      release_date: input.releaseDate ?? undefined,
      territories: input.territories,
      tracks: input.tracks.map(t => ({
        track_number: t.trackNumber,
        title: t.title,
        isrc: t.isrc ?? undefined,
      })),
    };
    const data = await request("/releases", { method: "POST", body: JSON.stringify(payload) });
    return { providerReleaseId: releaseId(data) };
  }

  async updateRelease(providerReleaseId: string, input: Partial<ProviderReleasePayload>) {
    await request(`/releases/${encodeURIComponent(providerReleaseId)}`, { method: "PATCH", body: JSON.stringify(input) });
  }

  async requestTakedown(): Promise<void> {
    throw new ProviderUnavailableError("Takedown delivery is not enabled until the upstream takedown endpoint is verified.");
  }
  async reinstateRelease(): Promise<void> {
    throw new ProviderUnavailableError("Reinstatement is not enabled until the upstream endpoint is verified.");
  }

  async getReleaseStatus(providerReleaseId: string): Promise<ProviderStatusResult> {
    const data=object(await request(`/releases/${encodeURIComponent(providerReleaseId)}`));
    const status=firstString(data,["status","release_status"]) ?? "unknown";
    return { providerReleaseId, status, updatedAt: new Date().toISOString() };
  }

  async getDeliveryStatus(providerReleaseId: string): Promise<ProviderDeliveryStatus> {
    const s=await this.getReleaseStatus(providerReleaseId);
    return { providerReleaseId, deliveryStatus:s.status, updatedAt:s.updatedAt };
  }

  async getCatalog(query: ProviderCatalogQuery) {
    const qs=new URLSearchParams();
    if(query.limit) qs.set("limit",String(query.limit));
    if(query.cursor) qs.set("cursor",query.cursor);
    const raw=object(await request(`/releases${qs.size ? `?${qs}` : ""}`));
    const items=Array.isArray(raw.data) ? raw.data : Array.isArray(raw.releases) ? raw.releases : [];
    return { items, nextCursor:firstString(raw,["next_cursor","nextCursor"]) };
  }

  async syncRelease(providerReleaseId: string) { return this.getReleaseStatus(providerReleaseId); }
  async handleWebhook(_event: ProviderWebhookEvent): Promise<void> {
    throw new ProviderUnavailableError("Distribution Engine webhooks are not enabled until signature verification is documented.");
  }
}
