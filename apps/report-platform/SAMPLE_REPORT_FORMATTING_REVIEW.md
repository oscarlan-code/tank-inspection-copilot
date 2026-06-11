# Sample Report Formatting Review

## Purpose

Review the target sample report as a product reference, and identify what the report platform must support beyond layout maps.

Primary reviewed sample:

- `/Users/oscar/Public/irs/Sample Reports/22PE2-1 TK V10 Shell Internal Inspection Report (Post Blast).pdf`

## Key Finding

Layout map rendering is only one part of the report system.

The sample report shows that the final product also needs a strong document-formatting layer for:

- page templates
- typography
- centered title blocks
- section headings
- bullet styling
- tables
- signatures
- revision logs
- repeated headers and footers
- appendix layouts
- page numbering
- print-safe spacing and pagination

This should not be left to raw AI output.

## What The Sample Report Actually Is

From PDF metadata:

- format: `A4`
- length: `34 pages`
- producer: `Microsoft Word for Microsoft 365`
- creator: `Microsoft Word for Microsoft 365`

That matters because the source report is clearly template-authored and layout-controlled.

It is not just plain text rendered into PDF.

## Observed Formatting Patterns

From the sample review, the report uses a repeatable visual system.

### 1. Cover Page

Observed features:

- large centered client/report identity block
- centered terminal/location/tank block
- large centered report title
- small left-aligned report metadata near the lower half
- large hero image at bottom
- lots of whitespace
- company branding at top

Implication:

- cover page needs its own dedicated page template
- this is not just a normal text section

### 2. Repeated Header And Footer

Observed features:

- branded header repeated on body pages
- client, job number, tank number, completed date, and page number in header band
- confidentiality notice repeated in footer
- “Click to Table of Contents” link on many pages

Implication:

- the PDF layer needs master page support
- headers and footers must be template-driven

### 3. Section Heading Style

Observed features:

- large blue section headings
- numeric prefix integrated into heading
- strong spacing above and below headings
- uppercase section labels in many places

Implication:

- heading styling should be tokenized and deterministic
- AI should emit semantic headings, not font instructions

### 4. Narrative Paragraph Pages

Observed features:

- left-aligned body text
- large readable sans-serif body font
- custom arrow bullets
- controlled paragraph spacing
- subheadings like `SHELL INTERNAL` in bold uppercase

Implication:

- the editor needs rich-text semantics
- bullets, paragraph spacing, and subheading rules belong to the formatting engine

### 5. Table Pages

Observed features:

- thin black table borders
- bold header rows
- mixed fixed-width and auto-wrap columns
- controlled row height
- section subtitle above each table

Implication:

- tables need dedicated rendering components
- not all tabular content should be treated as markdown tables

### 6. Map / Sketch Pages

Observed features:

- large centered sketch canvas
- separate legend box
- title line above sketch
- title block / drawing block at bottom right
- printable fine-line geometry
- annotations, markers, and measured areas

Implication:

- map pages are specialized composed pages, not just an image dropped into a paragraph
- report platform needs a sketch page component

### 7. Attachment / NDT Report Pages

Observed features:

- form-style technical layout
- boxed metadata tables
- bold centered report title
- result tables
- signatures and technician details

Implication:

- attachments need their own page family
- some appendices are closer to forms than prose

## Observed Typography Signals

The PDF font list includes a mix of:

- `Verdana`
- `Arial Narrow`
- `Agency FB`
- `Cambria`
- `Calibri`
- `Aharoni`

Practical takeaway:

- the sample family is not a single-font system
- the platform should use a controlled typography token set per block type

Suggested first-pass token model:

- `coverTitle`
- `coverMeta`
- `pageHeader`
- `sectionHeading`
- `subheading`
- `body`
- `bullet`
- `tableHeader`
- `tableBody`
- `caption`
- `footer`

## What This Means For AI Generation

AI should generate:

- section wording
- summary wording
- recommendation wording
- captions
- callout text
- optional draft bullet lists

AI should not directly decide:

- font size
- font family
- centered vs left alignment
- table border rules
- page-break rules
- exact header/footer spacing
- drawing block layout

Those belong to the formatting and composition system.

## Recommended Architecture Split

Use three separate layers.

### 1. Content Layer

Owned by:

- Android import
- manual report inputs
- AI draft output
- user edits

Examples:

- narrative paragraphs
- bullet items
- recommendation statements
- table rows
- captions

### 2. Document Structure Layer

Owned by:

- report templates
- page/block composition rules
- enabled section list
- appendix rules

Examples:

- cover page
- metadata page
- TOC
- narrative section page
- sketch page
- photo page
- NDT attachment page

### 3. Formatting Layer

Owned by:

- typography tokens
- alignment rules
- table styles
- spacing system
- print CSS or PDF styles
- repeated header/footer templates

Examples:

- blue section heading color
- bold labels
- center alignment on cover
- footer disclaimer
- page break rules

## Third-Party Tools We Likely Need

Yes, third-party tools are likely needed, but each should solve a specific job.

### Rich Text Editing

Use for:

- inspector/reviewer editing of section text
- bullets
- bold/italic
- simple tables

Recommended direction:

- `TipTap` / ProseMirror-based editor

Why:

- strong structured rich-text editing
- controllable schema
- better than free-form HTML editing

### Interactive Map Editing

Use for:

- moving markers
- dragging labels
- resizing map objects

Recommended direction:

- custom React + SVG editor
- or `React + Konva`

Why:

- better suited than Mermaid
- supports controlled geometry interaction

### Print / PDF Rendering

Use for:

- A4 pagination
- headers/footers
- page-break control
- consistent PDF export

Recommended direction for first product version:

- HTML/CSS page templates rendered with Playwright or Chromium PDF

Possible enhancement tools:

- `Paged.js` for paged-media features
- `PrinceXML` if higher-end print fidelity becomes necessary

Why:

- browser preview and PDF can stay close
- easier than maintaining a separate Word-only rendering path

### DOCX / Word Interop

Use only if the business later requires editable `.docx` outputs.

Possible tools:

- `docx`
- `docxtemplater`

Important note:

- do not make Word generation the primary architecture unless the business explicitly requires `.docx` as a deliverable

### Table And Form Rendering

Use for:

- attachment forms
- technical result sheets
- revision logs
- structured metadata pages

Recommended direction:

- dedicated React print components
- avoid generic markdown-to-table rendering for critical technical pages

## Recommended Product Strategy

For the first product-standard implementation:

1. keep AI focused on structured content drafting
2. keep map geometry deterministic
3. build page templates as React print components
4. apply formatting through design tokens and print styles
5. use a rich-text editor for user edits
6. use a controlled PDF renderer for final output

This gives us:

- editable content
- repeatable formatting
- preview/PDF consistency
- lower risk than asking AI to “format the report”

## First Build Implications

The first implementation should include these component families:

- `CoverPage`
- `MetaAndSignoffPage`
- `TableOfContentsPage`
- `NarrativeSectionPage`
- `DataTablePage`
- `SketchPage`
- `PhotoPage`
- `AttachmentReportPage`

And these editor/rendering capabilities:

- rich text editor for narrative sections
- map editor for sketch blocks
- print-safe page composer
- PDF export pipeline

## Bottom Line

The sample report is a composed publication, not just AI text plus a map.

So the report platform needs:

- a content-generation system
- a structured page-composition system
- a formatting/rendering system
- editing tools for both text and maps

AI is only one layer of that stack.
