// Canonicalization preserves units; it does not convert between unit systems.
export function normalizeMeasurementText(value) {
  return String(value ?? "").toLowerCase()
    .replace(/&quot;|&#34;|&#x22;/gi, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/[−–—]/g, "-")
    .replace(/(\d)\s*["“”″]/g, "$1 in")
    .replace(/(\d)\s*['‘’′]/g, "$1 ft")
    .replace(/\b(?:inches|inch)\b/g, "in")
    .replace(/\b(?:feet|foot)\b/g, "ft")
    .replace(/\bmillimet(?:er|re)s?\b/g, "mm")
    .replace(/\bcentimet(?:er|re)s?\b/g, "cm")
    .replace(/\bmet(?:er|re)s?\b/g, "m")
    .replace(/\bmm\/yr\b/g, "mm/year")
    .replace(/\s+/g, " ").trim();
}

export function extractMeasurementClaims(value, { includeBare = false } = {}) {
  const text = normalizeMeasurementText(value);
  const pattern = /(?<![a-z0-9.+-])([+\-]?\d+(?:\.\d+)?)(?!\d|\.\d)(?:\s*(mm\/year|mm|cm|mpa|psi|bar|ft|in|m|%|years?|months?|days?)(?![a-z]))?/g;
  return [...text.matchAll(pattern)].filter((match) => includeBare || match[2]).map((match) => ({
    numeric: String(Number(match[1])), unit: match[2] ?? "", index: match.index,
    expected: `${Number(match[1])}${match[2] ? ` ${match[2]}` : ""}`,
  }));
}

export function evidenceTextWithUnits(value) {
  if (Array.isArray(value)) return value.map(evidenceTextWithUnits).join("\n");
  if (value && typeof value === "object") return Object.entries(value).map(([key, item]) => {
    const unit = key.match(/(?:^|[a-z])(Mm|Cm|M|Ft|In)$/)?.[1]?.toLowerCase()
      ?? (/^(?:value|reading|measurement|thickness)(?:\d+)?$/i.test(key) ? value.unitCode ?? value.unit_code ?? value.unit : null);
    return `${key}: ${evidenceTextWithUnits(item)}${unit && typeof item === "number" ? ` ${unit}` : ""}`;
  }).join("\n");
  return String(value ?? "");
}
