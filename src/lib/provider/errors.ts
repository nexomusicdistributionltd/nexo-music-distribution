export const PROVIDER_NOT_CONNECTED_CODE = "PROVIDER_NOT_CONNECTED";

export function providerNotConnectedMessage() {
  return "Not connected — distribution provider is not configured. Delivery, live status, and provider sync are unavailable.";
}

export class ProviderNotConnectedError extends Error {
  readonly code = PROVIDER_NOT_CONNECTED_CODE;
  constructor(message = "Distribution provider is not connected.") {
    super(message);
    this.name = "ProviderNotConnectedError";
  }
}
