# Vertical API 653 inspection outline profile v4

Status: **frozen for R&D classification evaluation**. Product use is disabled.

This profile defines the 25 section labels and their block labels available to the
Contents Classification Agent. Seven labels are common historical anchors and 18
technical labels are conditional. The Report Structure Agent still decides the
actual table of contents for each report, so empty conditional sections are omitted.

Version 4 preserves the same 25-section vocabulary and adds explicit classification
ownership for ambiguous General Tank Information fields, recommendation actions and
basis, monitoring instructions, earthing points, test calibration records, and missing
component or field context. It also separates method-specific scope statements from
coverage statements and current observed conditions from confirmed historical events.
It also owns missing previous-inspection status under General Tank Information and
distinguishes completed component access limitations from planned scope exclusions.

The evidence chain is explicit:

1. `historical-outline-evidence.json` pins the reviewed 69-report vertical profile,
   seven common-core pattern packs and the broader 162-file KB audit.
2. `api653-report-obligations.json` maps paraphrased API 653 report obligations to
   section/block labels.
3. `outline-review.json` records the evaluation decision and product blocker.
4. `outline-manifest.json` hashes the frozen artifacts.
5. `audit.mjs` verifies hashes, counts, mappings and the product-disable boundary.

The local standard source includes API 653 Fifth Edition through Addendum 2. The
official 2026 effectivity sheet also lists Addendum 3 and Errata 2. A licensed review
of those revisions is required before product compliance use. Annex C checklist
material is treated as informative guidance and does not create a mandatory report
section.

Semantic changes require a new `vertical-api653-v5` profile. Do not silently edit
this version after it is accepted.
