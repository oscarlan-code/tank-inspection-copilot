# Section agents

See [the section-agent release contract](../../SECTION_AGENT_RELEASES.md).

Every section owns one release family:

```text
releases/<section-id>/
├── generator/<version>/
├── reviewer/<version>/
└── evaluator/<version>/
```

The roles are intentionally generic because the parent folder already identifies the
section. `generator` creates an unapproved section, `reviewer` is the no-gold
pre-display gate, and `evaluator` is the post-generation sealed-gold R&D comparison.

Shared runtime files:

- `generator-registry.mjs` / `generator-runtime.mjs`: exact generation binding and frozen execution.
- `reviewer-registry.mjs` / `reviewer-runtime.mjs`: exact pre-display binding and integrity checks.
- `evaluator-registry.mjs` / `evaluator-runtime.mjs`: exact sealed-gold evaluation binding and integrity checks.
- `guarded-execution.mjs`: generation followed by the required reviewer; blocked drafts are not returned for presentation.
- `codex-gold-judge.mjs`: explicit optional live-LLM adapter for R&D evaluation only.
- `specs/vertical-tank-v1/`: seven section-owned scaffolds and their registry; a scaffold is not an executable candidate or release.
- `test-fixtures/`: generic contract fixtures, not qualification evidence.
- `sandbox/`: mutable, evaluation-only candidates that consume the current package
  handoff before qualification and immutable release creation.

Historical executable release families exist for `scope-of-inspection` and
`general-tank-information`. They remain immutable evaluation records and are not
active inputs to the rebuilt package-bound workflow. A future generator without an
exact reviewer fails before presentation; a generator/reviewer pair without an
exact evaluator cannot run sealed-gold evaluation. There is no `latest` or
legacy-generator fallback.

`sandbox/candidates/general-tank-information/candidate-a/` is the first executable
`section_evidence_package_v1` consumer. It is intentionally absent from the frozen
release registries and product routing.
