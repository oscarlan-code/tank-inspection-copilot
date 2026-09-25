import type { ReportSection } from "./types";

export type ApiStandardTocSection = {
  id: string;
  number: string;
  title: string;
  shortLabel: string;
  pageStart: number;
  kind: ReportSection["kind"];
  layoutSurface?: "shell" | "roof" | "floor";
};

export const API_STANDARD_PRIMARY_REPORT = {
  reference: "API653-VERTICAL-AST-TEMPLATE",
  sourceReportName: "API 653 Vertical AST Internal / External Report Template",
  title: "API 653 Internal & External Inspection Report",
  inspectedDate: "Inspection date from LAIQ app export",
  reportFamily: "api653-internal-external",
};

export const API_STANDARD_REPORT_TOC: ApiStandardTocSection[] = [
  { id: "scope-of-inspection", number: "1", title: "Scope of Inspection", shortLabel: "Scope", pageStart: 5, kind: "narrative" },
  { id: "inspection-maintenance-regime", number: "2", title: "Inspection and Maintenance Regime", shortLabel: "Regime", pageStart: 6, kind: "narrative" },
  { id: "general-tank-information", number: "3", title: "General Tank Information", shortLabel: "Tank Info", pageStart: 7, kind: "structured" },
  { id: "inspection-report", number: "4", title: "Inspection Report", shortLabel: "Inspection", pageStart: 8, kind: "narrative" },
  { id: "repair-recommendations", number: "5", title: "Repair Recommendations / API 653 Assessment", shortLabel: "Repairs", pageStart: 17, kind: "narrative" },
  { id: "test-information", number: "6", title: "Test Information", shortLabel: "Tests", pageStart: 21, kind: "structured" },
  { id: "tank-inspection-checklist", number: "7", title: "Tank Inspection Checklist", shortLabel: "Checklist", pageStart: 22, kind: "structured" },
  { id: "roof-plate-thickness-measurements", number: "8", title: "Roof Plate Thickness Measurements", shortLabel: "Roof UT", pageStart: 28, kind: "structured" },
  { id: "roof-plate-layout", number: "9", title: "Roof Plate Layout", shortLabel: "Roof Layout", pageStart: 30, kind: "map", layoutSurface: "roof" },
  { id: "roof-nozzle-reinforcement-pad-thickness-measurements", number: "10", title: "Roof Nozzle & Reinforcement Pad Thickness Measurements", shortLabel: "Roof Nozzles", pageStart: 31, kind: "structured" },
  { id: "minimum-shell-thickness-calculations", number: "11", title: "Minimum Shell Thickness Calculations", shortLabel: "Min Shell", pageStart: 32, kind: "structured" },
  { id: "shell-plate-thickness-measurements", number: "12", title: "Shell Plate Thickness Measurements", shortLabel: "Shell UT", pageStart: 33, kind: "structured" },
  { id: "shell-plate-layout", number: "13", title: "Shell Plate Layout", shortLabel: "Shell Layout", pageStart: 36, kind: "map", layoutSurface: "shell" },
  { id: "shell-external-additional-ndt-selected-areas", number: "14", title: "Shell External Additional NDT On Selected Areas", shortLabel: "Ext NDT", pageStart: 37, kind: "structured" },
  { id: "shell-external-area-1-ut-scanning-findings", number: "15", title: "Shell External Area 1: UT Scanning & Findings", shortLabel: "Ext Area 1", pageStart: 38, kind: "map", layoutSurface: "shell" },
  { id: "shell-external-area-2-ut-scanning-findings", number: "16", title: "Shell External Area 2: UT Scanning & Findings", shortLabel: "Ext Area 2", pageStart: 39, kind: "map", layoutSurface: "shell" },
  { id: "shell-external-area-3-ut-scanning-findings", number: "17", title: "Shell External Area 3: UT Scanning & Findings", shortLabel: "Ext Area 3", pageStart: 40, kind: "map", layoutSurface: "shell" },
  { id: "shell-external-area-4-ut-scanning-findings", number: "18", title: "Shell External Area 4: UT Scanning & Findings", shortLabel: "Ext Area 4", pageStart: 41, kind: "map", layoutSurface: "shell" },
  { id: "shell-external-area-5-ut-scanning-findings", number: "19", title: "Shell External Area 5: UT Scanning & Findings", shortLabel: "Ext Area 5", pageStart: 42, kind: "map", layoutSurface: "shell" },
  { id: "shell-external-mpi-selected-areas", number: "20", title: "Shell External MPI On Selected Areas", shortLabel: "Ext MPI", pageStart: 43, kind: "map", layoutSurface: "shell" },
  { id: "shell-internal-mpi-selected-areas", number: "21", title: "Shell Internal MPI On Selected Areas", shortLabel: "Int MPI", pageStart: 44, kind: "map", layoutSurface: "shell" },
  { id: "shell-internal-mpi-findings", number: "22", title: "Shell Internal MPI Findings", shortLabel: "MPI Findings", pageStart: 45, kind: "map", layoutSurface: "shell" },
  { id: "shell-internal-recommended-repairs", number: "23", title: "Shell Internal Recommended Repairs", shortLabel: "Shell Repairs", pageStart: 46, kind: "map", layoutSurface: "shell" },
  { id: "shell-nozzle-reinforcement-pad-thickness-measurements", number: "24", title: "Shell Nozzle & Reinforcement Pad Thickness Measurements", shortLabel: "Shell Nozzles", pageStart: 47, kind: "structured" },
  { id: "shell-settlement-survey-results-external", number: "25", title: "Shell Settlement Survey Results (External)", shortLabel: "Settlement", pageStart: 48, kind: "structured" },
  { id: "shell-settlement-survey-graphs", number: "26", title: "Shell Settlement Survey Graphs", shortLabel: "Graphs", pageStart: 49, kind: "structured" },
  { id: "photographs", number: "27", title: "Photographs", shortLabel: "Photos", pageStart: 50, kind: "attachment" },
  { id: "floor-plate-layout-platemaps-numbering-system", number: "28", title: "Floor Plate Layout With Platemaps Numbering System", shortLabel: "Floor Layout", pageStart: 60, kind: "map", layoutSurface: "floor" },
  { id: "guidelines-interpretation-tru-flux-data-sheets", number: "29", title: "Guidelines for the Interpretation of the Tru-Flux Data Sheets", shortLabel: "Tru-Flux Guide", pageStart: 61, kind: "narrative" },
  { id: "floor-plate-corrosion-plan", number: "30", title: "Floor Plate Corrosion Plan", shortLabel: "Floor Corrosion", pageStart: 62, kind: "map", layoutSurface: "floor" },
  { id: "magnetic-flux-leakage-platemaps", number: "31", title: "Magnetic Flux Leakage Platemaps", shortLabel: "MFL Platemaps", pageStart: 63, kind: "map", layoutSurface: "floor" },
  { id: "appendix-a-engineering-assessment-summary", number: "Appendix A", title: "Engineering Assessment - Summary", shortLabel: "Appendix A", pageStart: 111, kind: "structured" },
];

export const API_STANDARD_MAP_SECTION_IDS = new Set(
  API_STANDARD_REPORT_TOC.filter((section) => section.kind === "map").map((section) => section.id),
);

export function getApiStandardTocSection(sectionId: string): ApiStandardTocSection | undefined {
  return API_STANDARD_REPORT_TOC.find((section) => section.id === sectionId);
}
