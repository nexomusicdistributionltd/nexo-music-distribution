import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { AVS_VERSION_ID, ERN_NAMESPACE } from "./constants";
import type { DdexValidationResult } from "./types";

export function officialSchemaDir(): string {
  return path.join(process.cwd(), "src/lib/ddex/xsd");
}

export function officialSchemaPaths() {
  const dir = officialSchemaDir();
  return {
    releaseNotification: path.join(dir, "release-notification.xsd"),
    allowedValueSets: path.join(dir, "allowed-value-sets.xsd"),
  };
}

function namespaceGate(xml: string): string | null {
  if (xml.includes("http://ddex.net/xml/ern/431")) {
    return "Rejected: ern/431 is not allowed for production output.";
  }
  if (/AvsVersionId="7"/.test(xml)) {
    return "Rejected: AvsVersionId=7 is not allowed for production output.";
  }
  if (!xml.includes(ERN_NAMESPACE)) {
    return "Rejected: missing namespace http://ddex.net/xml/ern/432.";
  }
  if (!xml.includes(`AvsVersionId="${AVS_VERSION_ID}"`)) {
    return "Rejected: AvsVersionId must be 9.";
  }
  return null;
}

/**
 * Validate ERN XML against the official bundled XSD (libxml2 xmllint).
 * Primary conformance tests must call this — do not mock it.
 */
export function validateErnXml(xml: string): DdexValidationResult {
  const gated = namespaceGate(xml);
  if (gated) return { ok: false, errors: [gated] };

  const paths = officialSchemaPaths();
  if (!existsSync(paths.releaseNotification) || !existsSync(paths.allowedValueSets)) {
    return {
      ok: false,
      errors: ["Official ERN 4.3.2 XSD files are missing from src/lib/ddex/xsd."],
    };
  }

  const dir = mkdtempSync(path.join(tmpdir(), "nexo-ern-"));
  try {
    const xmlPath = path.join(dir, "message.xml");
    writeFileSync(xmlPath, xml, "utf8");
    const result = spawnSync(
      "xmllint",
      ["--noout", "--schema", paths.releaseNotification, xmlPath],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 }
    );
    if (result.error && (result.error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        ok: false,
        errors: ["xmllint is not available; cannot XSD-validate. Message not marked VALID."],
      };
    }
    if (result.status === 0) return { ok: true, errors: [] };
    const msg = `${result.stderr ?? ""}\n${result.stdout ?? ""}`.trim();
    return { ok: false, errors: [msg || `xmllint exited ${result.status}`] };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
