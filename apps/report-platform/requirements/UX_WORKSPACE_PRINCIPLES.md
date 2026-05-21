# UX Workspace Principles

This document defines the intended UI/UX direction for the report-generation web app.

## Product feel

The product should feel as simple as ChatGPT to start using, but more controlled once the user is inside a report job.

The right interaction model is:

- conversation-led
- minimally structured
- visibly guided
- always recoverable

The user should never feel buried in enterprise UI, but they also should not be forced to manage a report through raw chat only.

## Core UX model

Use a `chat-first workspace`, not a `chat-only app`.

### The user experience should combine

- one AI interaction rail
- one structured navigation rail
- one center work surface
- one live report preview
- one interactive layout canvas

This gives the ease of chat plus the control needed for technical reporting.

## Workspace reference model

The best reference is closer to a `VS Code-style workspace` than a typical form app.

Not because this product should feel like an IDE, but because the information architecture fits the job:

- left = structured assets and report navigation
- center = the main working surface
- right = interactive AI guidance
- optional bottom = calculation details, citations, and logs

This should feel familiar, efficient, and low-friction for a technical user.

## Recommended primary layout

### Left panel

Structured inspection and report explorer.

Show:

- uploaded canonical package structure
- report sections
- template sections
- evidence and attachments
- layout scene entry points
- standards/reference shortcuts
- later, historical-report matches

This should feel more like a clean document explorer than a file manager.

Most importantly, the left panel should let the user work `section by section`.

When the user selects a section on the left:

- the center panel should load that section's active workspace
- the right AI rail should switch to that same section context
- the checklist, preview, layout, and evidence views should all follow that selection

### Center panel

Primary working surface.

This area should support two main modes:

1. `Preview mode`
2. `Layout mode`

Inside the selected section, the center panel is also the main place where the user can:

- override drafted content
- refine wording manually
- adjust section structure where allowed
- interact with checklist items
- adjust map/layout presentation
- confirm the section is ready to move forward

Preview mode should show:

- live report section rendering
- full report preview
- inline evidence jumps
- section status
- editable text areas or structured field controls for the selected section when that section supports overrides

Layout mode should show:

- shell layout
- roof layout
- later floor layout
- markers, icons, labels, and overlays
- layout-specific controls for framing, labeling, and highlighting

For text-heavy sections, the center panel should behave like an `editable document workspace`, not just a static preview.

For checklist-heavy sections, the center panel should behave like an `interactive review form`, not just a report page.

The center panel is where the user spends most of their time. It should be the dominant surface.

### Right panel

Assistant thread and action rail.

Use it for:

- asking the user for missing inputs
- explaining blockers
- confirming assumptions
- triggering section drafting
- summarizing calculations
- guiding the user through the next best step
- refining the currently selected section on command
- proposing wording, formatting, and structure improvements for the active section

The right panel should feel like Codex or ChatGPT in spirit, but grounded to the active report workspace.

The AI rail should be able to operate on the currently selected section, for example:

- `refine this section wording`
- `shorten this recommendation`
- `reformat this checklist summary`
- `improve this paragraph using the linked findings`

The AI should not edit the whole report blindly when the user is clearly focused on one section.

### Optional bottom panel

Use this only when needed for dense technical context:

- calculation details
- retrieved standards snippets
- provenance
- validation logs
- raw extracted package data

## Interaction principles

### 1. Always show what is missing

Do not make the user guess why a section is incomplete.

For each section, show:

- what data came from the app
- what still needs user input
- what calculations are pending
- what is blocked

### 2. Keep the assistant grounded

Assistant responses should feel helpful, but always tied to:

- the uploaded package
- checklist answers
- calculations
- selected report section

### 3. Preserve manual control

Users must be able to:

- override wording
- edit narrative
- adjust section formatting where supported
- reject suggested assumptions
- control final report approval

### 4. Keep the workflow progressive

The system should guide the user through:

1. upload
2. validate
3. complete missing inputs
4. run calculations
5. generate sections
6. review
7. export

At any point, the user should still be able to jump between:

- the AI conversation
- the structured explorer
- the preview
- the layout renderer

The normal working rhythm should be:

1. select a section on the left
2. review or edit it in the center
3. use the AI rail on the right to refine it
4. confirm the section is ready
5. move to the next section

### 5. Make risk visible

Show visible section states:

- `auto`
- `auto + review`
- `manual required`
- `blocked`

These states should appear both in the section navigator and the preview flow.

## UX constraints for v1

To keep the UI clean, v1 should avoid:

- dense admin dashboards
- too many tabs
- large modal-heavy forms
- hidden state transitions
- pure prompt-only report generation

## Chat behaviors

The assistant should be good at:

- asking one missing-input question at a time
- summarizing uploaded inspection data
- proposing next best actions
- explaining calculations in plain language
- warning when the report cannot be safely drafted yet

The assistant should not:

- silently invent defaults
- pretend a blocked section is ready
- bury calculations inside prose without showing the numbers

## Evidence-first UX

The user should always be able to move from narrative to evidence.

Examples:

- click a drafted shell comment -> jump to shell UT rows and findings
- click a recommendation -> see supporting calculation and source findings
- click a finding -> see attachment, location, and linked map marker

The same principle should work in reverse:

- click a map marker -> open the related evidence and drafted section
- click a shell row -> highlight it in the layout and report preview
- click a checklist item -> open the relevant section context

## Checklist UX

Checklist sections should be first-class interactive workspaces.

In checklist mode, the center panel should support:

- ticking or selecting answers
- adding short notes
- seeing linked standards or evidence context
- showing incomplete items clearly
- confirming that the checklist section is complete before moving on

Checklist UX should feel lightweight and fast, not like a bulky enterprise form.

## Section completion UX

Each section should have an explicit user action such as:

- `Confirm Section`
- `Mark Ready`
- `Continue`

That action should mean:

- required inputs for that section are present
- the user has reviewed the current content
- the system can move the workflow to the next section safely

Users should still be able to come back later and reopen a confirmed section.

## Map UX

The layout map is not decoration. It is part of the report workspace.

The user should be able to:

- inspect shell and roof locations visually
- zoom and pan
- click markers to open linked findings or measurements
- adjust presentation settings for clarity
- export a clean map snapshot into the report

The map should feel like a focused 2D technical workspace, not like a decorative viewer or a full CAD package.

## Center-surface rule

The center surface should always answer one of these questions clearly:

- `What will the report look like?`
- `Where is this issue on the tank?`
- `What evidence supports this section?`

If the center panel is trying to do more than one of those at once, the UI is becoming too complicated.

## Design tone

The design should be:

- calm
- technical
- confident
- sparse without feeling empty

Use minimal UI chrome, but keep interactive affordances obvious.
