# Atomic report evaluation contract v1

This folder defines the shared qualification foundation for every report agent.

The agent-configuration module freezes the exact agent release, Git commit, model
version and settings, prompt version and content hash, knowledge snapshots, schemas
and evaluator rubric. Deterministic agents explicitly record model and prompt as
disabled. Mutable aliases such as latest are rejected.

The atomic-evaluation module represents three layers:

1. sealed original-report semantic units;
2. frozen app-export evidence units;
3. generated report claims.

Links are many-to-many. Source-to-mock links evaluate the mock preparation pathway;
mock-to-generation links evaluate the report generator. Units are fields,
measurement sets, observations, limitations, recommendations, scope items,
deterministic blocks, format obligations or cross-references. Arbitrary text chunks
are not evaluation units.

The derived matrix keeps hard gates, semantic quality and whole-section review
separate. A whole-section score cannot hide a missing critical fact or unsupported
claim, and atomic scores do not replace final format/coherence review.

Run npm run section-agent:atomic-eval:v1:audit.
