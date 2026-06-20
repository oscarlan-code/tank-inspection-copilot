# V3 Product

V3 Product is the isolated Android product lane for the next inspection workflow upgrades.

It was forked from the accepted Product workflow, but V3 code should use generic `Product*` class names inside the `v3product` packages so future refinements do not carry confusing versioned symbols through the codebase.

## Boundaries

Frozen areas:
- `apps/field-android/docs/v2-beta/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v2beta/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2beta/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v2product/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/v2product/`

Active V3 areas:
- `apps/field-android/docs/v3-product/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/presentation/v3product/`
- `apps/field-android/app/src/main/java/ai/laiq/tankinspection/v3product/`

## Current Direction

V3 starts from the accepted field workflow and adds product-standard upgrades in isolation:
- voice note capture across core inspection screens
- richer layout-map customization in later phases
- schema version 3 export packages for report-platform ingestion
- raw audio evidence plus metadata, with transcription and interpretation handled by the report platform

## Voice Capture Contract

The Android app records audio locally and stores metadata that tells the report platform where the note belongs.

Export shape:
- `voiceNotes[]` contains screen, card, target, item, duration, transcript status, and file metadata.
- `attachments[]` also includes each audio file as `kind = "voice_audio"`.
- Audio is recorded as `.m4a` / `audio/mp4`.
- `transcriptStatus` starts as `pending_server`; the app does not perform AI transcription on-device.

## Storage

V3 uses its own Room database:

```text
laiq-field-v3-product-db
```

Room schema:

```text
apps/field-android/app/schemas/ai.laiq.tankinspection.v3product.storage.db.ProductFieldDatabase/
```

The current local database version is `7`; the current export package schema version is `3`.

## Launcher

The debug app launcher now opens:

```text
ai.laiq.tankinspection.v3product.taskhome.ProductTaskHomeActivity
```

The previous product activity remains registered for compatibility but no longer owns the launcher intent.

## Next V3 Work

Recommended order:
- Verify voice recording on physical device, including runtime microphone permission and saved export JSON.
- Add layout-map control-level voice anchors where a note needs to attach to a specific map setting.
- Refine layout-map generation and customization without changing V2 Product or V2 Beta.
- Update report-platform import fixtures to consume `voiceNotes[]` and `voice_audio` attachments.
