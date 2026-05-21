# Layout Rendering Strategy

The report platform needs a dedicated layout-rendering subsystem.

The Android app exports location context and geometry clues, but the web platform should render richer, larger, and more controllable technical layouts for report use.

The sample IRS reports are the visual benchmark:

- clean 2D engineering linework
- crisp labels
- simple but informative icons
- printable report-ready diagrams

## Why a dedicated renderer is needed

The report platform must do more than show static points.

It needs to support:

- shell lane rendering
- shell course context
- roof plate / sector / ring rendering
- nozzle and feature icons
- finding markers
- linked evidence locations
- inspector-friendly visual adjustments
- clean export into report output

## Product rule

This is not a geographic map problem.

It is a domain-specific engineering diagram problem.

That means generic web-mapping stacks such as Leaflet or Mapbox should not be the default choice.

## Recommended architecture

Split the rendering subsystem into three layers.

### 1. Geometry derivation layer

Input:

- canonical package
- normalized report workspace data
- optional inspector overrides

Output:

- deterministic geometry objects such as:
  - shell lines
  - courses
  - roof plates
  - roof sectors/rings
  - nozzle anchors
  - finding anchors

This layer should be pure and testable.

### 2. Scene assembly layer

Turn geometry into a render scene:

- shapes
- labels
- icons
- overlays
- highlighted selections
- severity styles

Suggested scene concepts:

- `SceneLayer`
- `SceneShape`
- `SceneMarker`
- `SceneLabel`
- `SceneViewport`

### 3. Presentation layer

Render the scene for:

- interactive workspace exploration
- evidence review
- report preview
- export snapshots

Within the main app, this renderer should live in the `center work surface`, alongside report preview mode.

## Recommended third-party tool choice

### V1 recommendation

Use:

- custom SVG renderer in React
- `d3-zoom` for pan/zoom interaction

Why this is the best starting point:

- SVG is vector-accurate and prints/export well
- DOM-backed elements make highlighting and click targeting straightforward
- engineering layouts usually benefit from crisp linework and text
- exported SVG can flow more cleanly into HTML/PDF report output
- `d3-zoom` works with SVG and supports direct manipulation, scale limits, translate limits, touch, and programmatic transforms
- the layout needs CAD-like clarity, but not full CAD complexity

Official references:

- `d3-zoom`: https://d3js.org/d3-zoom

### V2 optional editor-mode tool

If later we need heavier editing behaviors such as drag handles, free placement, grouped transforms, or dense object manipulation, evaluate:

- `react-konva` / `Konva`

Why it is a secondary option rather than the first choice:

- Konva is strong for interactive 2D canvas graphics and object interaction
- but canvas is less naturally aligned with crisp report-print vector output than SVG-first rendering
- for a reporting product, render fidelity and exportability matter from day one

Official references:

- React Konva docs: https://konvajs.org/docs/react/
- Konva overview: https://konvajs.org/docs/index.html

### Why not Fabric.js first

Fabric.js is a capable canvas abstraction and interaction layer, but it is a weaker first fit for this problem because:

- this product needs precise technical diagram output more than freeform canvas authoring
- SVG-first export and report integration are more important than general canvas editing in v1

Official reference:

- Fabric.js overview: https://fabricjs.com/docs/why-fabric/

## Recommended UX capabilities

The first renderer should support:

- zoom in / out
- pan
- fit-to-view
- layer toggles
- highlight selected item
- severity color states
- marker hover details
- click-through to linked findings and rows
- export current clean view
- optional split view with report preview
- reset / fit view
- measurement or finding focus mode

## Recommended scene variants

The renderer should support at least these views:

### Shell view

- circumference as unwrapped or circular view
- lines/lanes
- course boundaries
- shell nozzles
- finding markers
- selected row emphasis

### Roof view

- template-specific geometry
- plates/sectors/rings
- roof nozzles
- roof features
- finding markers
- selected measurement emphasis

### Floor view later

Keep the subsystem extensible for future floor workflows even though floor UT and MFL are deferred for now.

## Icon and detail system

The renderer should use a consistent icon system for:

- shell nozzles
- roof nozzles
- roof features
- findings by severity
- selected measurements
- linked evidence

Icons should be accurate enough for technical use, but visually simple enough to stay readable at report scale.

## User-controlled presentation

The renderer should let the user make the drawing easier to understand without turning it into a complicated CAD editor.

This means supporting:

- show / hide labels
- show / hide finding markers
- show / hide nozzle markers
- severity filtering
- selected-item emphasis
- exported snapshot framing

This does not mean supporting arbitrary drawing or freeform shape editing in v1.

## Customization controls

Users should be able to adjust map presentation without corrupting source geometry.

Allowed user customization should include:

- marker size
- label visibility
- layer visibility
- severity filtering
- icon density
- highlight mode
- snapshot framing

Do not let visual customization mutate the underlying inspection coordinates.

## Guard rails for rendering

- geometry should come from deterministic code
- map snapshots should include versioned scene metadata
- markers should preserve links back to workspace entities
- unsupported geometry should degrade visibly, not silently disappear

## Implementation sequence

1. Define geometry models
2. Build shell renderer
3. Build roof renderer
4. Add marker/icon system
5. Add selection/highlight behavior
6. Add export snapshot path
7. Add user customization controls
