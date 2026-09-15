export type ParentalWarningType =
  | "Explicit"
  | "ExplicitContentEdited"
  | "NotExplicit"
  | "NoAdviceAvailable"
  | "Unknown";

export function parentalWarningFromExplicit(
  explicit: boolean | null | undefined
): ParentalWarningType {
  if (explicit === true) return "Explicit";
  if (explicit === false) return "NotExplicit";
  return "Unknown";
}
