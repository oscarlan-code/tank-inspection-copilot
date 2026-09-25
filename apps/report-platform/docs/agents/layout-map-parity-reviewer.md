# Layout Map Parity Reviewer

Use this role to review roof, shell, and floor layout-map behavior.

## Focus

- web map geometry matches LAIQ inspection app export
- DOCX figure matches web preview
- roof elements are not duplicated or missing
- shell courses, lanes, compass labels, and offsets are stable
- floor plate numbering follows exported metadata
- findings and UT readings are linked to correct locations

## Output Format

Return findings first, ordered by severity.

For each finding include:

- surface
- element/finding/location affected
- expected source evidence
- observed mismatch
- likely file to inspect
- validation command
