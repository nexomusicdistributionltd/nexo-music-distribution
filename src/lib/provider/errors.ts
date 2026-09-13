export const PROVIDER_NOT_CONNECTED_CODE = "PROVIDER_NOT_CONNECTED";
export const PROVIDER_UNAVAILABLE_CODE = "PROVIDER_UNAVAILABLE";
export const PROVIDER_WEBHOOK_REJECTED_CODE = "PROVIDER_WEBHOOK_REJECTED";

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

export class ProviderUnavailableError extends Error {
  readonly code = PROVIDER_UNAVAILABLE_CODE;
  constructor(message = "Distribution provider is unavailable.") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderWebhookRejectedError extends Error {
  readonly code = PROVIDER_WEBHOOK_REJECTED_CODE;
  constructor(message = "Webhook rejected — signature invalid or secret missing.") {
    super(message);
    this.name = "ProviderWebhookRejectedError";
  }
}

export type ProviderErrorCode =
  | typeof PROVIDER_NOT_CONNECTED_CODE
  | typeof PROVIDER_UNAVAILABLE_CODE
  | typeof PROVIDER_WEBHOOK_REJECTED_CODE
  | string;

export function toProviderErrorPayload(err: unknown): {
  code: ProviderErrorCode;
  message: string;
} {
  if (err instanceof ProviderNotConnectedError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof ProviderUnavailableError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof ProviderWebhookRejectedError) {
    return { code: err.code, message: err.message };
  }
  if (err instanceof Error) {
    return { code: "PROVIDER_ERROR", message: err.message };
  }
  return { code: "PROVIDER_ERROR", message: "Unknown provider error" };
}
