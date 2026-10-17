# Mock Preparation Agent v1

Status: evaluation candidate. Product use is disabled.

This open-book agent converts reviewed source semantic units from one historical
report into inspector-style app evidence. Structured fields, checklist ratings,
measurements and maps remain deterministic or human-reviewed; the LLM drafts only
narrative capture units.

The agent never writes directly to the Android export. Its output must be mapped
through the existing V3 app plan, materialized through ProductStore, exported by
the app and checked by the app-export-authenticity grader before it can qualify.

`prepare-candidate.mjs` always creates a reviewable request preview. `--live`
sends the preview to the configured worker and is allowed only from a clean Git
commit so the candidate can be reproduced.
