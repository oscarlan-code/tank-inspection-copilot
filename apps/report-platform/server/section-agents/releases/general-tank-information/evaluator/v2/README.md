# Evaluator v2

Status: `evaluation_candidate`; R&D only.

This evaluator is bound to General Tank Information generator v3 and reviewer v2.
It runs only after generation and a passed pre-display review. It opens a
sealed original section after generation, then asks an injected semantic judge to
compare current evidence, generated output and original output. It never changes
user visibility, approval or product routing. No live model call occurs unless the
caller explicitly supplies a semantic judge.
