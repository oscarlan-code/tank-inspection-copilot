# Canonical Schema

This folder holds the **versioned inspection-package contract** between:

- the local-first field app
- the connected reporting platform

## Why this exists

The field app should not upload arbitrary UI state.

It should export one stable, versioned canonical package that contains:

- inspection metadata
- tank master
- layouts
- measurement rows
- findings
- attachments
- review status

## Files

- `inspection-package.schema.json`
- `examples/minimal-inspection-package.json`

## Build rule

Field capture, report generation, and later integrations must all anchor to this contract.
