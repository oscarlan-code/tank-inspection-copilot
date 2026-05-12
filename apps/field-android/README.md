# Field Android App

This folder is the real product lane for the **local-first Android tablet application**.

## Product role

- primary field runtime
- air-gapped / no live network dependency during inspection
- local capture, validation, attachment storage, and package export

## Target stack

- Kotlin
- Jetpack Compose
- local database
- local file / photo storage
- canonical package export

## Initial implementation focus

1. inspection setup
2. inspection scope
3. task board
4. shell UT
5. roof UT
6. findings + photos
7. canonical package export

## Non-goals for the first prototype

- full enterprise sync
- full iOS parity
- advanced reliability analytics
- service network workflows

## Required interfaces

This app must align to:

- `packages/canonical-schema/inspection-package.schema.json`

## Build rule

Do not copy prototype screen state from `src/concept/`.

Rebuild against the canonical product model.
