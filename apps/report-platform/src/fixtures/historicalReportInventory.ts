export type HistoricalReportFamily =
  | "API 653 Internal / External"
  | "Calibration"
  | "Checklist / Fieldsheet"
  | "External Inspection"
  | "Floor 3D Scan"
  | "Internal Inspection"
  | "MPI / Shell Repair"
  | "Post-Repair Inspection"
  | "Profile Assessment / 3D Scan"
  | "Repair Consultation"
  | "Settlement Survey"
  | "Shell Internal Inspection"
  | "Survey Inspection";

export type HistoricalReportStatus =
  | "approved_for_retrieval"
  | "missing_input_package"
  | "needs_review"
  | "ready_for_evaluation";

export type HistoricalDatasetRole =
  | "gold_holdout"
  | "pending_review"
  | "training_precedent"
  | "validation";

export type HistoricalReportInventoryItem = {
  reportId: string;
  fileName: string;
  displayName: string;
  family: HistoricalReportFamily;
  pages: number;
  sizeBytes: number;
  year: number | null;
  inputPackageLinked: boolean;
  status: HistoricalReportStatus;
  defaultRole: HistoricalDatasetRole;
  sectionCount: number | null;
  notes: string;
};

type ReportSnapshot = Pick<HistoricalReportInventoryItem, "fileName" | "pages" | "sizeBytes">;

const reportSnapshots: ReportSnapshot[] = [
  { fileName: "15PC1-1 Rev.1 - TK 5470 Survey Inspection Report.pdf", pages: 22, sizeBytes: 1303232 },
  { fileName: "16TJS3 -1 TK 10 Internal & External Inspection Report.pdf", pages: 53, sizeBytes: 4426658 },
  { fileName: "16TJS4 -1 TK 465 Internal & External Inspection Report.pdf", pages: 52, sizeBytes: 4519815 },
  { fileName: "17TJS12 -1 TK 461 Internal & External Inspection Report.pdf", pages: 55, sizeBytes: 4477693 },
  { fileName: "18PE1-3 TK SU4 Internal & External Inspection Report.pdf", pages: 81, sizeBytes: 9985955 },
  { fileName: "18PE1-5 TK SU 2 Internal & External Inspection Report.pdf", pages: 38, sizeBytes: 4107368 },
  { fileName: "18PE2-1 TK SU 2 Post Repair Inspection Report.pdf", pages: 10, sizeBytes: 1660053 },
  { fileName: "19PE1-7 TK BE 51 Internal & External Inspection Report.pdf", pages: 39, sizeBytes: 4561348 },
  { fileName: "19ROT1-1 Shell Bukom TK 145 Floor & Edge Settlement Survey Report Rev.1.pdf", pages: 38, sizeBytes: 2810418 },
  { fileName: "19SE3-1 Shell Bukom TK 147 In-Service Inspection Report.pdf", pages: 78, sizeBytes: 3122547 },
  { fileName: "20SE1-1 Shell Bukom TK 28 Internal Inspection Report.pdf", pages: 213, sizeBytes: 10142081 },
  { fileName: "21PE1-1 TK V10 Consultation & Review on Repairs.pdf", pages: 14, sizeBytes: 1938612 },
  { fileName: "22PE1-4 TK V10 Internal & External Inspection Report.pdf", pages: 122, sizeBytes: 11884264 },
  { fileName: "22PE2-1 TK V10 Shell Internal Inspection Report (Post Blast).pdf", pages: 34, sizeBytes: 3466190 },
  { fileName: "22PE2-MPI-1 TK V10 Shell Repairs.pdf", pages: 15, sizeBytes: 732386 },
  { fileName: "22PE3-1 TK V10 Profile Assessment (3D Scan).pdf", pages: 122, sizeBytes: 10747303 },
  { fileName: "23PE1-1 TK FU 1 External Inspection Report.pdf", pages: 35, sizeBytes: 3419777 },
  { fileName: "23PE1-3 TK FU 48 Internal & External Inspection Report.pdf", pages: 33, sizeBytes: 3674152 },
  { fileName: "23PE1-6 TK FU 51 Internal & External Inspection Report.pdf", pages: 35, sizeBytes: 3862463 },
  { fileName: "23PE1-7 TK FU 47 Calibration Report.pdf", pages: 3, sizeBytes: 361997 },
  { fileName: "23SE1-4 Shell Bukom TK 27 Floor 3D Scan.pdf", pages: 52, sizeBytes: 3816081 },
  { fileName: "24PE1-2 TK 13 Internal & External Inspection Report.pdf", pages: 73, sizeBytes: 7102669 },
  { fileName: "Pacific Energy Fieldsheet (Fullscope).pdf", pages: 26, sizeBytes: 2663348 },
];

export const historicalReportInventory: HistoricalReportInventoryItem[] = reportSnapshots.map((snapshot) => {
  const displayName = snapshot.fileName.replace(/\.pdf$/i, "");
  const isCurrentApiCase = snapshot.fileName.startsWith("22PE1-4");
  const isProfileGold = snapshot.fileName.startsWith("22PE3-1");
  const family = classifyFamily(snapshot.fileName);

  return {
    ...snapshot,
    reportId: slugify(displayName),
    displayName,
    family,
    year: parseYear(snapshot.fileName),
    inputPackageLinked: isCurrentApiCase,
    status: isCurrentApiCase
      ? "ready_for_evaluation"
      : isProfileGold
        ? "missing_input_package"
        : "approved_for_retrieval",
    defaultRole: isCurrentApiCase
      ? "validation"
      : isProfileGold
        ? "gold_holdout"
        : "training_precedent",
    sectionCount: isCurrentApiCase ? 32 : isProfileGold ? 14 : null,
    notes: isCurrentApiCase
      ? "Linked to the current LAIQ inspection app test package."
      : isProfileGold
        ? "Selected as a hidden test answer. The matching LAIQ inspection app capture is still required."
        : "Available as a training reference. Its sections and source quality still need review before backend use.",
  };
});

function classifyFamily(fileName: string): HistoricalReportFamily {
  const lower = fileName.toLowerCase();
  if (lower.includes("profile assessment") && lower.includes("3d scan")) return "Profile Assessment / 3D Scan";
  if (lower.includes("floor 3d scan")) return "Floor 3D Scan";
  if (lower.includes("calibration report")) return "Calibration";
  if (lower.includes("fieldsheet")) return "Checklist / Fieldsheet";
  if (lower.includes("consultation") || lower.includes("review on repairs")) return "Repair Consultation";
  if (lower.includes("post repair")) return "Post-Repair Inspection";
  if (lower.includes("mpi") || lower.includes("shell repairs")) return "MPI / Shell Repair";
  if (lower.includes("floor & edge settlement")) return "Settlement Survey";
  if (lower.includes("survey inspection")) return "Survey Inspection";
  if (lower.includes("shell internal")) return "Shell Internal Inspection";
  if (lower.includes("in-service")) return "External Inspection";
  if (lower.includes("internal & external")) return "API 653 Internal / External";
  if (lower.includes("external inspection")) return "External Inspection";
  return "Internal Inspection";
}

function parseYear(fileName: string): number | null {
  const prefix = fileName.match(/^(\d{2})/);
  return prefix ? 2000 + Number(prefix[1]) : null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
