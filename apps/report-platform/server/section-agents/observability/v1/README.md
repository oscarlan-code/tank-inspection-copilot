# Agent monitoring v1

This shared evaluation-only contract records every agent and deterministic control
that actually executes in a report-section run. It is reusable by evidence routers,
report planners, section generators, pre-display reviewers, post-generation
evaluators, report integrators, and the separate mock-data workflow.

The trace stores release bindings, hashes, evidence IDs, counts, timestamps,
decisions, blockers, model identifiers, and retrieval identifiers. New traces also
retain immutable, authorized-admin previews of the actual structured input and
output at every executed stage. Trace input/output references stay lightweight and
resolve by `artifactId` into the top-level artifact catalog, where each preview is
stored once. Each preview has a kind, schema, content hash, byte length, visibility,
and redaction status. The saved preview is a
sanitized copy: secrets, raw prompts, hidden model reasoning, and chain of thought
are prohibited. Observable app evidence, generated section output, reviewer output,
and evaluator-only gold may be shown to an authorized evaluation administrator when
they are already part of the comparison workflow.

Every span reports three separate outcomes:

- **Execution** says whether the stage returned an auditable result.
- **Gate** says whether the stage permitted the workflow or draft to proceed.
- **Quality** says whether a declared post-generation grader measured the content.

A completed stage and a passed display gate do not imply that semantic quality was
measured. The current TK5452 observed case demonstrates this distinction: execution
completed and the display gate passed, while quality remains `not_measured` because
the semantic judge did not run.

The evaluation matrix keeps hard gates separate from quality and diagnostic
metrics. Every applicable hard gate must pass. A missing measurement is
`not_available` and makes qualification incomplete; it never defaults to 100%.
Display, qualification, human approval, and promotion remain separate decisions.
Every row identifies its grader and exposes atomic rule results: observed value,
operator, expected value, verdict, evidence references, and a concise explanation.

To investigate a result, follow one span in order: inspect its saved inputs, inspect
its output, read its gate decision, then open the related matrix rules and evidence
references. For evaluator spans, confirm that the sealed-gold input first appears
after the gold-access barrier. It must never appear in planner, generator, or
pre-display-review inputs.

This directory is shared platform infrastructure, outside immutable agent-release
directories. It does not change a frozen generator, reviewer, or evaluator.
