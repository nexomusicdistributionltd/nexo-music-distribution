/** ISO-8601 duration (xs:duration) from milliseconds. Never invents duration. */

export function msToIsoDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) {
    throw new Error("Duration is missing or invalid.");
  }
  const totalSeconds = ms / 1000;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds - hours * 3600 - minutes * 60;
  let out = "PT";
  if (hours > 0) out += `${hours}H`;
  if (minutes > 0) out += `${minutes}M`;
  const sec =
    Math.abs(seconds - Math.round(seconds)) < 1e-9
      ? String(Math.round(seconds))
      : seconds.toFixed(3).replace(/\.?0+$/, "");
  out += `${sec}S`;
  return out;
}

export function sumDurationsIso(msList: number[]): string {
  return msToIsoDuration(msList.reduce((a, b) => a + b, 0));
}
