# V3 Product Development Plan

V3 Product is the isolated lane for product-standard field capture upgrades. V2 Product remains the frozen baseline for the accepted pilot workflow and report-generation fixture work.

## Principles

- Keep V2 Beta and V2 Product untouched unless the user explicitly asks for a compatibility fix.
- Use generic `Product*` class names inside the V3 package, not copied versioned names.
- Keep the app local-first and Room-backed.
- Capture field facts and evidence; leave report formatting, transcription, and narrative generation to the report platform.
- Every export field should be traceable to a screen, target, item, user, device, and timestamp where practical.

## Active Folders

```text
apps/field-android/docs/v3-product/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v3product/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/
```

## Frozen Reference Folders

```text
apps/field-android/docs/v2-beta/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v2beta/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2beta/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v2product/
apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2product/
```

## Implemented Checkpoint

- V3 source and docs were forked into isolated folders.
- V3 Kotlin packages use `v3product`; classes use generic `Product*` names.
- V3 has its own Room database name: `laiq-field-v3-product-db`.
- Android launcher points to `ProductTaskHomeActivity`.
- Core workflow screens have a reusable voice capture overlay.
- Findings voice notes include the active finding target and item metadata.
- Export package type is `v3_product_export`.
- Export schema version is `3`.
- Local Room database version is `7`.
- Voice notes are exported both as `voiceNotes[]` and as `voice_audio` attachments.
- Checklist item notes are stored per item and exported as `inspectionChecklistItems[].itemNote`.
- UT cards, checklist items, findings, and element edit cards have scoped voice anchors.

## Voice Feature Scope

Current V3 voice capture is intentionally raw-audio-first:

- Record `.m4a` audio on the Android device.
- Store metadata in draft JSON and Room.
- Store audio files under app-local storage.
- Export audio metadata in `voiceNotes[]`.
- Export audio media references in `attachments[]`.
- Set `transcriptStatus = pending_server`.
- Defer transcription, summarization, and report placement to the report platform.

Metadata contract:

```text
voiceNoteId
relativePath
displayName
screenKey
screenLabel
cardKey
fieldKey
targetKey / targetLabel
itemKey / itemLabel
durationMs
capturedAtIso
transcriptStatus
transcriptText
mediaType
fileByteSize
fileExists
```

## Next Voice Upgrades

- Attach voice buttons directly to UT cards so `itemKey` always points to the active plate, shell lane/course, nozzle, or manhole.
- Attach voice buttons directly to checklist items and section comments.
- Attach voice buttons to element edit cards so custom element naming decisions are captured.
- Add a voice-note review list before export.
- Add delete/retake behavior for voice notes.
- Update report-platform import to create transcript jobs for each `voice_audio` attachment.

## Layout Map Upgrade Scope

Future V3 layout map work should focus on:

- More customizable shell/floor/roof map generation.
- Better orientation handling around north/east/south/west and arbitrary lane counts.
- Horizontal shell map scrolling/zooming with 0 degrees connected to 360 degrees.
- Clear downstream-data warnings when geometry changes invalidate element placement, UT, findings, or checklist assumptions.

## Validation

Run before sharing APKs:

```bash
cd apps/field-android
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/oscar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/oscar/Library/Android/sdk ./gradlew :app:compileDebugKotlin
```

Build APK after compile passes:

```bash
cd apps/field-android
env JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/oscar/Library/Android/sdk ANDROID_SDK_ROOT=/Users/oscar/Library/Android/sdk ./gradlew :app:assembleDebug
```
