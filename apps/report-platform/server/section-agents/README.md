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
- `specs/vertical-tank-v1/`: planned section contracts; a specification is not an executable release.
- `test-fixtures/`: generic contract fixtures, not qualification evidence.

Current executable families are `scope-of-inspection` and
`general-tank-information`. All releases remain evaluation-only. A future generator
without an exact reviewer fails before presentation; a generator/reviewer pair
without an exact evaluator cannot run sealed-gold evaluation. There is no `latest`
or legacy-generator fallback.
