# General Tank Information section workflow

This is the section-by-section R&D harness for the active package-bound sandbox
candidate. It runs one exact chain:

`Android ProductStore export + receipt -> input guard -> atomizer v5 -> Contents
Classification evaluation v1 -> authorized classification review ->
section_evidence_package_v1 -> frozen ReportPlan/SectionPlan -> Candidate B
generator -> independent no-gold reviewer -> sealed-gold evaluator`.

The preparation function cannot receive gold. If any narrative classification needs
review, it returns `awaiting_authorized_classification_review` and does not generate.
After generation, evaluation reports atomic field rows separately from whole-section
structure/coherence. Rendered historical comparison and inspector acceptance remain
human gates. Product use and promotion are disabled.
