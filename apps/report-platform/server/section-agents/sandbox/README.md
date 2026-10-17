# Section-agent sandbox

This directory contains mutable R&D candidates. A sandbox candidate can run only in
evaluation mode and cannot be selected by the product release registry.

Each section candidate keeps generator, pre-display reviewer and post-generation
evaluator controls together. Promotion copies the exact qualified bytes into
`releases/<section-id>/<role>/<version>/`; it never turns this mutable directory into
a product release.

The first package-bound candidate is
`candidates/general-tank-information/candidate-a/`. It consumes only a reviewed
`section_evidence_package_v1` and the matching frozen evaluation SectionPlan.

