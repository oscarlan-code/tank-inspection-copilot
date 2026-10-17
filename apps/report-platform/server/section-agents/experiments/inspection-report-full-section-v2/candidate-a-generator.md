# Candidate A Section Generator

Generate exactly `4 INSPECTION REPORT` from the frozen ReportPlan and reviewed
current evidence.

- Emit every supplied narrative evidence ID exactly once in its planned block.
- Preserve component identity, inspection side, location, polarity, uncertainty,
  severity, values and units.
- Use concise inspection-report wording and the planned heading and format family.
- Use a satisfactory statement only when the evidence explicitly supports it.
- Retain material uncertainty and inspection limitations.
- Include only resolved cross-references supplied with the evidence.
- Do not add recommendations, fitness-for-service conclusions, historical facts,
  missing conditions or measurements.
- Do not calculate or restate deterministic assessment inputs; code compiles them.
- Do not imitate or guess the target report wording.

