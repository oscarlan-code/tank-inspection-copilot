# 4. Inspection Report agent

Status: `planned`; product disabled.

- Review [agent-spec.json](agent-spec.json) for inputs, output blocks and format.
- Review [kb-policy.json](kb-policy.json) for the isolated section KB.
- Review [harness.json](harness.json) for the two-track robustness evaluation,
  bounded RSI pilot and freeze gates.
- Review the active full-section workflow at
  `../../../evaluation-workflows/inspection-report/`. Generation remains blocked
  until a disjoint multi-report SectionKnowledgeBundle, complete reviewed source
  inventory, target-blind frozen ReportPlan, Truth Case and six-variant mock export
  pass its audit.

The interpretation track varies practical inspector wording while holding one
scenario truth fixed. The generation track gives every candidate the same verified
structured observations. Development feedback may produce a new candidate version;
it cannot mutate a frozen release, open validation/held-out gold early, relabel
sources or promote a release.
