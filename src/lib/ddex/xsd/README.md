# Official DDEX ERN 4.3.2 schemas (server-side)

Obtained from DDEX published XSD endpoints (HTTP 302 → service.ddex.net):

- `http://ddex.net/xml/ern/432/release-notification.xsd`
- `http://ddex.net/xml/allowed-value-sets/allowed-value-sets_009.xsd` (AvsVersionId=9)

The live `allowed-value-sets.xsd` endpoint currently publishes a newer AVS (not v9).
Production ERN 4.3.2 output uses **AvsVersionId=9**, so this directory stores the official
`allowed-value-sets_009.xsd` as `allowed-value-sets.xsd`.

`release-notification.xsd` is the official ERN 4.3.2 schema. The only local edit is the
`xs:import` `schemaLocation`, changed from the online AVS URL to `allowed-value-sets.xsd`
so offline XSD validation uses AVS v9 (DDEX documented practice for local validation).

Do not substitute ern/431 schemas. Do not invent approximate schema.
