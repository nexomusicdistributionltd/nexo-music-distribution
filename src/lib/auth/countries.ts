export type CountryOption = { code: string; name: string };

const ISO_ALPHA2_CODES = `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW
`.trim().split(/\s+/);

const displayNames =
  typeof Intl !== "undefined" && typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

export const COUNTRY_OPTIONS: readonly CountryOption[] = ISO_ALPHA2_CODES
  .map((code) => ({
    code,
    name: displayNames?.of(code) || code,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

export function countryFlag(code: string): string {
  const upper = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🌐";
  return String.fromCodePoint(
    ...[...upper].map((char) => 127397 + char.charCodeAt(0))
  );
}

export function countryLabel(country: CountryOption): string {
  return `${countryFlag(country.code)} ${country.name}`;
}

/** Backward-compatible names used by existing registration/profile selects. */
export const COUNTRIES = COUNTRY_OPTIONS.map((country) => country.name);

export function countryCodeForName(name: string): string | null {
  return COUNTRY_OPTIONS.find((country) => country.name === name)?.code ?? null;
}

export function countryNameForCode(code: string): string | null {
  const upper = code.trim().toUpperCase();
  return COUNTRY_OPTIONS.find((country) => country.code === upper)?.name ?? null;
}
