import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const componentUrl = new URL("../../../src/components/MockPreparationEvaluation.tsx", import.meta.url);
const evaluationLabUrl = new URL("../../../src/components/EvaluationLab.tsx", import.meta.url);
const contractUrl = new URL("../../../docs/contracts/evaluation/MOCK_PREPARATION_EVALUATION_UI.md", import.meta.url);
const projectionUrl = new URL("./ui-projection.mjs", import.meta.url);

test("approved Step 1 truth-to-mockup UI remains frozen", async () => {
  const [component, evaluationLab, contract, projection] = await Promise.all([
    readFile(componentUrl, "utf8"),
    readFile(evaluationLabUrl, "utf8"),
    readFile(contractUrl, "utf8"),
    readFile(projectionUrl, "utf8"),
  ]);

  assert.match(contract, /Contract ID: `mock_preparation_truth_to_mock_ui_v2`/);
  assert.match(contract, /one primary truth-to-mockup review surface/);
  assert.match(contract, /`\/admin\/evaluation` opens this Step 1 surface directly/);
  assert.match(contract, /75 reviewed text units, 76 atomic facts, and 228 comparisons/);
  assert.match(contract, /Calibration tests the evaluator and must not be counted/);
  assert.match(contract, /Complete-report qualification remains a separate backend denominator/);
  assert.match(contract, /Dataset shape alone is not permission/);

  const stages = ["Original report", "Reviewed truth", "Mockup output", "Evaluation"];
  let previousStage = -1;
  for (const stage of stages) {
    const nextStage = component.indexOf(`>${stage}<`);
    assert.ok(nextStage > previousStage, `${stage} must exist in the approved workflow order`);
    previousStage = nextStage;
  }
  assert.doesNotMatch(component, /mock-eval-workbook-tabs/, "the current run must not be duplicated across top-level tabs");
  assert.match(evaluationLab, /has\("evaluationCaseId"\) \? "policy" : "mock"/, "the evaluation route must open Step 1 by default");
  assert.match(evaluationLab, /view !== "mock" \? <nav className="eval-lab-nav"/, "the general Evaluation Lab navigation must stay hidden in Step 1");
  assert.match(evaluationLab, /view !== "mock" \? <div className="eval-live-banner"/, "the generic live-data banner must stay hidden in Step 1");

  assert.match(component, /function TextUnitWorkbook[\s\S]*?useState<ResultFilter>\("all"\)/, "Step 1 must show every comparison by default");
  assert.match(component, /function TextUnitWorkbook[\s\S]*?const pageSize = Math\.max\(rows\.length, 1\)/, "later truth units must not be hidden by pagination");

  const expectedColumns = ["#", "Mock variation", "Evidence type", "Truth text unit (original report)", "Generated mockup text unit", "Evaluator", "Meaning", "Integrity", "Overall", "Feedback"];
  const columnBlock = component.match(/const mockColumns:[\s\S]*?\n\];/)?.[0] ?? "";
  let previousColumn = -1;
  for (const label of expectedColumns) {
    const nextColumn = columnBlock.indexOf(`label: "${label}"`);
    assert.ok(nextColumn > previousColumn, `${label} column must exist in the approved order`);
    previousColumn = nextColumn;
  }

  for (const label of ["Truth text units", "Atomic truth facts", "Mockup comparisons", "Evaluation result", "Fidelity anchor", "Controlled variation"]) {
    assert.ok(component.includes(label), `${label} must remain visible`);
  }
  assert.match(component, /function MockOutputRow[\s\S]*?item\.originalText[\s\S]*?item\.appEvidenceText/, "each row must show complete truth and mockup text");
  assert.match(component, /function SelectedRowInspector[\s\S]*?Truth text unit[\s\S]*?Generated mockup text unit/, "selected-row review must preserve the truth/mockup pairing");
  assert.match(component, /mock-sheet-footer[\s\S]*?<GradePerformanceDashboard analytics=\{gradeAnalytics\}/, "performance charts must remain below the workbook");
  assert.match(component, /Step 1 control gates/);
  assert.match(component, /Evaluator calibration/);
  assert.match(projection, /const fullCaseResult = await readOptionalJson/);
  assert.match(projection, /projectCurrentRows\(twentyUnitPilot\)/);
});
