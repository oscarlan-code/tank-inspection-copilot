# Section-first classification evaluation v1

This evaluator separates section-routing safety from within-section block quality. A wrong section is a hard failure because it selects the wrong section agent and knowledge pack. A section abstention is safer than a false route, but it lowers automatic coverage. A correct section with an unresolved block can enter human review and cannot enter generation until the block is sealed.

The predeclared gates are 100% routed-section precision, zero wrong-section routes, at least 95% automatic section coverage, 100% recall for declared critical sections, and at least 90% exact block accuracy. Gold remains evaluator-private.
