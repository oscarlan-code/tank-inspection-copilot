export function buildApiStandardFixturePackage(exportPackage) {
  const inspectionId = "inspection-v10-api653-internal-external-20220722";
  const inspectionReference = "LAIQ-V10-20220722";
  const exportedAtIso = "2022-07-22T16:30:00Z";

  return {
    ...exportPackage,
    inspectionId,
    inspectionReference,
    exportedAtIso,
    task: {
      ...exportPackage.task,
      inspectionId,
      inspectionReference,
      client: "Pacific Energy",
      tankNumber: "V10",
      exportedAtIso,
    },
    inspectionRecord: {
      ...exportPackage.inspectionRecord,
      inspectionId,
      inspectionReference,
      client: "Pacific Energy",
      tankNumber: "V10",
      location: "Vuda Terminal, Fiji",
      fieldLeaseName: "Pacific Energy Vuda Terminal",
      inspector: "Syed A. R. Balkhi",
      diameterM: 19.52,
      heightM: 14.535,
      shellCourseCount: 8,
      externalRoofType: "fixed_dome_roof",
    },
    validationResults: withInspectionId(exportPackage.validationResults, inspectionId),
    taskSnapshots: withInspectionId(exportPackage.taskSnapshots, inspectionId),
    layoutTargets: withInspectionId(exportPackage.layoutTargets, inspectionId),
    layoutConfigs: withInspectionId(exportPackage.layoutConfigs, inspectionId),
    elements: withInspectionId(exportPackage.elements, inspectionId),
    utMeasurements: withInspectionId(exportPackage.utMeasurements, inspectionId),
    inspectionChecklistItems: withInspectionId(exportPackage.inspectionChecklistItems, inspectionId),
    inspectionChecklistSectionNotes: withInspectionId(exportPackage.inspectionChecklistSectionNotes, inspectionId),
    findings: withInspectionId(exportPackage.findings, inspectionId),
    attachments: withInspectionId(exportPackage.attachments, inspectionId),
  };
}

function withInspectionId(items, inspectionId) {
  return (items ?? []).map((item) => ({
    ...item,
    inspectionId,
  }));
}
