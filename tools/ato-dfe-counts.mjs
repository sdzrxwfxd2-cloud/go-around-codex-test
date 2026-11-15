// Shared ATO/DFE counts for the main-page tiles.
// These are the same default rules as the ATO tab and the DFE tab:
//   ATO default = valid ATO and DTO (isDto: /DTO in the certificate, or paraglid/hang-glid in the name or courses)
//   DFE default = unique people after merging same-name rows, valid if any row is valid, hide "pexo test three cm person"
// The three Pexo test rows stay in the data; they are only hidden from the count, same as the DFE tab.
// Used by tools/wm-public-stats.mjs and tests. Do not hard-code the numbers.

export const HIDE_DFE = new Set(["pexo test three cm person"]);

export function isValidStatus(status) {
  return /^valid/i.test(String(status || ""));
}

export function isDto(a) {
  return /\/DTO/i.test(a.certificate_number || "") ||
    /paraglid|hang.?glid/i.test(String(a.name || "") + String(a.approved_courses || ""));
}

// Same merge as `const DF=...` in site/c/appdata/app-code.03838b9873.js
export function mergeDfes(dfes) {
  const C = {
    "gauteng": "Gauteng",
    "western cape": "Western Cape",
    "kwazulu-natal": "KwaZulu-Natal",
    "kwa-zulu natal": "KwaZulu-Natal",
    "kwazulu natal": "KwaZulu-Natal",
    "kwa zulu-natal": "KwaZulu-Natal",
    "free state": "Free State",
    "eastern cape": "Eastern Cape",
    "north west": "North West",
    "limpopo": "Limpopo",
    "mpumalanga": "Mpumalanga",
    "northern cape": "Northern Cape"
  };
  const M = new Map();
  for (const d0 of dfes) {
    const d = Object.assign({}, d0);
    d.province = C[String(d.province || "").trim().toLowerCase()] || "";
    const k = String(d.name || "").trim().toLowerCase();
    const m = M.get(k);
    if (!m) {
      d.desigs = [d.designation];
      M.set(k, d);
      continue;
    }
    m.desigs.push(d.designation);
    m.designation = m.desigs.join(" · ");
    if (isValidStatus(d.status) && !isValidStatus(m.status)) {
      m.status = d.status;
      m.expiry_date = d.expiry_date;
    }
    m.ratings = [...new Set((String(m.ratings || "") + ";" + String(d.ratings || "")).split(";").map((x) => x.trim()).filter(Boolean))].join("; ");
    m.email = m.email || d.email;
    m.cellphone = m.cellphone || d.cellphone;
    m.operator = m.operator || d.operator;
    if (!m.province) m.province = d.province;
  }
  return [...M.values()];
}

export function atoDfeCounts(atos, dfes) {
  const atoValid = atos.filter((a) => isValidStatus(a.status));
  // Tab default now includes DTOs, so the main tile and the tab share this count.
  const ato = atoValid.length;
  const atoAtoOnly = atoValid.filter((a) => !isDto(a)).length;
  const atoWithDto = atoValid.length;
  const atoAll = atos.length;

  const people = mergeDfes(dfes);
  const visible = people.filter((d) => !HIDE_DFE.has(String(d.name || "").trim().toLowerCase()));
  const dfe = visible.filter((d) => isValidStatus(d.status)).length;
  const dfeListed = visible.length;
  const dfeValidRows = dfes.filter((d) => isValidStatus(d.status)).length;
  const dfeAll = dfes.length;
  const pexoRows = dfes.filter((d) => HIDE_DFE.has(String(d.name || "").trim().toLowerCase())).length;

  return {
    ato,
    atoAtoOnly,
    atoWithDto,
    atoAll,
    dfe,
    dfeValidRows,
    dfeListed,
    dfeAll,
    pexoRows,
    atoSub: atoWithDto + " with DTOs · " + atoAll + " listed",
    dfeSub: dfeValidRows + " valid rows",
    atoSource: "Valid ATO and DTO records (same default as the ATO tab)",
    dfeSource: "Unique valid examiners, test person hidden (same default as the DFE tab)"
  };
}
