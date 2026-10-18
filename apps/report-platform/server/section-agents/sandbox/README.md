# Section-agent sandbox

This directory contains mutable R&D candidates. A sandbox candidate can run only in
evaluation mode and cannot be selected by the product release registry.

Each section candidate keeps generator, pre-display reviewer and post-generation
evaluator controls together. Promotion copies the exact qualified bytes into
`releases/<section-id>/<role>/<version>/`; it never turns this mutable directory into
a product release.

Every candidate is evaluated twice after generation:

1. atomic semantic units compare sealed source gold, reviewed app evidence and
   generated claims or fields;
2. the complete rendered section is reviewed for coverage, unsupported claims,
   section-specific format, coherence, cross-references and inspector acceptance.

A critical atomic failure blocks qualification even if the whole section looks
good. Perfect atomic rows do not replace whole-section rendered review. Any change
to generator code, prompt/model, KB, format, reviewer, evaluator or metrics creates
a new candidate ID before rerunning development and validation.

The first package-bound candidate is
`candidates/general-tank-information/candidate-a/`. It consumes only a reviewed
`section_evidence_package_v1` and the matching frozen evaluation SectionPlan.
It remains a sandbox candidate and cannot be copied to an immutable evaluation
release until both evaluation levels and the human gates pass.

