# V3 Product Workflow Data Flow Contract

This contract defines the source of truth and downstream clearing rules for V3 field capture.

## Source Of Truth

1. Layout scope defines which targets exist: external roof, internal roof, shell, and floor.
2. Layout map setup owns the approved geometry for each target.
3. Element setup selects which approved layout targets need element placement.
4. Element placement stores placed elements by target.
5. UT setup selects which approved layout targets need UT.
6. UT measurement stores plate/region UT and element UT by target and item key.
7. Findings are tied to the clicked plate/region or element item key.
8. Checklist and report export consume the saved target-keyed data.

## Default Target Order

Screens that support multiple targets should open in product order:

1. External Roof
2. Internal Roof
3. Shell
4. Floor

The user can switch targets with tabs. The opening target must not depend on stale mock data or the last saved active target.

## Downstream Clearing Rules

Layout map changes are upstream changes. If layout geometry or reference changes, affected downstream data must be cleared after warning the user.

1. Roof layout changes clear roof element placement, roof UT, and roof findings.
2. Shell layout changes clear shell element placement, shell UT, and shell findings.
3. Floor layout changes clear floor element placement, floor UT, and floor findings.
4. Tank north/reference changes clear downstream data for all approved layout targets.
5. Element add/remove/type changes clear affected element UT and affected element findings.
6. Element move/rename does not clear plate UT.
7. UT setup removal clears UT and findings for the removed target.

## Rendering Rules

Element placement and UT must render from the approved layout setup for the selected target:

1. Roof and floor use the target-specific custom circular layout when available.
2. Shell uses shell course, plate, lane, offset, and reference settings from layout map setup.
3. Stored element, UT, and finding data must remain keyed by target, not by current screen tab.
