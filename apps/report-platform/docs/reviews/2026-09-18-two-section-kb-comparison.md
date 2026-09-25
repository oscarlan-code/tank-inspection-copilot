# Two-section comparison: same mock, with and without historical guidance

Four approved live calls completed: Scope of Inspection and Repair
Recommendations, each once without and once with curated historical writing
guidance. No data correction, prompt tuning or retry was applied after seeing
the results. This is a small reconstruction diagnostic, not promotion evidence.

[Open the existing Evaluation Lab through Tailscale](http://oscars-mac-mini.tailbd3a33.ts.net:4175/admin/evaluation?evaluationCaseId=eval-tk5452-kb-ablation-v1-without-kb&sectionId=01-scope).
Switch **Without KB / With historical KB**, then **Next section** for
recommendations. The original and the same app evidence remain alongside the
selected output. The **Evaluation run** selector also preserves access to the
earlier 21-section review. Navigation loads saved artifacts and never generates.

| Section | Without KB | With KB | Observed difference |
| --- | --- | --- | --- |
| Scope | 174 words; 13 statements | 169 words; 13 statements | More consistent prospective “To carry out…” wording. Qualitative review found the supplied activities, numbers and limitations retained in both. |
| Recommendations | 118 words; 7 statements | 110 words; 7 statements | More direct and shorter wording, but one ambiguous physical-component expansion in the KB version. No demonstrated content-recovery improvement. |

For recommendations, the raw mock voice note already says “Floor projection is
about 2.5 inches wide.” Preprocessing isolated a recommendation saying only
“projection” and passed the broad checklist component label “tank foundation”.
The KB candidate writes “tank foundation projection”. The original identifies
the **floor projection plate**.
All proposed work and conditions remain present, but this is not an acceptable
identity clarification without review. It shows why precise item identity and
relevant preceding context must survive routing instead of relying on broad
section labels. The necessary identity already exists in the mock data.
The frozen mock was not changed to hide this outcome.

All four AI responses remain **unaccepted** by the existing deterministic
wording gate. The gate does not confirm many semantically reasonable
paraphrases, and its unconfirmed counts must not be read as actual omissions.
The UI defaults to the actual AI candidate and separately offers the retained
draft. No validator threshold was relaxed. No independent recovery score is
claimed; [statement-by-statement assessment](data/tk5452-kb-ablation-v1/assessment.json)
is Codex's qualitative review, not independent human approval.

## Controlled conditions and source isolation

- Identical mock SHA-256, section plan, current facts, model (`gpt-5.6-sol`),
  low reasoning effort, formatter, output schema and validation in both arms.
- Selected sections have no known missing inputs. Other sections' incompleteness
  remains unchanged; no whole-report generation was attempted.
- The sole intervention is two abstracted writing patterns per section from
  two approved training reports issued in 2016 and 2017, before the June 2019
  target. Section inclusion, review lane, source hash, split, lineage, page and
  date checks passed. Target asset/report and held-out sources were excluded.
- Workers received the patterns, not the historical source paragraphs, their
  asset-specific facts, or the target answer text. Reference prose was loaded
  after all four calls. Executed request hashes equal the approved previews.
- This tests curated style guidance. It does not measure full-corpus retrieval,
  recommendation inference, same-asset history or a shared production KB adapter.

## Next implementation priority

Preserve exact physical component identity in processed evidence, and calibrate
semantic review against independently reviewed examples. Keep deterministic
value/entity checks. Historical guidance can help style, but this tiny test
does not justify a corpus-wide rebuild, rollout or more expensive batch testing.

The shared compiler and guards were reused through an evaluation-only worker
adapter. Existing authenticated admin endpoints serve the saved comparison;
there are no new unauthenticated routes, generation-on-load or policy writes.

Artifacts: [comparison](data/tk5452-kb-ablation-v1/comparison.html),
[exact requests](data/tk5452-kb-ablation-v1/live-request-preview.json),
[saved results](data/tk5452-kb-ablation-v1/comparison.json),
[source audit](data/tk5452-kb-ablation-v1/historical-source-audit.json).

Verification: comparison/payload/integrity audits and the existing inspector-note
regression passed. Standard project guardrails passed, including build,
generation logic, strict sample leakage, PostgreSQL/storage and API authorization.
Browser verification through Tailscale covered both arms, both sections, the
three review columns, AI/retained switching, the visible component warning, and
navigation from the older shell review into this two-section comparison.
