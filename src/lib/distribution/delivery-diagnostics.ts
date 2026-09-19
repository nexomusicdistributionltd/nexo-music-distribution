export type DeliveryFailureDiagnosis = {
  summary: string;
  stage: string;
  field?: string;
  reason: string;
  fix: string;
  where: string;
  owner: "admin" | "artist_or_label" | "system";
  nextAction: string;
};

function includesAny(value: string, needles: string[]) {
  return needles.some((needle) => value.includes(needle));
}

function extractStage(message: string): string {
  const match = message.match(/failed at ([^(]+?)(?:\s*\(HTTP|:|\.|$)/i);
  return match?.[1]?.trim() || "delivery";
}

function trackLabel(message: string): string {
  const match = message.match(/track\s+(\d+)/i);
  return match ? `Track ${match[1]}` : "Affected track";
}

function extractProviderField(message: string): string | undefined {
  const afterStatus = message.split(/\(HTTP\s+\d+\)\s*:\s*/i)[1] ?? message;
  const match = afterStatus.match(
    /(?:^|;\s*)([a-zA-Z][a-zA-Z0-9_.\[\]-]{1,100})\s*:\s*[^;]+/
  );
  return match?.[1]?.replace(/^data\./i, "");
}

export function diagnoseDeliveryFailure(message: string): DeliveryFailureDiagnosis {
  const raw = message.trim() || "Unknown delivery failure.";
  const lower = raw.toLowerCase();
  const stage = extractStage(raw);

  if (
    includesAny(lower, [
      "authorization is unavailable",
      "authorization required",
      "not connected",
      "http 401",
      "http 403",
      "scope",
    ])
  ) {
    return {
      summary: "Distribution authorization needs attention",
      stage,
      reason: raw,
      fix: "Reconnect or refresh the TooLost authorization and confirm the required distribution scopes are granted.",
      where: "Admin → Distribution Engine → Provider authorization",
      owner: "admin",
      nextAction: "Fix the provider connection first, then retry Nexo delivery. Do not return the release to the artist for this.",
    };
  }

  if (includesAny(lower, ["license type", "licensetype", "creative commons", "selected license"])) {
    return {
      summary: "Licensing metadata was rejected",
      stage,
      field: "License type",
      reason: raw,
      fix: "Correct the release licensing selection. Use Copyright for standard copyrighted music, or Creative Commons only when the release is genuinely licensed that way.",
      where: "Release → Distribution / rights settings → License type",
      owner: "admin",
      nextAction: "Save the corrected licensing metadata, then retry Nexo delivery.",
    };
  }

  if (
    includesAny(lower, [
      "delivery target has been disabled for this release",
      "please enter the store or additional store",
      "tiktokstarttime does not match the format",
    ])
  ) {
    return {
      summary: "Internal delivery routing needs attention",
      stage,
      field: "Delivery routing",
      reason: raw,
      fix: "Keep the artist metadata unchanged unless it is independently wrong. Adjust the incompatible store/additional-delivery target or Nexo provider formatting internally.",
      where: "Admin → Distribution Engine / release delivery settings",
      owner: "system",
      nextAction: "Fix the internal delivery target or provider payload, then retry distribution. Do not return the release to the artist or label for this error.",
    };
  }

  if (includesAny(lower, ["language", "locale"])) {
    return {
      summary: "Language metadata was rejected",
      stage,
      field: "Language",
      reason: raw,
      fix: "Choose a valid release/track language from Nexo's supported language list. Remove free-text misspellings, trailing spaces, or unsupported language names.",
      where: "Admin release page → Admin metadata editor → Language; or artist/label release editor → Release details → Language",
      owner: "artist_or_label",
      nextAction: "Correct the language field, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["time zone", "timezone"])) {
    return {
      summary: "Release timezone is invalid",
      stage,
      field: "Time zone",
      reason: raw,
      fix: "Select a valid timezone for the release time. Do not use city-only values such as “Chicago”; use the timezone option provided by Nexo.",
      where: "Artist/label release editor → Release details / scheduling → Time zone",
      owner: "artist_or_label",
      nextAction: "Correct the timezone, save the release, then retry delivery.",
    };
  }

  if (includesAny(lower, ["release time", "hh:mm"])) {
    return {
      summary: "Release time is invalid",
      stage,
      field: "Release time",
      reason: raw,
      fix: "Set the release time using a valid 24-hour HH:MM value.",
      where: "Artist/label release editor → Release details / scheduling → Release time",
      owner: "artist_or_label",
      nextAction: "Correct the release time, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["pre-order", "preorder"])) {
    return {
      summary: "Apple Music pre-order settings are incomplete",
      stage,
      field: "Apple Music pre-order",
      reason: raw,
      fix: "Either add a valid Apple Music pre-order date or turn Apple Music pre-order off.",
      where: "Artist/label release editor → Delivery settings → Apple Music pre-order",
      owner: "artist_or_label",
      nextAction: "Correct the pre-order settings, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["upc", "ean", "barcode"])) {
    return {
      summary: "Release identifier was rejected",
      stage,
      field: "UPC / EAN",
      reason: raw,
      fix: "Check the UPC/EAN for invalid length, format, checksum, or a duplicate already assigned to another release. If Nexo/provider assignment is intended, leave the optional UPC field blank.",
      where: "Admin release page → Admin metadata editor → UPC; or artist/label release editor → Release details → UPC",
      owner: "artist_or_label",
      nextAction: "Correct or remove the invalid UPC, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["isrc"])) {
    return {
      summary: "Track ISRC was rejected",
      stage,
      field: "ISRC",
      reason: raw,
      fix: "Check the affected track's ISRC for invalid format or duplication. If an ISRC is not already owned for this recording, leave the optional ISRC field blank.",
      where: `${trackLabel(raw)} → Track metadata → ISRC`,
      owner: "artist_or_label",
      nextAction: "Correct or remove the invalid ISRC, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["composer", "songwriter", "lyricist", "writer"])) {
    return {
      summary: "Composition credits are incomplete or invalid",
      stage,
      field: "Songwriter / Composer",
      reason: raw,
      fix: "Add at least one valid songwriter or composer for the affected music track. Make sure contributor names and roles are accurate.",
      where: `${trackLabel(raw)} → Contributors → Songwriter / Composer`,
      owner: "artist_or_label",
      nextAction: "Correct the track contributors, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["participant", "primary artist", "featured artist", "artist role", "artistid"])) {
    return {
      summary: "Artist/contributor metadata was rejected",
      stage,
      field: "Artist / contributor roles",
      reason: raw,
      fix: "Verify the primary artist, featured artists, and contributor roles. The primary artist must be present and correctly linked; unsupported or incorrect roles must be corrected.",
      where: "Release → Artist details / Contributors",
      owner: "artist_or_label",
      nextAction: "Correct the artist/contributor metadata, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["flac", "audio", "sample rate", "bit depth", "codec"])) {
    return {
      summary: "Audio delivery file was rejected",
      stage,
      field: "Track audio",
      reason: raw,
      fix: "Replace the affected audio with a valid lossless FLAC master that meets Nexo's technical delivery requirements.",
      where: `${trackLabel(raw)} → Audio upload`,
      owner: "artist_or_label",
      nextAction: "Upload the corrected FLAC file, save/resubmit if required, then retry delivery.",
    };
  }

  if (includesAny(lower, ["artwork", "cover", "image", "3000", "1400"])) {
    return {
      summary: "Cover artwork was rejected",
      stage,
      field: "Cover artwork",
      reason: raw,
      fix: "Replace the artwork with a valid square release cover that meets the required dimensions and file format.",
      where: "Release → Artwork",
      owner: "artist_or_label",
      nextAction: "Upload corrected artwork, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["territor", "country", "worldwide"])) {
    return {
      summary: "Territory settings were rejected",
      stage,
      field: "Territories",
      reason: raw,
      fix: "Review the selected release territories and remove invalid or unsupported territory values.",
      where: "Admin release page → Admin metadata editor → Territories; or artist/label release editor → Delivery settings → Territories",
      owner: "artist_or_label",
      nextAction: "Correct the territories, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["genre", "subgenre"])) {
    return {
      summary: "Genre metadata was rejected",
      stage,
      field: "Genre / Subgenre",
      reason: raw,
      fix: "Choose a genre/subgenre from the supported Nexo provider list instead of unsupported free text.",
      where: "Admin release page → Admin metadata editor → Genre / Subgenre; or artist/label release editor → Release details",
      owner: "artist_or_label",
      nextAction: "Correct the genre fields, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["release date", "original release date", "date is invalid", "date must"])) {
    return {
      summary: "Release date metadata was rejected",
      stage,
      field: "Release date",
      reason: raw,
      fix: "Check the release date and original release date for a valid date and provider-allowed schedule.",
      where: "Admin release page → Admin metadata editor → Release date / Original release date",
      owner: "artist_or_label",
      nextAction: "Correct the date, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["title", "version", "subtitle"])) {
    return {
      summary: "Title/version metadata was rejected",
      stage,
      field: "Title / Version",
      reason: raw,
      fix: "Review the release or track title/version for invalid formatting, unsupported text, or a missing required title.",
      where: "Release details → Title / Version, or affected track → Track title / Version",
      owner: "artist_or_label",
      nextAction: "Correct the title/version metadata, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["delivery settings", "platform", "store", "service"])) {
    return {
      summary: "Delivery settings were rejected",
      stage,
      field: "Delivery settings",
      reason: raw,
      fix: "Review store/platform selections and additional delivery options for an unsupported or incomplete setting.",
      where: "Artist/label release editor → Delivery settings / Additional deliveries",
      owner: "artist_or_label",
      nextAction: "Correct the delivery options, save, then retry delivery.",
    };
  }

  if (includesAny(lower, ["http 429", "too many requests", "rate limit", "quota"])) {
    return {
      summary: "Provider rate limit blocked this attempt",
      stage,
      reason: raw,
      fix: "No release metadata change is required. The provider temporarily refused the request because of rate or quota limits.",
      where: "Admin → Distribution Engine",
      owner: "system",
      nextAction: "Retry after the provider limit clears. Do not return the release to the artist.",
    };
  }

  if (/(http\s+5\d\d|temporarily unavailable|timeout|timed out|network|fetch failed)/i.test(raw)) {
    return {
      summary: "Provider service failure",
      stage,
      reason: raw,
      fix: "No artist metadata change is indicated. The provider or network failed during this delivery stage.",
      where: "Admin → Distribution Engine",
      owner: "system",
      nextAction: "Retry delivery after the provider service recovers. Do not return the release to the artist unless a later validation error identifies a release field.",
    };
  }

  return {
    summary: "Delivery failed and needs review",
    stage,
    field: extractProviderField(raw),
    reason: raw,
    fix: "Use the provider reason above to identify the rejected field. If it names release metadata, correct it in the Admin metadata editor. If it names a track, contributor, audio file, artwork, or delivery option, return the release for that specific correction.",
    where: "Admin release page → Delivery needs attention and the matching release/track section",
    owner: "admin",
    nextAction: "Correct the named issue first, then retry delivery. Do not retry repeatedly without changing the rejected value.",
  };
}


export function formatDeliveryCorrection(message: string): string {
  const diagnosis = diagnoseDeliveryFailure(message);
  return [
    diagnosis.summary,
    diagnosis.field ? `Affected field: ${diagnosis.field}` : "",
    `Why it failed: ${diagnosis.reason}`,
    `What to fix: ${diagnosis.fix}`,
    `Where to fix it: ${diagnosis.where}`,
  ]
    .filter(Boolean)
    .join("\n");
}
