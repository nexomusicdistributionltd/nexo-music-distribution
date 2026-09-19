import "server-only";

import { ProviderNotConnectedError } from "./errors";
import { isDistributionProviderConfigured } from "./config";
import type {
  DistributionProvider,
  ProviderCatalogQuery,
  ProviderDeliveryStatus,
  ProviderReleasePayload,
  ProviderStatusResult,
  ProviderWebhookEvent,
} from "./types";

/**
 * Default adapter when no distribution provider credentials/config exist.
 * Throws / returns clear not-connected — never fabricates delivery success.
 */
export class NotConnectedProvider implements DistributionProvider {
  readonly name = "not_connected";
  readonly connected = false;

  private fail(): never {
    throw new ProviderNotConnectedError();
  }

  async prepareRelease(input: ProviderReleasePayload): Promise<{ providerReleaseId: string }> {
    void input;
    this.fail();
  }

  async submitRelease(input: ProviderReleasePayload): Promise<{ providerReleaseId: string }> {
    void input;
    this.fail();
  }

  async updateRelease(
    providerReleaseId: string,
    input: Partial<ProviderReleasePayload>
  ): Promise<void> {
    void providerReleaseId;
    void input;
    this.fail();
  }

  async requestTakedown(providerReleaseId: string, reason?: string): Promise<void> {
    void providerReleaseId;
    void reason;
    this.fail();
  }

  async reinstateRelease(providerReleaseId: string, reason?: string): Promise<void> {
    void providerReleaseId;
    void reason;
    this.fail();
  }

  async getReleaseStatus(providerReleaseId: string): Promise<ProviderStatusResult> {
    void providerReleaseId;
    this.fail();
  }

  async getDeliveryStatus(providerReleaseId: string): Promise<ProviderDeliveryStatus> {
    void providerReleaseId;
    this.fail();
  }

  async getCatalog(
    query: ProviderCatalogQuery
  ): Promise<{ items: unknown[]; nextCursor?: string }> {
    void query;
    this.fail();
  }

  async syncRelease(providerReleaseId: string): Promise<ProviderStatusResult> {
    void providerReleaseId;
    this.fail();
  }

  async handleWebhook(event: ProviderWebhookEvent): Promise<void> {
    void event;
    this.fail();
  }
}

export function isProviderConnected(): boolean {
  return isDistributionProviderConfigured();
}
