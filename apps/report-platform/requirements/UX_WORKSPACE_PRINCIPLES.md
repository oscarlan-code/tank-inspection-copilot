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

- one central assistant thread
- one compact structured side panel
- one live report preview
- one interactive layout canvas

This gives the ease of chat plus the control needed for technical reporting.

## Recommended primary layout

### Center panel

Assistant thread and task composer.

Use it for:

- asking the user for missing inputs
- explaining blockers
- confirming assumptions
- triggering section drafting
- summarizing calculations

### Right panel

Structured workspace status.

Show:

- missing inputs
- checklist progress
- calculation readiness
- section status
- validation warnings

This should stay visible and lightweight.

### Left rail or top rail

Report navigation.

Show:

- report sections
- current section state
- evidence/library shortcuts
- layout map entry points

### Preview area

Live rendered report section view or full report preview.

The user should be able to compare:

- raw evidence
- generated draft
- rendered report output

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

## Map UX

The layout map is not decoration. It is part of the report workspace.

The user should be able to:

- inspect shell and roof locations visually
- zoom and pan
- click markers to open linked findings or measurements
- adjust presentation settings for clarity
- export a clean map snapshot into the report

## Design tone

The design should be:

- calm
- technical
- confident
- sparse without feeling empty

Use minimal UI chrome, but keep interactive affordances obvious.
