/** Keep only documented field names and value types, never customer values. */
const fields = new Set(`data message errors currentPage perPage totalItems totalPages date total id title upc isrc dividends coverUrl coverUrlMedium coverUrlSmall period dateRange from to totalStreams totalSaves totalSkips engagement chart track release order type status releaseDate platforms filters platform supportsOverview supportsTotalStreams additionalTypes streamsTotal tracksTotal countryTotal artist artists label name artistName releaseCount social additional stores territories defaultRoles code logo logoDark logoDefault language primaryGenre secondaryGenre profileImg about clicks songPreviews clicksToService uniqueUsers link shortId`.split(' '));
export function responseShape(value: unknown, depth = 0): unknown {
  if (value === null) return { type: 'null', note: 'No non-null schema observed' };
  if (depth >= 8) return { type: 'truncated' };
  if (Array.isArray(value)) return {
    type: 'array',
    samples: value.slice(0, 3).map(item => responseShape(item, depth + 1)),
    note: value.length ? 'At most three observed items; not a complete schema' : 'Empty array; item schema unknown',
  };
  if (typeof value === 'object') return {
    type: 'object',
    properties: Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => fields.has(key)).slice(0, 80)
      .map(([key, item]) => [key, responseShape(item, depth + 1)])),
    omittedFields: Object.keys(value).filter(key => !fields.has(key)).length,
  };
  return { type: typeof value };
}
