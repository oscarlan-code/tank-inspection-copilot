# Layout Drawing Prototype

Status: isolated debug prototype for local testing. No V2 or V3 product folders are modified by the prototype implementation.

## Why This Prototype Exists

The current V3 layout generator works well for structured tank layouts, but real roof layouts can be irregular. Inspectors may prefer to sketch a roof map or import a drawing/photo, rather than manually configuring rows, columns, splits, merges, and offsets.

This prototype now focuses on one thing first: a simple roof layout drawing tool that can generate a structured plate map.

It explores two roof-map digitization paths:

1. Start from a V3-style generated base layout, then customize seams, boundaries, splits, and merges.
2. Start from a new sketch/imported roof drawing, then use assisted drafting to convert rough boundaries into structured plates.

Both paths end with:

1. Structured normalized geometry.
2. Inspector review and correction.
3. Inspector approval.
4. JSON export for future downstream product screens.

The final approved layout must be structured data, not an image.

## Isolation Rule

Do not modify current V2 or V3 product folders for this prototype.

Reference-only folders:

- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v3product/`
- `apps/field-android/docs/v3-product/`

Planned isolated prototype folders:

- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/prototype/layoutdrawing/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/prototype/layoutdrawing/`
- `apps/field-android/docs/layout-drawing-prototype/`

V3 may be copied from or referenced, but not changed directly.

## Product Principle

Recognition output must not become the source of truth by itself.

- AI or deterministic recognition proposes a structured draft.
- The inspector reviews, edits, and approves it.
- Approval makes the structured layout usable by downstream workflows.

## Proposed Workflows

```text
V3 layout base
-> editable structured geometry
-> seam/boundary adjustment
-> split/merge/refine plates
-> validation
-> inspector approval
-> structured JSON export
```

```text
New roof sketch or imported roof drawing/photo
-> grid/unit assisted drafting
-> snap/straighten/close boundary assist
-> structured plate model
-> overlay review
-> manual correction
-> approval
-> structured JSON export
```

## Prototype Screens

### 1. Prototype Home

Purpose: entry point for the isolated prototype.

Actions:

- New Roof Sketch
- Start from V3 Roof Layout
- Import Roof Drawing/Image
- View Latest Structured Layout JSON

### 2. Drawing Canvas Screen

Purpose: capture simple sketch input before recognition.

Canvas mode:

- Roof: circular boundary canvas inside a large whiteboard-like workspace.

Tools:

- Draw seam/plate boundary
- Draw circle element marker
- Partial eraser
- Add label
- Undo
- Clear
- Recognize / Convert

Assisted drafting controls:

- Excalidraw-style compact top toolbar
- Select, straight line, element, text, and erase tools
- Grid background
- Zoom in/out/reset map view
- Unit label
- Normalized grid spacing
- Optional tank diameter
- Snap on/off
- AI-assist status for angle straightening, endpoint snapping, closed-region creation, and approval gating

Important UX rule: the grid must not constrain drawing input. Inspectors can draw freehand anywhere on the canvas. Grid/snap settings are only assist inputs for later recognition/refinement, such as straightening, endpoint snapping, or inferred boundary cleanup.

Line tool rule: roof boundaries should be straight segments, not freehand curves. When the user drags a line endpoint near the tank circle or an existing endpoint, the prototype snaps it into connection so boundaries are easier to close. When snap is enabled, near-horizontal and near-vertical lines are straightened so slightly imperfect row/column sketches still become clean boundaries.

Zoom rule: inspectors can zoom in and draw row by row. Stored geometry remains normalized to the roof map, so every line drawn while zoomed in still becomes a boundary candidate for plate generation.

Selection rule: drawn objects remain editable. Choose `Select`, tap or drag a line, then drag an endpoint handle to adjust it or drag the line body to move the whole segment. Circle elements can be moved by dragging the center area and resized by dragging the radius handle.

Eraser rule: erasing a line should remove only the touched portion. A boundary line can split into two remaining fragments, and Generate Plates will use the remaining fragments as the current boundary graph.

First prototype should use Jetpack Compose `Canvas` and `pointerInput` with normalized coordinates. Android's official Compose graphics and pointer input documentation support this approach:

- https://developer.android.com/develop/ui/compose/graphics/draw/overview
- https://developer.android.com/develop/ui/compose/touch-input/pointer-input
- https://developer.android.com/develop/ui/compose/touch-input/pointer-input/drag-swipe-fling

### 3. Recognition Result Screen

Purpose: review and correct the proposed structured draft.

Behavior:

- Show original sketch/image underneath.
- Overlay recognized plate boundaries and elements.
- Show mocked confidence indicators.
- Allow selected boundary/plate nudging.
- Allow split vertical / split horizontal.
- Allow merge with adjacent plate.
- Allow plate editing:
  - plate ID
  - row/course
  - polygon or position metadata
  - adjacent plates if available
- Allow element editing:
  - type: nozzle, manhole, patch, stair, drain, unknown
  - label/name
  - attached plate ID
  - normalized coordinate

### 4. Approval / Export Screen

Purpose: validate, approve, and export structured JSON.

Validation should surface:

- missing orientation
- duplicated plate IDs
- unclosed or invalid plate boundaries
- element outside map
- invalid roof boundary or off-map geometry

Export target:

- Runtime app export should use an app-private file location.
- Development handoff can mirror/export to `apps/field-android/build/layout-drawing-prototype/latest-layout-draft.json` when run from local tooling.

An installed Android app generally cannot write directly into the repository `build/` folder at runtime, so the implementation should keep export behind an abstraction.

## Planned Data Model

`PrototypeLayoutDraft`

- `id`
- `surface`: initially `external_roof`
- `sourceType`: `sketch`, `image_import`
- `sourceImagePath` optional
- `orientation`
  - `referenceMode`
  - `northAngleDeg`
  - `zeroDegreePosition`
- `plates`
  - `id`
  - `displayLabel`
  - `surface`
  - `rowNumber` optional
  - `courseNumber` optional
  - `columnNumber` optional
  - `polygon`: normalized coordinates from `0..1`
  - `center`: normalized coordinates from `0..1`
  - `adjacentPlateIds`
  - `sourceConfidence` optional
- `elements`
  - `id`
  - `type`
  - `name`
  - `markerShape`: `circle`, `square`
  - `position`: normalized coordinates from `0..1`
  - `attachedPlateId` optional
  - `sizeLabel` optional
  - `sourceConfidence` optional
- `validation`
  - `status`
  - `errors`
  - `warnings`
- `approved`
  - `approvedAt`
  - `approvedBy`

## Recognition Architecture

Start without real AI.

Implemented seams:

- `LayoutRecognitionEngine`
- `MockLayoutRecognitionEngine`
- `PrototypeLayoutJsonCodec`
- `PrototypeLayoutValidator`
- `PrototypeLayoutExportRepository`

The first implementation should be deterministic:

- Capture strokes.
- Convert rough roof boundary strokes into a structured draft plate layout.
- Clip drawn straight-line boundaries to the circular roof, split them at intersections, connect them to the roof perimeter, and extract closed graph faces as plates.
- Generate V3-style mocked base geometry for roof.
- Generate one full-roof plate only when the sketch does not contain enough connected boundaries to form closed plates.
- Convert circle element markers into structured elements, preserving the circle radius as a prototype size label.
- For imported image, show the image and generate a mocked recognition result.
- Split/merge selected plates.
- Nudge selected plate boundaries.
- Zoom the sketch/review map without changing stored normalized geometry.

Do not call external AI unless explicitly requested.

## Implemented Prototype Files

Domain/prototype package:

- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/prototype/layoutdrawing/PrototypeLayoutModels.kt`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/prototype/layoutdrawing/PrototypeLayoutGeometry.kt`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/prototype/layoutdrawing/MockLayoutRecognitionEngine.kt`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/prototype/layoutdrawing/PrototypeLayoutValidator.kt`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/prototype/layoutdrawing/PrototypeLayoutJsonCodec.kt`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/prototype/layoutdrawing/PrototypeLayoutExportRepository.kt`

UI package:

- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/prototype/layoutdrawing/LayoutDrawingPrototypeActivity.kt`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/prototype/layoutdrawing/LayoutDrawingPrototypeScreen.kt`

Debug-only test launcher:

- `apps/field-android/app/src/debug/AndroidManifest.xml`

The debug manifest adds a separate launcher activity named `Layout Prototype` for local testing. The existing V3 launcher remains unchanged.

## Research Notes

Recommended Android input/import stack:

- Jetpack Compose Canvas for drawing and overlay review.
- Compose pointer input for drawing strokes, taps, and future drag editing.
- Android Photo Picker for image import because it avoids broad media permissions and grants access only to selected media.

Official references:

- Compose graphics: https://developer.android.com/develop/ui/compose/graphics/draw/overview
- Compose pointer input: https://developer.android.com/develop/ui/compose/touch-input/pointer-input
- Android Photo Picker: https://developer.android.com/training/data-storage/shared/photo-picker

Potential future recognition layers:

- ML Kit Digital Ink for handwritten labels, simple sketch classification, and stroke-based recognition.
- ML Kit Text Recognition v2 for labels in imported drawings/photos.
- OpenCV edge and Hough line detection for drawing seam and plate-boundary detection.
- LiteRT/TensorFlow Lite for a later custom domain model if enough labeled tank drawing/photo data exists.

Official references:

- ML Kit Digital Ink: https://developers.google.com/ml-kit/vision/digital-ink-recognition
- ML Kit Digital Ink Android: https://developers.google.com/ml-kit/vision/digital-ink-recognition/android
- ML Kit Text Recognition v2: https://developers.google.com/ml-kit/vision/text-recognition/v2
- ML Kit Text Recognition Android: https://developers.google.com/ml-kit/vision/text-recognition/v2/android
- OpenCV Java `Imgproc` line detection: https://docs.opencv.org/master/javadoc/org/opencv/imgproc/Imgproc.html
- Google AI Edge object detection: https://developers.google.com/edge/litert/libraries/modify/object_detection
- LiteRT samples: https://github.com/google-ai-edge/litert-samples

## Future Integration Path

Phase 1: isolated deterministic prototype.

- Build the isolated activity and screens.
- Export structured JSON.
- Keep all state local to the prototype.

Phase 2: recognition improvements.

- Add ML Kit text extraction for imported labels.
- Add stroke-based label recognition.
- Add deterministic line/boundary detection for imported drawings.
- Keep confidence and unresolved questions in the draft.

Phase 3: downstream product integration.

- Define a stable product layout-map contract for V4 or a future product branch.
- Map approved prototype JSON to downstream layout consumers:
  - element placement
  - UT capture
  - finding capture
  - report generation
  - coordinate mapping
  - audit trail

Phase 4: optional domain AI.

- Gather labeled tank sketches, drawings, and photos.
- Train or adapt an on-device/custom model.
- Keep model output as draft geometry with confidence and review requirements.

## Build/Test Plan For Implementation

Run:

```bash
cd apps/field-android
./gradlew :app:compileDebugKotlin
./gradlew :app:assembleDebug
```

Launch options for debug builds:

- Install/run the debug app and open the `Layout Prototype` launcher icon.
- Or start it explicitly:

```bash
adb shell am start -n ai.laiq.tankinspection/ai.laiq.tankinspection.presentation.prototype.layoutdrawing.LayoutDrawingPrototypeActivity
```

Runtime export path:

- App-private file: `layout-drawing-prototype/latest-layout-draft.json`
- The UI shows the absolute app-private path after export.

Expected deliverables for the implementation phase:

- isolated prototype Android activity/screens
- manifest entry if needed
- mock recognition engine
- JSON codec/export
- README handover doc
- no changes to V2/V3 product behavior
