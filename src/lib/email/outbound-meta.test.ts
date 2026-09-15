import { describe, expect, it } from "vitest";
import {
  outboundToListItem,
  templateVarsFromPayload,
  type OutboundEventRow,
} from "./outbound-meta";

const base: OutboundEventRow = {
  id: "evt-1",
  to_email: "owner@nexo.test",
  template_key: "NEWSLETTER",
  payload: {
    FIRST_NAME: "Ada",
    _event_type: "newsletter",
    _recipient_user_id: "user-1",
    _idempotency_key: "MANUAL_SEND:c:user-1",
    _related_release_id: "rel-9",
    _attempt_count: 2,
  },
  status: "queued",
  provider: null,
  provider_message_id: null,
  error: null,
  related_entity_type: "email_campaign",
  related_entity_id: "camp-1",
  created_at: "2026-09-15T00:00:00.000Z",
  updated_at: "2026-09-15T00:00:00.000Z",
};

describe("outboundToListItem", () => {
  it("projects payload meta onto the admin outbox columns", () => {
    const item = outboundToListItem(base);
    expect(item.event_type).toBe("newsletter");
    expect(item.recipient_email).toBe("owner@nexo.test");
    expect(item.recipient_user_id).toBe("user-1");
    expect(item.related_release_id).toBe("rel-9");
    expect(item.status).toBe("queued");
    expect(item.sent_at).toBeNull();
    expect(item.attempt_count).toBe(2);
  });

  it("uses related_entity_id as release id when entity type is release", () => {
    const item = outboundToListItem({
      ...base,
      related_entity_type: "release",
      related_entity_id: "rel-live",
    });
    expect(item.related_release_id).toBe("rel-live");
  });

  it("sets sent_at from updated_at only when status is sent", () => {
    const item = outboundToListItem({
      ...base,
      status: "sent",
      provider: "resend",
      provider_message_id: "msg_1",
      updated_at: "2026-09-15T01:00:00.000Z",
    });
    expect(item.sent_at).toBe("2026-09-15T01:00:00.000Z");
  });
});

describe("templateVarsFromPayload", () => {
  it("strips underscore meta so HTML does not render outbox keys", () => {
    const vars = templateVarsFromPayload(base.payload ?? {});
    expect(vars.FIRST_NAME).toBe("Ada");
    expect(vars._event_type).toBeUndefined();
    expect(vars._idempotency_key).toBeUndefined();
  });
});
