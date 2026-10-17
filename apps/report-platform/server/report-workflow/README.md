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
                                                            -> General Information Candidate A
                                                            -> independent pre-display review
```

Run `npm run workflow:scaffold:audit` after changing a release registry, workflow
stage, archive state, or generation handoff. Candidate A is executable in the
sandbox but is not qualified, frozen, promoted, or product-enabled. The higher
Report Structure Agent, durable plan store and report integration remain planned.
