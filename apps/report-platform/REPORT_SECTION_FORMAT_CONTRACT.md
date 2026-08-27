# LAIQ Report Section Format Contract

Version: `irs_pdf_section_v1`

## Purpose

Every original gold section and generated candidate must be represented as a complete report section, not as extraction fragments. Content fidelity and presentation fidelity are evaluated separately. The approved original section is evaluation-only and must never enter generation or retrieval context.

## Page contract

- A4 portrait, with a stable printable content area and no horizontal clipping.
- Repeated report identity header: client, job/report reference, tank/asset identity, completion date, and page number when available.
- Repeated confidentiality/page footer.
- Controlled Arial/Helvetica-compatible typography, readable at print scale.
- No raw JSON, escaped newline tokens, replacement glyphs, HTML entities, debug labels, or unresolved placeholders.
- Tables may continue across pages with repeated headers; rows must not be split when avoidable.
- Cross-references must use readable labels; an unavailable hyperlink must remain intelligible as plain text.

## Section grammar

Each section contains one numbered section heading and one body appropriate to its section type:

| Section type | Required body |
|---|---|
| Narrative | Professional paragraphs with the same purpose and material concepts as gold |
| Findings / scope | Grouped bullets or numbered findings preserving condition, location, evidence, assessment, and qualification |
| Recommendations | Action-oriented grouped items preserving priority, component, condition, action, and inspection basis |
| General information | Stable label-value table; no narrative reconstruction of structured fields |
| Measurement / calculation | Structured table with identities, values, units, limits, and status kept in the same row relationship |
| Checklist | Complete ordered checklist table; item number and category alignment must be preserved |
| Maps / photographs | Separate visual contract; excluded from the current context-only benchmark until geometry/media evaluation is enabled |

## Content benchmark

The original section is the gold answer. The automated reviewer accepts faithful paraphrase and reordering, but checks:

1. Same section purpose.
2. Material finding, condition, conclusion, action, and qualification coverage.
3. Required fact recall.
4. Exact protected measurements, units, identities, severities, and relationships.
5. Unsupported or contradictory claims.
6. Professional replacement acceptability.

The gold answer is scoring-only. It cannot be passed to the report generator, RAG query, retrieval candidates, prompt examples, policy state, or reward state before generation completes.

## Presentation benchmark

The deterministic format evaluator compares the structural signature of gold and generated sections:

- heading presence;
- expected narrative, list, or table structure;
- table row or finding-count balance;
- clean export markup;
- absence of extraction artifacts and placeholder language.

The UI renders both sides with the same A4 section-preview stylesheet. This prevents a raw extracted gold fragment from being compared with a styled generated fragment.

## Review provenance

Generated review output carries source attribution in `data-laiq-provenance` without changing the clean final PDF export:

| Review color | Provenance value | Meaning |
|---|---|---|
| Blue | `app_field_data` | Structured field or measurement copied from the LAIQ app export |
| Green | `app_voice_data` | Inspector voice or note evidence, including a faithful paraphrase |
| Yellow | `llm_prediction` | Model-authored connective, summarizing, or inferred wording |
| Gray | `precedent_template` | Section heading, label, or structural wording supplied by the approved template |

Mixed-source sentences must be attributed at span level. Whole blocks may use block-level attribution only when every word in the block has the same source. Provenance is review metadata: it is visible in Evaluation Lab and omitted from the normal customer-facing export styling.

## Automated verdict

- `acceptable`: fact/safety contracts pass, no material concept is missing, the section can replace gold professionally, and the PDF-ready format contract passes.
- `needs_review`: correctable limited omission or presentation weakness without a protected-fact error or invented material claim.
- `unacceptable`: wrong section purpose, major omission, contradiction, invented material content, protected-fact mismatch, or unusable export structure.

Human review is optional evidence for future calibration, not required to execute the benchmark.
