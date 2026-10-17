# Current report workflow scaffold

`workflow.json` is the checked-in executable index for the rebuilt report workflow.
It distinguishes implemented evaluation stages, mutable sandbox candidates,
historical compatibility paths, and planned product stages.

The two input paths converge at an authenticated Android export:

```text
R&D truth -> Mock Preparation v1 -> Android round trip --+
                                                        +-> guard -> atomizer v5
Inspector capture -> Android ProductStore export -------+   -> Classification v1
                                                            -> reviewed section packages
                                                            -> package-bound evaluation plan
                                                            -> exact section-agent registry entry
                                                            -> section-owned generator
                                                            -> section-owned pre-display reviewer
```

Run `npm run workflow:scaffold:audit` after changing a release registry, workflow
stage, archive state, or generation handoff. Seven section-agent scaffolds now
exist under `server/section-agents/specs/vertical-tank-v1/`. Each owns its prompt or
deterministic instructions, format, KB policy, reviewer, evaluator and harness.
Only General Tank Information Candidate A is executable; it is not qualified,
frozen, promoted, or product-enabled. The higher Report Structure Agent, durable
plan store and report integration remain planned.
