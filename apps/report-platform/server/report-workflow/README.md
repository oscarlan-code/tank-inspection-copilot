# Current report workflow scaffold

`workflow.json` is the checked-in executable index for the rebuilt report workflow.
It distinguishes implemented evaluation stages, historical compatibility paths, and
planned generation stages without treating a plan as an implemented agent.

The two input paths converge at an authenticated Android export:

```text
R&D truth -> Mock Preparation v1 -> Android round trip --+
                                                        +-> guard -> atomizer v5
Inspector capture -> Android ProductStore export -------+   -> Classification v1
                                                            -> reviewed section packages
                                                            -> future section agents
```

Run `npm run workflow:scaffold:audit` after changing a release registry, workflow
stage, archive state, or generation handoff. Product generation remains disabled.
