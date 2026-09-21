# Capture Variant Builder Continuation Marker - 2026-08-11

Date: 2026-08-11 (Asia/Singapore)

Canonical repository:

`/Users/oscar/Code/tank-inspection-coplilot-app`

Do not continue this work in `/Users/oscar/Documents/oscar-code/`.

## Completed Before Reboot

- Added PostgreSQL migration `017_capture_variant_builder.sql`.
- Added eight faithful Capture Variant profile presets.
- Added deterministic Capture Scenario generation in `server/training-harness.mjs`.
- Added protected-fact handling for measurements, units, identities, severity, geometry, and photo linkage.
- Added Capture Variant persistence, fact links, expected-missing-input labels, detail loading, manifest building, and approval locking.
- Exposed Capture Variant methods through `server/store.mjs`.
- Added Super Admin Capture Variant list, generation, detail, and S3 approval routes in `server/index.mjs`.
- Confirmed `server/training-harness.mjs` and `server/index.mjs` pass `node --check`.

## Not Yet Completed

1. Add `src/lib/captureVariantApi.ts`.
2. Add the live `CaptureVariantBuilder.tsx` Stage 3 UI.
3. Replace Evaluation Lab `Evidence Pairing` navigation with `Capture Variants` while preserving any interim compatibility API internally.
4. Add Capture Variant CSS and responsive visual review.
5. Extend storage/static/API audits for the new migration, simulator, routes, S3 manifest, and immutability behavior.
6. Run migration against the disposable PostgreSQL audit schema before relying on staging.
7. Run build, logic, architecture, storage, API, strict leak, and browser tests.
8. Update `TRAINING_HARNESS_ARCHITECTURE.md`, `EVAL_SYSTEM.md`, `PRODUCT_TERMINOLOGY.md`, `SYSTEM_ARCHITECTURE.md`, and `README.md` only after tests confirm actual readiness.

## Important Safety Boundary

The report platform generates a versioned `laiq_capture_scenario` manifest. It must not fabricate a final V3 app export directly. The LAIQ inspection app owns materializing the scenario and producing the real `v3_product_export` through App Round Trip.

## Current Validation

```text
node --check server/training-harness.mjs  PASS
node --check server/index.mjs             PASS
```

Full product validation has not run yet because implementation was intentionally stopped for reboot.
