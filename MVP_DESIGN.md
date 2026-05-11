# Tank Inspection Copilot MVP Design

## Locked decisions

- Default workflow is `coarse`.
- `Fine` mode is optional and user-invoked.
- `Shell` is the only surface with precise location in MVP.
- `Roof` and `Nozzle` support inline findings, but no precise location in MVP.
- `Bottom` is `MFL import only` in MVP.
- Findings discovered during a task are captured inside that task to avoid duplicate entry later.
- Finding flow is photo-first:
  1. Take photo
  2. Annotate photo
  3. Define type / severity
  4. Add measurements
  5. Save and return to task

## MVP screen inventory

### 1. Home
- Purpose: start or resume inspection
- Entry: app launch
- Main content:
  - New inspection
  - Resume draft
  - Past exports
- Primary actions:
  - `New Inspection`
  - `Resume Draft`

### 2. Inspection Setup
- Purpose: capture minimum tank info
- Required fields:
  - Client
  - Location
  - Tank number
  - Diameter
  - Height
  - Total shell courses
  - Roof type
- Optional section:
  - More tank details
- Primary actions:
  - `Continue`
  - `Save Draft`

### 3. Inspection Scope
- Purpose: confirm reference style and task scope
- Required fields:
  - Reference direction
  - Shell location style
  - Selected tasks
- Optional fields:
  - Reference marker description
  - Nozzle inspection scope
- Primary actions:
  - `Continue`
  - `Save Draft`

### 4. Task Board
- Purpose: active inspection hub
- Main content:
  - Task cards
  - Setup summary
- Tasks:
  - Shell UT
  - Roof UT
  - Shell nozzle UT
  - Roof nozzle UT
  - Bottom MFL
  - Findings / Photos
  - Review
- Primary actions:
  - `Start`
  - `Continue`

### 5. Shell UT
- Purpose: capture routine shell UT
- Required fields:
  - Strake
  - Bearing
  - Readings 1-5
- Optional:
  - Note
  - Photo
- Actions:
  - `Save & Next`
  - `Add Finding Here`
  - `Back to Tasks`

### 6. Shell Inline Finding
- Purpose: document abnormality found during shell UT
- Entry: from `Shell UT`
- Required flow:
  1. Take photo
  2. Define type
  3. Define severity
- Optional:
  - Photo annotation
  - Note
  - Measurements
  - Precise shell location
- Actions:
  - `Save Finding`
  - `Save Finding & Add Precise Location`
  - `Cancel`

### 7. Shell Layout Setup
- Purpose: configure shell layout for fine shell findings
- Entry: from `Shell Inline Finding` if precise location is requested and no layout exists
- Required fields:
  - Plate width
  - Seam origin
  - Seam offset rule
- Prefilled:
  - Shell course count
  - Shell height
- Actions:
  - `Save Layout & Continue`
  - `Back`

### 8. Shell Precise Location
- Purpose: mark exact shell defect location
- Entry: from `Shell Inline Finding` or `Shell Layout Setup`
- Methods:
  - Tap layout
  - Manual X,Y
  - Plate / seam reference
- Actions:
  - `Save Precise Location`
  - `Use Coarse Location Instead`
  - `Back`

### 9. Roof UT
- Purpose: capture routine roof UT
- Required fields:
  - Plate number
  - Readings A-E
- Optional:
  - Note
  - Photo
- Actions:
  - `Save & Next`
  - `Add Finding Here`
  - `Back to Tasks`

### 10. Roof Inline Finding
- Purpose: document abnormality found during roof UT
- Entry: from `Roof UT`
- Required flow:
  1. Take photo
  2. Define type
  3. Define severity
- Optional:
  - Photo annotation
  - Note
  - Measurements
- Actions:
  - `Save Finding`
  - `Cancel`

### 11. Shell Nozzle UT
- Purpose: capture routine shell nozzle UT
- Required fields:
  - Nozzle ID
  - Nozzle size
  - 12 / 3 / 6 / 9
  - Reinforcement pad
- Optional:
  - Note
  - Photo
- Actions:
  - `Save & Next`
  - `Add Finding Here`
  - `Back to Tasks`

### 12. Shell Nozzle Inline Finding
- Purpose: document abnormality found during shell nozzle UT
- Entry: from `Shell Nozzle UT`
- Required flow:
  1. Take photo
  2. Define type
  3. Define severity
- Optional:
  - Photo annotation
  - Note
  - Measurements
- Actions:
  - `Save Finding`
  - `Cancel`

### 13. Roof Nozzle UT
- Purpose: capture routine roof nozzle UT
- Required fields:
  - Nozzle ID
  - Nozzle size
  - N / E / S / W
  - Reinforcement pad
- Optional:
  - Note
  - Photo
- Actions:
  - `Save & Next`
  - `Add Finding Here`
  - `Back to Tasks`

### 14. Roof Nozzle Inline Finding
- Purpose: document abnormality found during roof nozzle UT
- Entry: from `Roof Nozzle UT`
- Required flow:
  1. Take photo
  2. Define type
  3. Define severity
- Optional:
  - Photo annotation
  - Note
  - Measurements
- Actions:
  - `Save Finding`
  - `Cancel`

### 15. Bottom MFL
- Purpose: import bottom inspection source data
- Required fields:
  - Contractor
  - Report reference
  - Report date
  - Coverage
  - Severity
  - Attachment
- Optional:
  - Flagged areas count
  - Summary note
- Actions:
  - `Save MFL`
  - `Back to Tasks`

### 16. Findings / Photos
- Purpose: view and manage all findings created from tasks
- Main content:
  - Findings list
  - Filter by task / severity / status
- Actions:
  - `Open Finding`
  - `Back to Tasks`

### 17. Review
- Purpose: check completeness and warnings
- Main content:
  - Task status
  - Missing items
  - Warnings
  - Findings summary
- Actions:
  - `Continue to Export`
  - `Back to Tasks`
  - `Save Draft`

### 18. Export
- Purpose: produce structured output
- Main content:
  - Inspection summary
  - Warning summary
  - Export options
- Actions:
  - `Export JSON`
  - `Export CSV`
  - `Finish`

## First prototype priority

### Must-have
- Home
- Inspection Setup
- Inspection Scope
- Task Board
- Shell UT
- Shell Inline Finding
- Shell Layout Setup
- Shell Precise Location
- Review
- Export

### Phase 2
- Roof UT
- Roof Inline Finding
- Bottom MFL
- Findings / Photos

### Phase 3
- Shell Nozzle UT
- Shell Nozzle Inline Finding
- Roof Nozzle UT
- Roof Nozzle Inline Finding

## Shared task pattern

1. Task entry screen
2. Inline finding screen
3. Fine location branch only where justified

For MVP:
- Shell has fine location
- Roof does not
- Nozzle does not

## Wireframe spec: Inspection Setup

### Screen goal
- Capture the minimum tank information required to begin an inspection.
- Keep the screen short and field-friendly.
- Hide non-essential report fields behind an expandable section.

### Page structure

1. Top bar
- Back
- Title: `New Inspection`

2. Intro block
- Heading: `Required Tank Info`
- Helper text: `Enter the key tank details first. Add more information only if needed.`

3. Section: `Tank Identity`
- Field: `Client`
  - Type: text
  - Placeholder: `e.g. Petronas Carigali`
- Field: `Location`
  - Type: text
  - Placeholder: `e.g. Kerteh, Terengganu`
- Field: `Tank Number`
  - Type: text
  - Placeholder: `e.g. 5470`

4. Section: `Dimensions`
- Field: `Diameter (m)`
  - Type: numeric
  - Placeholder: `e.g. 26.5`
- Field: `Height (m)`
  - Type: numeric
  - Placeholder: `e.g. 10.0`
- Field: `Total Shell Courses`
  - Type: numeric
  - Placeholder: `e.g. 6`

5. Section: `Roof Configuration`
- Field: `Roof Type`
  - Type: dropdown
  - Options:
    - Fixed Cone Roof
    - Fixed Dome Roof
    - Umbrella Roof
    - External Floating Roof
    - Internal Floating Roof
    - Double Deck Floating Roof
    - Other
- Conditional field when `Other` selected:
  - Label: `Describe Roof Type`
  - Type: text
  - Placeholder: `Enter roof description`

6. Expandable section: `More Tank Details`
- Default state: collapsed
- Content:
  - Client Representative
  - Field / Lease Name
  - Year Built
  - Original Manufacturer
  - Original Construction Standard
  - Material Spec
  - Construction Type
  - Drawing Ref
  - Service Height
  - Product Stored
  - Specific Gravity
  - Design Temp
  - Internal Pressure
  - Wind Girder
  - Insulated
  - Stiffener
  - Total Roof Plates

7. Sticky footer
- Secondary action: `Save Draft`
- Primary action: `Continue`

### Fields intentionally excluded from this screen
- Total floor plates
- Floor plate thickness
- Total annular plates
- Annular plate thickness
- MFL details
- Layout setup details

### Validation
- Required:
  - Client
  - Location
  - Tank Number
  - Diameter
  - Height
  - Total Shell Courses
  - Roof Type
- Numeric validation:
  - Diameter > 0
  - Height > 0
  - Total Shell Courses >= 1
- `Continue` stays disabled until required fields are valid.

### Interaction rules
- Optional section stays collapsed by default.
- Selecting `Roof Type` only stores topology for later screens.
- No layout setup is triggered from this screen.
- Returning to edit should preserve previously entered values.

### Mobile/tablet behavior
- Single-column layout on mobile
- Two-column grouping may be used on tablet for:
  - Diameter / Height
  - optional boolean fields in `More Tank Details`

### Success path
- `Continue` -> `Inspection Scope`

## Wireframe spec: Inspection Scope

### Screen goal
- Confirm how the inspection will be referenced in the field.
- Let the user select only the tasks that are actually in scope.
- Keep setup light by avoiding layout geometry, nozzle registry, or other deep configuration at this stage.

### Page structure

1. Top bar
- Back
- Title: `Inspection Scope`

2. Intro block
- Heading: `Choose Inspection Scope`
- Helper text: `Set the inspection reference and select the tasks for this job. Detailed setup can be added later only when needed.`

3. Section: `Reference`
- Field: `Reference Direction`
  - Type: segmented control or radio group
  - Options:
    - True North
    - Plant North
    - Site Reference Marker
- Conditional field when `Site Reference Marker` selected:
  - Label: `Reference Marker Description`
  - Type: text
  - Placeholder: `e.g. Ladder side marker`
- Field: `Shell Location Style`
  - Type: segmented control
  - Default: `Compass`
  - Options:
    - Compass
    - Degrees
- Helper text under `Shell Location Style`:
  - `Compass is recommended for routine coarse shell UT.`

4. Section: `Tasks In Scope`
- Field: `Shell UT`
  - Type: toggle card
- Field: `Roof UT`
  - Type: toggle card
- Field: `Shell Nozzles`
  - Type: toggle card
- Field: `Roof Nozzles`
  - Type: toggle card
- Field: `Bottom MFL Import`
  - Type: toggle card
  - Helper text: `Import only in MVP`
- Field: `Findings / Photos`
  - Type: toggle card
  - Helper text: `Recommended`

5. Sticky footer
- Secondary action: `Save Draft`
- Primary action: `Continue`

### Fields intentionally excluded from this screen
- Full nozzle registry
- Shell layout geometry
- Roof layout setup
- Plate numbering setup
- MFL report details
- Any calculation settings

### Validation
- Required:
  - Reference Direction
  - Shell Location Style
  - At least one task selected
- Conditional validation:
  - `Reference Marker Description` is required when `Site Reference Marker` is selected
- `Continue` stays disabled until required fields are valid.

### Interaction rules
- `Compass` is preselected by default.
- This screen does not trigger fine layout setup.
- This screen does not ask the user to build a nozzle list.
- `Bottom MFL Import` is treated as an attachment/import task, not a manual floor workflow.
- Returning to edit should preserve previously entered values.

### Mobile/tablet behavior
- Single-column layout on mobile
- Task toggles can use a two-column grid on tablet
- Footer actions stay sticky for quick progression

### Success path
- `Continue` -> `Task Board`

## Wireframe spec: Task Board

### Screen goal
- Act as the main hub for an active inspection.
- Let the inspector understand job context, task progress, and next actions at a glance.
- Keep the screen operational, not report-like.

### Page structure

1. Top bar
- Back or Home
- Title: active tank label
  - Example: `Tank 5470`
- Secondary action: `Save Draft`

2. Job summary card
- Purpose: show only the minimum context needed before entering tasks
- Content:
  - Client
  - Location
  - Tank Number
  - Roof Type
  - Inspection Date
- Secondary action:
  - `Edit Setup`

3. Section: `Tasks`
- Helper text: `Continue the selected inspection tasks.`
- Show only the tasks selected in `Inspection Scope`

4. Task cards
- Card: `Shell UT`
  - Status badge:
    - Not started
    - In progress
    - Ready
    - Needs attention
  - Meta:
    - reading count
    - finding count
  - Primary action:
    - `Start` or `Continue`
- Card: `Roof UT`
  - Same structure
- Card: `Shell Nozzles`
  - Same structure
- Card: `Roof Nozzles`
  - Same structure
- Card: `Bottom MFL`
  - Meta:
    - attachment status
    - flagged area count if available
  - Primary action:
    - `Start` or `Continue`
- Card: `Findings / Photos`
  - Meta:
    - total findings
    - high severity count
  - Primary action:
    - `Open`
- Card: `Review`
  - Meta:
    - warning count
    - completed task count
  - Primary action:
    - `Open`

5. Optional bottom navigation for tablet or larger screens
- `Tasks`
- `Review`
- `Export`

### Task card rules
- Only show tasks that were enabled in `Inspection Scope`
- `Findings / Photos` and `Review` should remain visible even if not explicitly selected, because they are cross-task utilities
- `Start` is shown when a task has no records yet
- `Continue` is shown when a task already has records
- `Needs attention` is used when:
  - a linked finding is incomplete
  - a required photo is missing
  - a required MFL attachment is missing
  - the user left a task with incomplete required fields

### Fields intentionally excluded from this screen
- Detailed report prose
- Large progress analytics
- Calculation results
- Layout previews
- Deep finding details
- Export configuration

### Interaction rules
- Tapping a task card opens that task directly
- Returning from any task returns the user to this screen
- `Edit Setup` opens `Inspection Setup`
- Review is always accessible, even if tasks are incomplete
- Export is not a primary action from this screen in MVP

### Mobile/tablet behavior
- Single-column card stack on mobile
- Two-column card grid may be used on tablet
- Summary card remains compact and fixed near the top
- Primary task actions stay visible without needing to open each card

### Success paths
- `Shell UT` card -> `Shell UT`
- `Roof UT` card -> `Roof UT`
- `Shell Nozzles` card -> `Shell Nozzle UT`
- `Roof Nozzles` card -> `Roof Nozzle UT`
- `Bottom MFL` card -> `Bottom MFL`
- `Findings / Photos` card -> `Findings / Photos`
- `Review` card -> `Review`

## Wireframe spec: Shell UT

### Screen goal
- Support fast, repeatable coarse shell thickness entry.
- Match the routine shell UT pattern used in inspection reports.
- Let the inspector capture a finding immediately without leaving the task flow.

### Page structure

1. Top bar
- Back to `Task Board`
- Title: `Shell UT`
- Secondary action: `Save Draft`

2. Context bar
- Tank Number
- Total Shell Courses
- Shell Location Style
- Helper text:
  - `Routine entry uses coarse location by strake and bearing.`

3. Entry section: `Location`
- Field: `Strake`
  - Type: dropdown
  - Options:
    - `Strake 1`
    - `Strake 2`
    - up to configured course count
- Field: `Bearing`
  - Type:
    - segmented control when `Compass`
    - numeric input when `Degrees`
  - Compass options:
    - `N`
    - `E`
    - `S`
    - `W`
  - Degrees placeholder:
    - `e.g. 90`

4. Entry section: `Readings`
- Field: `Reading 1`
  - Type: numeric
- Field: `Reading 2`
  - Type: numeric
- Field: `Reading 3`
  - Type: numeric
- Field: `Reading 4`
  - Type: numeric
- Field: `Reading 5`
  - Type: numeric
- Optional field: `Quick Note`
  - Type: text area
  - Placeholder: `Optional note about this UT point`
- Optional field: `Photo`
  - Type: add photo action

5. Derived summary card
- Visible after at least one valid reading is entered
- Content:
  - `Min`
  - `Mean`
  - `Max`

6. Primary actions row
- Primary action: `Save & Next`
- Secondary action: `Add Finding Here`

7. Recent entries section
- Heading: `Recent Shell UT Entries`
- Content per row:
  - Strake
  - Bearing
  - Min value
  - optional finding badge
- Row action:
  - `Edit`

### Field rules
- `Strake` is required
- `Bearing` is required
- At least one reading is required
- All entered readings must be numeric
- If `Degrees` is used:
  - valid range is `0` to `< 360`
- Empty reading boxes are allowed during entry, but the form cannot be saved with zero readings

### Interaction rules
- `Save & Next` saves the current UT row and advances the workflow
- If `Compass` is selected:
  - next bearing order is `N -> E -> S -> W`
  - after `W`, prompt the user to move to the next strake
- If `Degrees` is selected:
  - keep the same strake and clear only the reading fields after save
- `Add Finding Here` opens the inline shell finding flow with current shell UT context prefilled
- Inline finding should not force the user to re-enter strake, bearing, or UT reference
- Returning from a saved finding returns to this screen

### Findings behavior from this screen
- Findings discovered during shell UT are created from this screen
- The finding is linked to the current shell UT row
- Finding flow is:
  1. Take photo
  2. Annotate photo
  3. Define type / severity
  4. Add measurements
  5. Optional precise shell location
  6. Save and return to `Shell UT`

### Fields intentionally excluded from this screen
- Shell layout setup
- Precise shell map
- Calculation details beyond Min / Mean / Max
- Full defect form
- Report narrative text

### Mobile/tablet behavior
- Single-column form on mobile
- Reading fields can use a compact two-column arrangement on tablet
- `Save & Next` and `Add Finding Here` stay visible near the bottom
- Recent entries list stays below the entry form, not in a side panel, for MVP

### Success paths
- `Save & Next` -> next shell UT entry on the same screen
- `Add Finding Here` -> `Shell Inline Finding`
- Back -> `Task Board`

## Wireframe spec: Shell Inline Finding

### Screen goal
- Let the inspector document an abnormality immediately from `Shell UT`.
- Keep the flow evidence-first so the issue is not lost in the field.
- Avoid duplicate data entry later in `Findings / Photos`.

### Page structure

1. Top bar
- Back to `Shell UT`
- Title: `Shell Finding`

2. Context card
- Surface: `Shell`
- Strake
- Bearing
- Linked shell UT reference

3. Step 1: `Capture Evidence`
- Primary action: `Take Photo`
- Secondary action: `Choose Existing Photo`
- Rule:
  - at least one photo is required before save

4. Step 2: `Annotate Photo`
- Tools:
  - arrow
  - circle
  - freehand mark
  - short text label
- Secondary action:
  - `Skip Annotation`

5. Step 3: `Finding Details`
- Field: `Finding Type`
  - Options:
    - Crack
    - Localized Corrosion / Pitting
    - General Thinning
    - Deformation
    - Weld Concern
    - Coating Failure
    - Repair Observation
    - Other
- Field: `Severity`
  - Options:
    - Low
    - Medium
    - High
- Field: `Short Note`
  - Type: text area
  - Placeholder: `Describe what was observed`

6. Step 4: `Measurements`
- Dynamic fields based on finding type
- Examples:
  - Crack length
  - Crack width
  - Pit depth
  - Affected area size
- Secondary action:
  - `Skip Measurements`

7. Bottom actions
- Primary action: `Save Finding`
- Secondary action: `Save Finding & Add Precise Location`
- Tertiary action: `Cancel`

### Field rules
- At least one photo is required
- `Finding Type` is required
- `Severity` is required
- If `Finding Type = Crack`:
  - `Short Note` is required
  - `Save Finding & Add Precise Location` should be visually emphasized

### Interaction rules
- The finding inherits shell context from the current UT row
- The user should not re-enter strake, bearing, or task source
- `Save Finding` returns to `Shell UT`
- `Save Finding & Add Precise Location` moves into the shell fine-location flow

### Fields intentionally excluded from this screen
- Shell layout setup parameters
- Full shell map
- Report recommendation text
- Any unrelated task data

### Success paths
- `Save Finding` -> `Shell UT`
- `Save Finding & Add Precise Location` -> `Shell Layout Setup` or `Shell Precise Location`
- `Cancel` -> `Shell UT`

## Wireframe spec: Shell Layout Setup

### Screen goal
- Configure shell layout only when the user requests precise shell location.
- Reuse the high-value V1 shell setup concepts without forcing them into routine coarse work.

### Page structure

1. Top bar
- Back
- Title: `Shell Layout Setup`

2. Intro block
- Helper text: `Set the shell layout once for this inspection. After this, precise shell findings can be mapped directly.`

3. Section: `Prefilled Tank Data`
- Total Shell Courses
- Shell Height
- Reference Direction

4. Section: `Layout Inputs`
- Field: `Plate Width (mm)`
  - Type: numeric
- Field: `Course 1 Seam Origin`
  - Type: numeric or reference selector
- Field: `Seam Offset Rule`
  - Type: dropdown
  - Options:
    - Half Plate
    - Third Plate
    - Custom
- Conditional field when `Custom` selected:
  - `Custom Offset`
  - Type: numeric
- Optional field: `Drawing Reference`
  - Type: text

5. Derived summary block
- Course height
- Estimated plates per course
- Closure plate estimate

6. Bottom actions
- Primary action: `Save Layout & Continue`
- Secondary action: `Back`

### Field rules
- `Plate Width (mm)` is required
- `Course 1 Seam Origin` is required
- `Seam Offset Rule` is required
- `Custom Offset` is required only when `Custom` is selected

### Interaction rules
- This setup is saved once per inspection and reused for later shell precise findings
- Returning to this screen should preserve and allow editing previous values
- Saving here should move the user directly into `Shell Precise Location`

### Fields intentionally excluded from this screen
- UT readings
- Finding type / severity
- Report output fields
- Any roof or nozzle setup

### Success paths
- `Save Layout & Continue` -> `Shell Precise Location`
- `Back` -> `Shell Inline Finding`

## Wireframe spec: Shell Precise Location

### Screen goal
- Let the inspector mark the exact shell defect location after the finding has already been documented.
- Preserve V1 map value without making it part of routine entry.

### Page structure

1. Top bar
- Back
- Title: `Precise Shell Location`

2. Context card
- Finding Type
- Severity
- Strake
- Bearing
- Photo thumbnail

3. Method selector
- `Tap Layout`
- `Manual X,Y`
- `Plate / Seam Reference`

4. Precise location workspace
- If `Tap Layout`:
  - shell map canvas
  - tap or mark region
- If `Manual X,Y`:
  - X coordinate
  - Y coordinate
- If `Plate / Seam Reference`:
  - plate reference
  - near vertical seam
  - near horizontal seam
  - plate field

5. Optional details
- Region size
- Location note

6. Bottom actions
- Primary action: `Save Precise Location`
- Secondary action: `Use Coarse Location Instead`
- Tertiary action: `Back`

### Field rules
- One precise location method is required unless the user chooses `Use Coarse Location Instead`
- X and Y must both be present for `Manual X,Y`

### Interaction rules
- The precise location is attached to the existing shell finding
- Saving returns the user to `Shell UT`
- `Use Coarse Location Instead` keeps the finding without fine coordinates

### Fields intentionally excluded from this screen
- UT measurement fields
- Finding evidence capture
- Type / severity editing

### Success paths
- `Save Precise Location` -> `Shell UT`
- `Use Coarse Location Instead` -> `Shell UT`
- `Back` -> `Shell Inline Finding`

## Wireframe spec: Roof UT

### Screen goal
- Support fast, repeatable coarse roof thickness entry based on plate numbers.
- Keep the workflow consistent with `Shell UT` but simpler because MVP does not include roof precise location.

### Page structure

1. Top bar
- Back to `Task Board`
- Title: `Roof UT`
- Secondary action: `Save Draft`

2. Context bar
- Tank Number
- Roof Type
- Helper text:
  - `Routine roof entry uses plate number and A-E readings.`

3. Entry section: `Location`
- Field: `Plate Number`
  - Type: text or dropdown
  - Placeholder: `e.g. R-12`

4. Entry section: `Readings`
- Field: `Reading A`
  - Type: numeric
- Field: `Reading B`
  - Type: numeric
- Field: `Reading C`
  - Type: numeric
- Field: `Reading D`
  - Type: numeric
- Field: `Reading E`
  - Type: numeric
- Optional field: `Quick Note`
- Optional field: `Photo`

5. Derived summary card
- Min
- Max

6. Primary actions row
- Primary action: `Save & Next`
- Secondary action: `Add Finding Here`

7. Recent entries section
- Plate Number
- Min value
- optional finding badge
- `Edit`

### Field rules
- `Plate Number` is required
- At least one reading is required
- All entered readings must be numeric

### Interaction rules
- `Save & Next` clears the reading fields and keeps focus on the next plate
- `Add Finding Here` opens `Roof Inline Finding` with current roof UT context prefilled
- No precise location branch is shown in MVP

### Fields intentionally excluded from this screen
- Roof layout setup
- Precise roof map
- Detailed calculation output

### Success paths
- `Save & Next` -> next roof UT entry on the same screen
- `Add Finding Here` -> `Roof Inline Finding`
- Back -> `Task Board`

## Wireframe spec: Roof Inline Finding

### Screen goal
- Document a roof abnormality immediately from `Roof UT`.
- Follow the same evidence-first concept as shell, but without precise location in MVP.

### Page structure

1. Top bar
- Back to `Roof UT`
- Title: `Roof Finding`

2. Context card
- Surface: `Roof`
- Plate Number
- Linked roof UT reference

3. Step 1: `Capture Evidence`
- `Take Photo`
- `Choose Existing Photo`

4. Step 2: `Annotate Photo`
- arrow
- circle
- freehand mark
- `Skip Annotation`

5. Step 3: `Finding Details`
- Type:
  - Corrosion / Pitting
  - Perforation
  - Crack
  - Deformation
  - Coating Failure
  - Repair Observation
  - Other
- Severity:
  - Low
  - Medium
  - High
- Short Note

6. Step 4: `Measurements`
- Dynamic optional fields based on type

7. Bottom actions
- `Save Finding`
- `Cancel`

### Field rules
- At least one photo is required
- `Finding Type` is required
- `Severity` is required

### Interaction rules
- Saving links the finding to the current roof UT row
- There is no precise location branch in MVP
- Saving returns the user to `Roof UT`

### Success paths
- `Save Finding` -> `Roof UT`
- `Cancel` -> `Roof UT`

## Wireframe spec: Shell Nozzle UT

### Screen goal
- Capture routine shell nozzle thickness readings quickly using the report-style directional pattern.
- Keep the interaction model consistent with other UT tasks.

### Page structure

1. Top bar
- Back to `Task Board`
- Title: `Shell Nozzle UT`
- Secondary action: `Save Draft`

2. Context bar
- Tank Number
- Helper text:
  - `Use nozzle ID and clock-position readings for routine entry.`

3. Entry section: `Nozzle`
- Field: `Nozzle ID`
  - Type: text or dropdown
- Field: `Nozzle Size`
  - Type: text or numeric

4. Entry section: `Readings`
- Field: `12 o'clock`
  - Type: numeric
- Field: `3 o'clock`
  - Type: numeric
- Field: `6 o'clock`
  - Type: numeric
- Field: `9 o'clock`
  - Type: numeric
- Field: `Reinforcement Pad`
  - Type: numeric
- Optional field: `Quick Note`
- Optional field: `Photo`

5. Primary actions row
- `Save & Next`
- `Add Finding Here`

6. Recent entries section
- Nozzle ID
- Min value
- optional finding badge
- `Edit`

### Field rules
- `Nozzle ID` is required
- At least one nozzle reading is required
- All entered readings must be numeric

### Interaction rules
- `Save & Next` moves to the next nozzle entry
- `Add Finding Here` opens `Shell Nozzle Inline Finding` with current nozzle context prefilled
- No precise nozzle location branch in MVP

### Fields intentionally excluded from this screen
- Nozzle registry builder
- Local nozzle map
- Precise location controls

### Success paths
- `Save & Next` -> next shell nozzle entry on the same screen
- `Add Finding Here` -> `Shell Nozzle Inline Finding`
- Back -> `Task Board`

## Wireframe spec: Shell Nozzle Inline Finding

### Screen goal
- Capture shell nozzle findings inline during nozzle UT.
- Preserve the same photo-first pattern used across other task findings.

### Page structure

1. Top bar
- Back to `Shell Nozzle UT`
- Title: `Shell Nozzle Finding`

2. Context card
- Surface: `Shell Nozzle`
- Nozzle ID
- Linked nozzle UT reference

3. Step 1: `Capture Evidence`
- `Take Photo`
- `Choose Existing Photo`

4. Step 2: `Annotate Photo`
- arrow
- circle
- freehand mark
- `Skip Annotation`

5. Step 3: `Finding Details`
- Type:
  - Crack
  - Local Corrosion
  - Weld Concern
  - Reinforcement Pad Issue
  - Leakage Sign
  - Coating Failure
  - Other
- Severity
- Short Note

6. Step 4: `Measurements`
- Dynamic optional fields

7. Bottom actions
- `Save Finding`
- `Cancel`

### Field rules
- At least one photo is required
- `Finding Type` is required
- `Severity` is required

### Interaction rules
- Saving links the finding to the current shell nozzle UT row
- No precise nozzle mapping in MVP
- Saving returns the user to `Shell Nozzle UT`

### Success paths
- `Save Finding` -> `Shell Nozzle UT`
- `Cancel` -> `Shell Nozzle UT`

## Wireframe spec: Roof Nozzle UT

### Screen goal
- Capture routine roof nozzle thickness readings using nozzle ID and cardinal directions.
- Follow the same task concept as shell nozzle UT, with roof-specific directional labeling.

### Page structure

1. Top bar
- Back to `Task Board`
- Title: `Roof Nozzle UT`
- Secondary action: `Save Draft`

2. Context bar
- Tank Number
- Helper text:
  - `Use nozzle ID and N-E-S-W readings for routine entry.`

3. Entry section: `Nozzle`
- Field: `Nozzle ID`
  - Type: text or dropdown
- Field: `Nozzle Size`
  - Type: text or numeric

4. Entry section: `Readings`
- Field: `North`
  - Type: numeric
- Field: `East`
  - Type: numeric
- Field: `South`
  - Type: numeric
- Field: `West`
  - Type: numeric
- Field: `Reinforcement Pad`
  - Type: numeric
- Optional field: `Quick Note`
- Optional field: `Photo`

5. Primary actions row
- `Save & Next`
- `Add Finding Here`

6. Recent entries section
- Nozzle ID
- Min value
- optional finding badge
- `Edit`

### Field rules
- `Nozzle ID` is required
- At least one nozzle reading is required
- All entered readings must be numeric

### Interaction rules
- `Save & Next` moves to the next nozzle entry
- `Add Finding Here` opens `Roof Nozzle Inline Finding` with current nozzle context prefilled
- No precise nozzle mapping in MVP

### Fields intentionally excluded from this screen
- Roof nozzle local map
- Precise location controls
- Registry management

### Success paths
- `Save & Next` -> next roof nozzle entry on the same screen
- `Add Finding Here` -> `Roof Nozzle Inline Finding`
- Back -> `Task Board`

## Wireframe spec: Roof Nozzle Inline Finding

### Screen goal
- Capture roof nozzle findings inline during UT without breaking the routine workflow.

### Page structure

1. Top bar
- Back to `Roof Nozzle UT`
- Title: `Roof Nozzle Finding`

2. Context card
- Surface: `Roof Nozzle`
- Nozzle ID
- Linked nozzle UT reference

3. Step 1: `Capture Evidence`
- `Take Photo`
- `Choose Existing Photo`

4. Step 2: `Annotate Photo`
- arrow
- circle
- freehand mark
- `Skip Annotation`

5. Step 3: `Finding Details`
- Type:
  - Crack
  - Local Corrosion
  - Weld Concern
  - Reinforcement Pad Issue
  - Leakage Sign
  - Coating Failure
  - Other
- Severity
- Short Note

6. Step 4: `Measurements`
- Dynamic optional fields

7. Bottom actions
- `Save Finding`
- `Cancel`

### Field rules
- At least one photo is required
- `Finding Type` is required
- `Severity` is required

### Interaction rules
- Saving links the finding to the current roof nozzle UT row
- No precise nozzle mapping in MVP
- Saving returns the user to `Roof Nozzle UT`

### Success paths
- `Save Finding` -> `Roof Nozzle UT`
- `Cancel` -> `Roof Nozzle UT`

## Wireframe spec: Bottom MFL

### Screen goal
- Capture bottom inspection through attachment and summary only.
- Keep floor work out of manual MVP workflows.

### Page structure

1. Top bar
- Back to `Task Board`
- Title: `Bottom MFL`
- Secondary action: `Save Draft`

2. Intro block
- Helper text: `Import the MFL or floor scan record. Manual floor mapping is not part of MVP.`

3. Entry section: `Source Report`
- Field: `Contractor`
  - Type: text
- Field: `Report Reference`
  - Type: text
- Field: `Report Date`
  - Type: date
- Field: `Coverage`
  - Type: dropdown or text
- Field: `Severity`
  - Type: dropdown
  - Options:
    - Low
    - Medium
    - High
- Field: `Attachment`
  - Type: file upload

4. Optional section: `Summary`
- Flagged Areas Count
- Summary Note

5. Bottom actions
- `Save MFL`
- `Back to Tasks`

### Field rules
- Contractor is required
- Report Reference is required
- Report Date is required
- Attachment is required

### Interaction rules
- This screen does not open a floor map
- Saving returns the user to `Task Board`
- Flagged areas remain summary-only in MVP

### Fields intentionally excluded from this screen
- Manual floor UT entry
- Bottom layout setup
- Annular mapping
- Precise floor anomaly localization

### Success paths
- `Save MFL` -> `Task Board`
- Back -> `Task Board`

## Wireframe spec: Findings / Photos

### Screen goal
- Provide one place to review findings created from all tasks.
- Support follow-up and quality checks without making this a duplicate entry workflow.

### Page structure

1. Top bar
- Back to `Task Board`
- Title: `Findings / Photos`

2. Filter row
- Task filter
- Severity filter
- Status filter

3. Findings list
- Row content:
  - finding type
  - source task
  - location summary
  - severity
  - photo thumbnail
  - status
- Primary row action:
  - `Open`

4. Finding detail drawer or page
- Photo
- Annotation
- Type
- Severity
- Measurements
- Linked task reference
- Location summary

5. Bottom actions
- `Back to Tasks`

### Interaction rules
- Findings shown here are created from task flows or standalone entry later
- Editing a finding should not break its link to the source task
- This screen is for review and management, not the primary creation path in MVP

### Fields intentionally excluded from this screen
- New task measurements
- Layout setup
- Export controls

### Success paths
- `Open` -> finding detail
- Back -> `Task Board`

## Wireframe spec: Review

### Screen goal
- Help the inspector check completeness before export.
- Surface only the gaps and issues that matter.

### Page structure

1. Top bar
- Back to `Task Board`
- Title: `Review`
- Secondary action: `Save Draft`

2. Inspection summary card
- Tank Number
- Client
- Location
- Inspection Date
- Scope summary

3. Section: `Task Status`
- One row per active task:
  - Shell UT
  - Roof UT
  - Shell Nozzles
  - Roof Nozzles
  - Bottom MFL
- Per row:
  - status
  - record count
  - warning count
  - `Open`

4. Section: `Warnings`
- High-signal items only
- Examples:
  - missing required photo
  - incomplete shell reading set
  - missing MFL attachment
  - incomplete finding details

5. Section: `Findings Summary`
- Total findings
- High severity findings
- Findings needing follow-up

6. Bottom actions
- Primary action: `Continue to Export`
- Secondary action: `Back to Tasks`

### Interaction rules
- Review is accessible even if tasks are incomplete
- Export should still be allowed with warnings unless a hard blocker exists

### Hard blockers
- Missing required setup data
- No completed task data at all
- Required MFL attachment missing when `Bottom MFL` is in scope
- A saved finding has no photo

### Success paths
- `Continue to Export` -> `Export`
- `Open` task row -> relevant task screen
- Back -> `Task Board`

## Wireframe spec: Export

### Screen goal
- Let the user finish the inspection and produce structured output without turning export into a report-writing workflow.

### Page structure

1. Top bar
- Back to `Review`
- Title: `Export`

2. Export summary card
- Tank Number
- Inspection Date
- Completed task count
- Warning count

3. Section: `Outputs`
- Option: `Export JSON`
- Option: `Export CSV`
- Option: attachment bundle reference

4. Section: `Warnings`
- Repeat outstanding warnings if any
- Label clearly:
  - `Ready to Export`
  - or `Export With Warnings`

5. Bottom actions
- Primary action: `Export`
- Secondary action: `Finish`

### Interaction rules
- Export does not ask the user to write report prose
- Export should include linked findings, photos, and MFL attachment references
- After successful export, the inspection can be marked complete

### Fields intentionally excluded from this screen
- Full PDF editor
- Report chapter writing
- Calculation tuning controls

### Success paths
- `Export` -> output generation
- `Finish` -> `Home`

## Wireframe spec: Home

### Screen goal
- Provide a simple landing point to start new work or resume a draft.

### Page structure

1. Top bar
- Title: `Tank Inspection`

2. Primary actions
- `New Inspection`
- `Resume Draft`

3. Optional section: `Recent Inspections`
- Tank Number
- Client
- Last edited time
- Status

### Interaction rules
- `New Inspection` starts the MVP flow at `Inspection Setup`
- `Resume Draft` returns to the last active inspection `Task Board`

### Success paths
- `New Inspection` -> `Inspection Setup`
- `Resume Draft` -> `Task Board`
