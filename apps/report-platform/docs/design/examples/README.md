# Worked section plan

These files are fictional design examples, not imported inspection data or
new evaluation results. `section-plan-v2.example.json` follows the target
[SectionPlan schema](../section-plan-v2.schema.json). Its source is a small
native-record excerpt, not a complete valid V3 transport package. Real imports
must still pass the existing full app-export/upload contract.

The example shows a nozzle condition and its supporting UT row. Both retain
one physical entity (`entity-nozzle-demo-n2`). Backend classification gives the
condition a required narrative use in the Inspection Report; detailed readings
are supporting evidence there and required structured content in the separate
shell nozzle measurement plan (not included in this single-section example).

A valid inspection narrative for these records is:

> Nozzle DEMO-N2 on the east side showed minor external corrosion.

The section does not reproduce the UT row or invent a remaining-life or repair
conclusion. The condition can be rendered deterministically without voice.
The measurement section uses the same row evidence ID in its own table.
Omission of those detailed readings from this narrative does not reduce
narrative recovery. Moving the condition to another nozzle or claiming “no
corrosion” fails integrity.

`native-record-excerpt.example.json` preserves the example source values.
`section-plan-v2.evidence.json` represents its proposed normalized snapshot.
The plan hashes the exact example source/snapshot file bytes. IDs and all
version names are illustrative; no runtime registry entry or deployment is
implied. Normalization of this example's known UT unit cites the declared
example field contract; actual units must be established by the real export
version's field specification.

The example covers one slot and is intentionally not a complete production
plan for an entire inspection. The section catalog supplies the remaining
applicability and completeness rules. A JSON shape check is only one gate:
semantic, scope, entity, obligation, reference and native-record parity checks
remain required by the compiler design.
