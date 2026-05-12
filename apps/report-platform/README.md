# Report Platform

This folder is the real product lane for the **connected reporting platform**.

## Product role

- ingest canonical inspection packages
- validate package completeness and schema
- generate report previews and drafts
- keep inspection history online

## Platform responsibilities

1. package upload
2. package validation
3. report section mapping
4. report preview / draft generation
5. archive and search

## Inputs

The platform accepts the canonical package defined in:

- `packages/canonical-schema/inspection-package.schema.json`

## First prototype scope

- upload one package
- validate against schema
- render:
  - tank summary
  - shell UT table
  - roof UT table
  - findings register
  - linked evidence list

## Build rule

The platform should consume a stable package contract, not browser-local prototype state.
