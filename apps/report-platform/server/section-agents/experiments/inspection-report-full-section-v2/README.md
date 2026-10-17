# Inspection Report full-section calibration

This is the active evaluation-only Candidate A experiment for Section 4. It uses
the two frozen development calibration lineages prepared by
`evaluation-workflows/inspection-report`.

The generation worker receives the target-blind ReportPlan, reviewed normalized
current evidence and the generation projection from the frozen multi-report
knowledge bundle. It never receives target report text, target headings or evaluator
labels. Deterministic assessment inputs are compiled by code and are not calculated
or rewritten by the model.

The pre-display reviewer receives the candidate, current evidence, ReportPlan and
review projection, but no target gold. The evaluator opens the sealed target source
obligations only after generation and reports evidence fidelity, generic pattern
conformance, target meaning recovery and target-format similarity separately.

Candidate A remains evaluation-only. Its earlier section-specific capture artifacts
are calibration history, not an active generation input. Resume this experiment only
with a frozen report-wide Android V3 mock case and a traceable Section 4 projection
from that case. Running or reviewing the experiment cannot create a product routing
record or promote a model.
