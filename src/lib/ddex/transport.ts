/**
 * DDEX transport adapter — stub only.
 * Never marks messages DELIVERED. No fake Spotify/Apple connections.
 */

export class DdexTransportNotConnectedError extends Error {
  readonly code = "DDEX_TRANSPORT_NOT_CONNECTED";
  constructor(message = "DDEX transport is not connected. Delivery is unavailable.") {
    super(message);
    this.name = "DdexTransportNotConnectedError";
  }
}

export type DdexDeliveryRequest = {
  messageId: string;
  filename: string;
  xml: string;
  recipientConfigKey: string;
};

export type DdexDeliveryResult = {
  delivered: false;
  reason: string;
};

export interface DdexTransportAdapter {
  readonly name: string;
  readonly connected: boolean;
  deliver(request: DdexDeliveryRequest): Promise<DdexDeliveryResult>;
}

export class NotConnectedDdexTransport implements DdexTransportAdapter {
  readonly name = "not_connected";
  readonly connected = false;

  async deliver(_request: DdexDeliveryRequest): Promise<DdexDeliveryResult> {
    void _request;
    throw new DdexTransportNotConnectedError();
  }
}

let cached: DdexTransportAdapter | null = null;

export function getDdexTransport(): DdexTransportAdapter {
  if (!cached) cached = new NotConnectedDdexTransport();
  return cached;
}

/** Test helper */
export function resetDdexTransport(): void {
  cached = null;
}
