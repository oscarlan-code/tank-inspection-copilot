# Semantic-unit report evaluation

## Purpose

Report evaluation uses semantic obligations and claims as its smallest scored unit.
Fixed-length chunks and raw sentence boundaries are not gold units because a sentence
may contain several facts and several sentences may express one finding.

The hierarchy is report, section, outline block, semantic evaluation unit. Supported
unit types are structured fields, measurement sets, observations, limitations,
recommendations, scope items, deterministic blocks, format obligations and
cross-references.

## Two linked evaluation stages

Stage A compares the sealed original report with the frozen app export.

- Every source unit receives a reviewed disposition.
- Required current facts map to one or more app evidence units.
- Exact protected values, units, entities, sides, locations, polarity and uncertainty
  are checked deterministically where possible.
- Narrative report prose is rewritten as realistic inspector capture; exact historical
  wording is not copied into voice notes.
- Missing app capability is recorded as a gap, never silently filled.

Stage B compares the frozen app export with the generated section.

- Every generation-eligible evidence unit is either used or explicitly dispositioned.
- Every generated claim links to supporting current evidence.
- Unsupported output is a hard failure.
- Semantic preservation is judged with a calibrated evaluator or human review.
- Whole-section format and coherence are scored separately after atomic checks.

Links are many-to-many. One report unit may become several capture records, several
report units may be combined in one practical note, and one evidence record may
support multiple generated claims or sections.

## Version identity

Every run binds each participating agent to one immutable execution configuration:

- agent role, ID, release ID and manifest hash;
- exact Git commit;
- model provider, ID, version and settings hash, or explicit deterministic disablement;
- prompt ID, semantic version, artifact path and content hash, or explicit disablement;
- exact knowledge snapshots;
- input and output schema versions and hashes;
- evaluator rubric version and hash when applicable.

Mutable aliases such as latest are prohibited. Changing any bound item creates a new
configuration hash and therefore a new experiment candidate.

## Matrix

The minimum atomic matrix contains:

- source-unit disposition coverage;
- required source-to-evidence coverage;
- generation evidence coverage;
- supported generated-claim precision;
- protected-fact accuracy;
- semantic recovery;
- whole-section format;
- whole-section coherence.

Hard gates, quality measurements and diagnostics remain separate. An unavailable
semantic judge stays not available; it cannot be converted into a pass. Whole-section
quality cannot compensate for a missing critical fact or unsupported claim.

## Leakage boundary

The mock preparation agent and independent mock reviewer may open the target report.
The generator, pre-display reviewer and retrieval system receive only the frozen app
export, approved section projection, pinned knowledge packs and applicable standards.
The sealed source units open to the post-generation evaluator only after generation.
Dataset splits remain grouped by report, asset and scenario lineage.
