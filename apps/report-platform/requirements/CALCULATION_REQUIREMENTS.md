# Calculation Requirements

This document defines the deterministic calculation lane for report generation.

## Principle

All engineering calculations should be performed by deterministic application code, not by the LLM.

The LLM may explain or summarize outputs, but it must not be the source of truth for:

- formulas
- thresholds
- pass/fail logic
- interval decisions

## V1 calculations

The first report-generation version should support these calculation families.

### 1. Shell corrosion rate

Inputs expected:

- original or nominal shell thickness, or accepted substitute basis
- lowest remaining shell thickness by course or selected assessment point
- years in service or time basis

Output:

- corrosion rate per assessed shell location or course

### 2. Remaining corrosion allowance

Inputs expected:

- remaining thickness
- allowable or minimum required thickness

Output:

- remaining corrosion allowance

### 3. Remaining service life

Inputs expected:

- remaining corrosion allowance
- corrosion rate

Output:

- projected remaining service life

### 4. Planned inspection interval support

Inputs expected:

- remaining service life outputs
- standards interval limits
- client interval policy

Output:

- suggested next inspection interval
- rationale flags where the interval is capped by policy or standards maximum

### 5. Minimum shell thickness calculations

Inputs expected:

- tank diameter
- service height
- material or material assumption
- shell course geometry
- service/design assumptions required by the calculation method

Output:

- minimum required shell thickness values
- comparison against measured thickness

### 6. Roof corrosion rate support

Inputs expected:

- highest/lowest accepted roof thickness readings or original thickness if known
- years in service
- allowable minimum basis

Output:

- roof corrosion rate
- remaining service life estimate

## Later-phase calculations

These should be planned now but not treated as v1 blockers:

- shell nozzle assessment support
- bottom/floor corrosion rate models
- settlement-derived severity metrics
- roundness/plumbness interpretation support
- recommendation ranking logic

## Formula governance

For each implemented formula, the codebase should keep:

1. formula identifier
2. input definitions
3. units
4. output definitions
5. standards or engineering-reference note
6. test cases

## Missing-input behavior

If required inputs are absent, the system must not fabricate them.

Instead it should mark the calculation as:

- `ready`
- `needs inspector input`
- `needs engineering assumption`
- `blocked`

## LLM boundary

The LLM may produce:

- plain-language explanation of the result
- section narrative around the result
- comparison summaries

The LLM may not:

- choose formulas
- infer absent required thickness inputs without explicit user approval
- override deterministic results
