/**
 * Territory validation against DDEX AVS CurrentTerritoryCode (ISO 3166-1 alpha-2 + Worldwide).
 * Catalog "WW" maps to Worldwide. Invalid codes fail readiness / generation.
 */

const ISO_ALPHA2 = new Set([
  "AD","AE","AF","AG","AI","AL","AM","AN","AO","AQ","AR","AS","AT","AU","AW","AX","AZ",
  "BA","BB","BD","BE","BF","BG","BH","BI","BJ","BL","BM","BN","BO","BQ","BR","BS","BT","BV","BW","BY","BZ",
  "CA","CC","CD","CF","CG","CH","CI","CK","CL","CM","CN","CO","CR","CS","CU","CV","CW","CX","CY","CZ",
  "DE","DJ","DK","DM","DO","DZ","EC","EE","EG","EH","ER","ES","ET","FI","FJ","FK","FM","FO","FR",
  "GA","GB","GD","GE","GF","GG","GH","GI","GL","GM","GN","GP","GQ","GR","GS","GT","GU","GW","GY",
  "HK","HM","HN","HR","HT","HU","ID","IE","IL","IM","IN","IO","IQ","IR","IS","IT","JE","JM","JO","JP",
  "KE","KG","KH","KI","KM","KN","KP","KR","KW","KY","KZ","LA","LB","LC","LI","LK","LR","LS","LT","LU","LV","LY",
  "MA","MC","MD","ME","MF","MG","MH","MK","ML","MM","MN","MO","MP","MQ","MR","MS","MT","MU","MV","MW","MX","MY","MZ",
  "NA","NC","NE","NF","NG","NI","NL","NO","NP","NR","NU","NZ","OM","PA","PE","PF","PG","PH","PK","PL","PM","PN","PR","PS","PT","PW","PY",
  "QA","RE","RO","RS","RU","RW","SA","SB","SC","SD","SE","SG","SH","SI","SJ","SK","SL","SM","SN","SO","SR","SS","ST","SV","SX","SY","SZ",
  "TC","TD","TF","TG","TH","TJ","TK","TL","TM","TN","TO","TR","TT","TV","TW","TZ","UA","UG","UM","US","UY","UZ",
  "VA","VC","VE","VG","VI","VN","VU","WF","WS","XK","YE","YT","ZA","ZM","ZW",
]);

export function mapTerritoryToAvs(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t) return null;
  const upper = t.toUpperCase();
  if (upper === "WW" || upper === "WORLDWIDE") return "Worldwide";
  if (ISO_ALPHA2.has(upper)) return upper;
  return null;
}

export function validateTerritories(codes: string[] | null | undefined): {
  ok: boolean;
  mapped: string[];
  invalid: string[];
} {
  const mapped: string[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  for (const code of codes ?? []) {
    const avs = mapTerritoryToAvs(code);
    if (!avs) {
      invalid.push(code);
      continue;
    }
    if (!seen.has(avs)) {
      seen.add(avs);
      mapped.push(avs);
    }
  }
  return { ok: invalid.length === 0 && mapped.length > 0, mapped, invalid };
}
