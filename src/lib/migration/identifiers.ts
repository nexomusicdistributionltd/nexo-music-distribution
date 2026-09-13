/**
 * ISRC / UPC preservation helpers.
 * Never invent identifiers — only normalize and validate existing ones.
 */

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/;
const UPC_RE = /^\d{12,14}$/;

export function normalizeIsrc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!cleaned) return null;
  return cleaned;
}

export function isValidIsrc(raw: string | null | undefined): boolean {
  const n = normalizeIsrc(raw);
  return Boolean(n && ISRC_RE.test(n));
}

export function normalizeUpc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) return null;
  return cleaned;
}

export function isValidUpc(raw: string | null | undefined): boolean {
  const n = normalizeUpc(raw);
  return Boolean(n && UPC_RE.test(n));
}

export type IdentifierPreservation = {
  isrc: string | null;
  upc: string | null;
  isrcPreserved: boolean;
  upcPreserved: boolean;
  warnings: string[];
};

/**
 * Preserve ISRC/UPC from an external source into a local draft.
 * Does not generate new codes.
 */
export function preserveIdentifiers(input: {
  externalIsrc?: string | null;
  externalUpc?: string | null;
  existingIsrc?: string | null;
  existingUpc?: string | null;
}): IdentifierPreservation {
  const warnings: string[] = [];
  const extIsrc = normalizeIsrc(input.externalIsrc);
  const extUpc = normalizeUpc(input.externalUpc);
  const existIsrc = normalizeIsrc(input.existingIsrc);
  const existUpc = normalizeUpc(input.existingUpc);

  let isrc: string | null = existIsrc;
  let upc: string | null = existUpc;
  let isrcPreserved = false;
  let upcPreserved = false;

  if (extIsrc) {
    if (!isValidIsrc(extIsrc)) {
      warnings.push("External ISRC failed validation and was not applied.");
    } else if (existIsrc && existIsrc !== extIsrc) {
      warnings.push("Existing ISRC kept; external ISRC differs (conflict).");
    } else {
      isrc = extIsrc;
      isrcPreserved = true;
    }
  }

  if (extUpc) {
    if (!isValidUpc(extUpc)) {
      warnings.push("External UPC failed validation and was not applied.");
    } else if (existUpc && existUpc !== extUpc) {
      warnings.push("Existing UPC kept; external UPC differs (conflict).");
    } else {
      upc = extUpc;
      upcPreserved = true;
    }
  }

  return { isrc, upc, isrcPreserved, upcPreserved, warnings };
}
