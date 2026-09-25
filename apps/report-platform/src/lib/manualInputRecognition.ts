import type { MissingField, ReportSection, WorkspaceReport } from "../domain/types";

type ManualFieldRule = {
  fieldId: string;
  labels: string[];
};

export type DraftManualInputCandidate = {
  fieldId: string;
  value: string;
};

const MANUAL_FIELD_RULES: ManualFieldRule[] = [
  {
    fieldId: "recommendationOwner",
    labels: ["Recommendation owner", "Recommendation coordination owner"],
  },
  { fieldId: "checkedBy", labels: ["Checked by"] },
  { fieldId: "clientRepresentative", labels: ["Client representative"] },
  { fieldId: "yearBuilt", labels: ["Year built"] },
  { fieldId: "legendNote", labels: ["Legend note"] },
  {
    fieldId: "certificationNumber",
    labels: ["Certification number", "Certification / qualification reference"],
  },
];

const UNCONFIRMED_VALUE_PATTERN = /^(?:pending(?: confirmation)?|not (?:available|confirmed|provided|recorded)|unknown|tbc|n\/?a|none)$/i;

export function extractDraftManualInputCandidates(content: string): DraftManualInputCandidate[] {
  const lines = reportHtmlToLines(content);
  const candidates = new Map<string, string>();

  for (const rule of MANUAL_FIELD_RULES) {
    for (const line of lines) {
      const value = extractRuleValue(line, rule);
      if (!value || UNCONFIRMED_VALUE_PATTERN.test(value)) continue;
      candidates.set(rule.fieldId, value);
      break;
    }
  }

  return Array.from(candidates, ([fieldId, value]) => ({ fieldId, value }));
}

export function applyConfirmedDraftManualInputs(
  report: WorkspaceReport,
  sourceSection: ReportSection,
): {
  report: WorkspaceReport;
  section: ReportSection;
  confirmed: DraftManualInputCandidate[];
} {
  const candidates = new Map(
    extractDraftManualInputCandidates(sourceSection.content).map((candidate) => [candidate.fieldId, candidate.value]),
  );
  const confirmed = new Map<string, string>();
  const sections = report.sections.map((section) => {
    const baseSection = section.id === sourceSection.id ? sourceSection : section;
    const missingFields = baseSection.missingFields.map((field) => {
      if (field.value.trim()) return field;
      const value = candidates.get(field.id);
      if (!value) return field;
      confirmed.set(field.id, value);
      return { ...field, value };
    });
    return { ...baseSection, missingFields };
  });
  const nextReport = { ...report, sections };
  const section = sections.find((candidate) => candidate.id === sourceSection.id) ?? sourceSection;

  return {
    report: nextReport,
    section,
    confirmed: Array.from(confirmed, ([fieldId, value]) => ({ fieldId, value })),
  };
}

export function addDraftSuggestionsToMissingFields(
  fields: MissingField[],
  content: string,
): MissingField[] {
  const candidates = new Map(
    extractDraftManualInputCandidates(content).map((candidate) => [candidate.fieldId, candidate.value]),
  );

  return fields.map((field) => {
    if (field.value.trim()) return field;
    const detectedDraftValue = candidates.get(field.id);
    return detectedDraftValue
      ? { ...field, detectedDraftValue, suggestion: detectedDraftValue }
      : field;
  });
}

function reportHtmlToLines(content: string): string[] {
  if (!content.trim()) return [];

  const htmlWithLineBreaks = content
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|section|tr|td|th)>/gi, "\n");
  const document = new DOMParser().parseFromString(htmlWithLineBreaks, "text/html");

  return (document.body.textContent ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\u2022\u27a2\-]+/, "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractRuleValue(line: string, rule: ManualFieldRule): string | null {
  for (const label of rule.labels) {
    const pattern = new RegExp(`^${escapeRegExp(label)}\\s*:\\s*(.+)$`, "i");
    const match = line.match(pattern);
    const value = match?.[1]
      ?.replace(/[.;,]+$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (value && value.length <= 200) return value;
  }
  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
