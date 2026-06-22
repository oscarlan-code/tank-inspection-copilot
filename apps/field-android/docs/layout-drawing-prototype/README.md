# Layout Drawing Prototype Plan

Status: plan only. No V2 or V3 product behavior should change as part of this planning commit.

## Why This Prototype Exists

The current V3 layout generator works well for structured tank layouts, but real tank layouts can be irregular. Inspectors may prefer to sketch a roof, floor, or shell map, or import a drawing/photo, rather than manually configuring rows, columns, splits, merges, and offsets.

This prototype explores a separate layout-map digitization path:

1. Capture a sketch or imported drawing/photo.
2. Recognize seams, plate boundaries, labels, orientation marks, and elements.
3. Convert recognition output into structured normalized geometry.
4. Let the inspector review and correct the draft.
5. Approve the structured layout.
6. Export JSON for future downstream product screens.

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

## Proposed Workflow

```text
Drawing/photo input
-> recognition/digitization
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

- Start Roof/Floor Sketch
- Start Shell Sketch
- Import Drawing/Image
- View Latest Structured Layout JSON

### 2. Drawing Canvas Screen

Purpose: capture simple sketch input before recognition.

Canvas modes:

- Roof/floor: circular boundary canvas.
- Shell: unwrapped rectangular shell canvas.

Tools:

- Draw seam/plate boundary
- Draw element marker
- Eraser
- Add label
- Undo
- Clear
- Recognize / Convert

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
- shell 0/360 edge mismatch

Export target:

- Runtime app export should use an app-private file location.
- Development handoff can mirror/export to `apps/field-android/build/layout-drawing-prototype/latest-layout-draft.json` when run from local tooling.

An installed Android app generally cannot write directly into the repository `build/` folder at runtime, so the implementation should keep export behind an abstraction.

## Planned Data Model

`PrototypeLayoutDraft`

- `id`
- `surface`: `external_roof`, `internal_roof`, `floor`, `shell`
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

Planned seams:

- `LayoutRecognitionEngine`
- `MockLayoutRecognitionEngine`
- `PrototypeLayoutJsonCodec`
- `PrototypeLayoutValidator`
- optional future `PrototypeLayoutExportRepository`

The first implementation should be deterministic:

- Capture strokes.
- Convert simple shell vertical/horizontal line strokes into rough courses and plate columns.
- Generate mocked circular roof/floor plate geometry.
- Convert element marker taps into structured elements.
- For imported image, show the image and generate a mocked recognition result.

Do not call external AI unless explicitly requested.

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

After implementation, run:

```bash
cd apps/field-android
./gradlew :app:compileDebugKotlin
./gradlew :app:assembleDebug
```

Expected deliverables for the implementation phase:

- isolated prototype Android activity/screens
- manifest entry if needed
- mock recognition engine
- JSON codec/export
- README handover doc
- no changes to V2/V3 product behavior
