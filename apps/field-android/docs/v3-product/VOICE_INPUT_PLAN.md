# V3 Product Voice Input Plan

Voice input is a capture feature for field efficiency and report-generation context.

The Android app records and labels raw audio. The report platform owns transcription, interpretation, section placement, reviewer editing, and final report wording.

## Current Android Behavior

- Core workflow screens show a `Voice Note` button.
- Tapping starts a local `.m4a` recording after Android microphone permission is granted.
- Tapping `Stop Voice Note` saves the recording.
- The draft state stores a `ProductVoiceNote`.
- Room mirrors the note in `v3_voice_note`.
- Export schema version `3` includes both `voiceNotes[]` and `voice_audio` attachments.

## Metadata Anchors

Every note should identify where the inspector was working:

```text
screenKey       general_info, layout_scope, layout_map_setup, element_setup, element_placement, ut_setup, ut_measurement, checklist, findings
cardKey         screen-level card or popup/card identifier
fieldKey        the field, note, rating, reading, or decision being described
targetKey       roof, shell, floor, external_roof, internal_roof when available
itemKey         plate, lane/course, nozzle, manhole, checklist item, or finding item when available
```

Current implementation:
- Most screens capture screen-level voice notes.
- Findings capture the active finding target and item.
- UT cards capture the active measurement item.
- Checklist item notes capture the checklist item number and label.
- Element edit cards capture the selected element id and label.

Next implementation:
- Layout map controls should pass the affected surface/target.

## Report Platform Expectations

The report platform should:
- Import `voiceNotes[]`.
- Resolve each note's `relativePath` through `attachments[]`.
- Transcribe `voice_audio` files server-side.
- Keep original audio as evidence.
- Attach transcript provenance to the report section or layout item.
- Allow reviewer edits before final PDF generation.

## Export Example

```json
{
  "voiceNoteId": "uuid",
  "relativePath": "v3-voice-notes/ut_measurement/2026-06-20T101112Z-uuid.m4a",
  "displayName": "UT Measurements voice note",
  "screenKey": "ut_measurement",
  "screenLabel": "UT Measurements",
  "cardKey": "screen",
  "fieldKey": "voice_note",
  "targetKey": "shell",
  "targetLabel": "Shell",
  "itemKey": "shell:L1:C3",
  "itemLabel": "L1-C3",
  "transcriptStatus": "pending_server",
  "durationMs": 12000,
  "mediaType": "audio/mp4",
  "fileExists": true
}
```
