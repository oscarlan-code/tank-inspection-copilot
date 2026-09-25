> Updated 18 September 2026: the evaluation candidate uses format revision 2 and outline revision 4. Internal module names and the 89 evidence-routing blocks are not literal report headings. See [report-facing presentation and outline refinements](generic-report-presentation-v2.md). Existing saved evaluations remain frozen.

# Section format specifications for the 25 reusable templates

Status: **evaluation design specification, 18 September 2026; catalogue revision 3**. These are proposed deterministic format rules, not proof of current preview/DOCX/PDF rendering support. The [content outlines](generic-report-outline-v1.md) define what belongs in each section; this document defines its presentation. The machine-readable rules are in [generic-outline-formats.mjs](../../server/experiments/generic-outline-formats.mjs) and the [consolidated catalogue](../reviews/data/generic-report-outline-v1.json).

The formats use the whole-KB structural review for section and table variants. Shared typography follows the existing report-platform baseline where specified. Page handling, captions, overflow and figure rules below are proposed design choices; they have not been visually verified across all historical reports.

## Shared report style

| Element | Candidate specification |
| --- | --- |
| Paper | A4 portrait, 210 × 297 mm; normal 25.4 mm margins; 159.2 mm available body width. |
| Page variants | Landscape or another page variant requires explicit reviewed selection. No AI-selected orientation. |
| Body | Arial, 10.5 pt, left aligned; 1.5 line spacing; 6 pt after paragraphs. Approved standard-section styling takes precedence. |
| Headings | Numbered Heading 1: 14 pt bold dark blue; Heading 2: 12 pt bold blue; Heading 3: 11 pt bold dark blue. Semantic styles support a TOC. |
| Heading pagination | Keep heading with first paragraph, table header plus first row, or figure. Avoid widows/orphans. Captions, field labels and legends are not extra TOC headings. |
| Tables | Normally 10.5 pt, single spacing, thin 0.5 pt borders and pale-blue bold header row; 10 pt minimum. Repeated multirow headers on continuation pages. |
| Cell alignment | Text/identifiers left aligned; numbers right aligned; response markers centred. Preserve native merged headers and row relationships. |
| Units and missing values | Keep captured units, point labels and precision. Distinguish missing, not measured and not applicable; no invented zeroes or inferred conversions. |
| Wide tables | Wrap labels, then use reviewed logical column groups with repeated identity columns; otherwise require a reviewed page variant. Never clip/drop columns or silently shrink below the minimum. |
| Long rows | Keep rows together when they fit. A row larger than a page needs labelled continuation with repeated identity and preserved cell relationships. |
| Table titles | `Table {sectionNumber}.{tableIndex} — description`, above the table. |
| Figures | Fit available content width/height after reserving heading, caption and legend space; preserve aspect ratio, geometry, labels, axes and legends. No automatic crop or fixed pixel width. |
| Figure captions | 10 pt; `Figure {sectionNumber}.{figureIndex} — factual description/location`, below the figure. Keep figure, legend and caption together. |
| Header/footer | Confirmed report/asset identity and rendered page numbering; approved footer wording when configured. No invented metadata. |
| Page breaks | Controlled by report profile and approved format variant. Do not insert a page break for every block or evidence item. Dedicated drawings/forms may use their own pages. |
| References | Resolve displayed section/figure/table/page numbers after assembly. Preserve native plate, station and photo IDs; hyperlinks also remain readable as plain text. |
| Length | Enough space for required evidence, with concise prose and references to detail. No fixed historical page count or word limit that removes required content. |
| Review versus report | Provenance colours, source-count inventories, approval badges, internal identifiers, compiler comments and pending-input notices stay outside customer report pages. No raw-evidence appendix. |

Approved standard sections and imported approved form/map sheets retain their own layout, including footnotes and legends. Generic styling must not silently override them. Table fields below describe logical roles; they do not create mandatory columns where native records use a different valid structure.

**Inspection and Maintenance Regime:** insert the whole approved standard section unchanged, with confirmed declared placeholders and explicit manual edits only. Its semantic outline slots must not create three new visible headings or a new table. No AI drafting, rewriting, polishing or layout selection.

## Formats at a glance

| Template | Main format |
| --- | --- |
| 1. Asset and inspection information | Grouped label–value sheet |
| 2. Scope and limitations | Numbered scope with short limitation paragraphs |
| 3. Inspection and maintenance regime | Approved standard section, preserved layout |
| 4. Inspection findings | Component headings with concise findings |
| 5. Recommendations | Numbered actions grouped by component or confirmed priority |
| 6. Test information and methodology | Method metadata with coverage description |
| 7. Inspection checklist | Category-grouped response grid |
| 8. Thickness measurements | Component-specific measurement grid |
| 9. Component layout and locations | Drawing page with legend and correspondence |
| 10. Calculations | Method statement, inputs, verified results and review |
| 11. NDT examination results | Method-specific examination form |
| 12. Survey results | Datum, stations and survey-specific reading tables |
| 13. Survey graphs | Survey plots with legends and concise interpretation |
| 14. Photographs | Captioned photograph sheet |
| 15. Method interpretation guidance | Controlled method text and symbol legend |
| 16. Floor corrosion plan | Floor drawing with verified corrosion overlay |
| 17. MFL plate maps | Index followed by individual plate-map sheets |
| 18. Engineering assessment | Structured engineering assessment narrative |
| 19. B-scan and local scan profiles | Location diagram followed by labelled profile traces |
| 20. 3D and dimensional assessment results | Scan-location diagram, geometry views and dimensional results |
| 21. Post-repair inspection | Repair register with linked verification and condition |
| 22. Repair consultation and review | Three-part consultation narrative |
| 23. Tank calibration table | Calibration metadata and native calibration grid |
| 24. References | Consistently numbered reference list |
| 25. Summary and conclusions | Concise summary with references to detail |

## 1. Asset and inspection information

**Main format:** Grouped label–value sheet.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Asset identity | label value: Field; Value | Group confirmed asset identity fields; no prose reconstruction. |
| Configuration and dimensions | label value: Parameter; Value with unit | Preserve configuration labels and captured dimensional units. |
| Inspection details | label value: Field; Value | Dates and personnel retain their captured roles. |
| Available inspection and maintenance history | dated events: Date; Event / work; Notes | Only available confirmed history, ordered by date; unknown dates remain explicit. |

**Pagination:** Keep each short field group together; repeat table headers for long histories.

## 2. Scope and limitations

**Main format:** Numbered scope with short limitation paragraphs.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Inspection tasks and extent | numbered list | One commissioned task per item; preserve qualifiers and component/extent. |
| Access, coverage and limitations | short paragraphs | Group access restrictions, exclusions and coverage limitations. |
| Applicable references | reference list | Readable document titles/editions; no copied standard text. |

**Pagination:** Flow within the page; keep each scope item with its qualification.

## 3. Inspection and maintenance regime

**Main format:** Approved standard section, preserved layout.

**Headings:** Reuse the approved section heading once; do not prepend a duplicate or turn semantic basis/activities/limits slots into new visible headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Regime basis | approved template block | Insert the selected approved wording and layout unchanged. |
| Activities, intervals and responsibilities | approved template block | Retain approved paragraphs/lists/tables; substitute only declared confirmed fields. |
| Applicability and limitations | approved template block | Preserve the applicable approved variant and explicit manual edits. |

**Pagination:** Follow the selected approved template’s pagination.

No AI drafting, paraphrasing, polishing or layout selection. The generic table style must not override the standard section.

## 4. Inspection findings

**Main format:** Component headings with concise findings.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Inspection extent | short paragraphs | State the actual examination extent once. |
| Observed condition | component groups | Use bold uppercase component/side headings; concise paragraphs or arrow bullets. Keep condition, location and qualification together. |
| Survey overview | verified summary: Native overview columns | Use only a supplied verified survey overview; do not invent assessment columns. |
| Reviewed assessment summary | short paragraphs with references | Reference canonical measurements and reviewed results without copying whole tables. |
| Inspection limitations | short paragraphs | State component-specific limitations without repeating scope boilerplate. |

**Pagination:** Keep a component heading with the first finding; allow long component groups to continue.

## 5. Recommendations

**Main format:** Numbered actions grouped by component or confirmed priority.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Recommended actions | numbered actions | One confirmed action per item, with component/location and qualifications. |
| Finding and assessment references | inline cross references | Place the finding or assessment reference beside its action. |
| Priority or timing | inline labelled fields | Show only confirmed priority/timing; avoid fabricated empty columns. |
| Responsibility and verification status | inline labelled fields | Append confirmed responsibility or verification status to its action. |

**Pagination:** Keep each action and its basis/qualification together.

A reviewed action-register variant may use Action / Location / Basis / Priority / Responsibility / Status; optional columns appear only when applicable.

## 6. Test information and methodology

**Main format:** Method metadata with coverage description.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Method and procedure | native method form: Native procedure / instrument / probe / settings / examiner fields | One group per method and inspection phase; retain merged headers and field relationships. Use a label–value grid only for a simple form. |
| Equipment and personnel | native equipment personnel: Item / role; Identification; Recorded details | Preserve actual equipment and examiner fields; do not imply missing certification. |
| Examination extent | short paragraphs OR native extent: Native location / extent columns | Use a table for several locations; prose for a simple extent. |
| Method limitations | short paragraphs | Method-specific limitations follow the coverage. |

**Pagination:** Keep method title and metadata together; continue long equipment/coverage tables with headers.

## 7. Inspection checklist

**Main format:** Category-grouped response grid.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Response legend | compact legend | Preserve exact response labels and meanings for this checklist. |
| Inspection responses | native checklist: Item no.; Inspection item; Native response columns | Retain order, selected markers and additional response categories; never force a fixed response set. |
| Item notes | row linked notes | Notes stay beside the item or use a clearly numbered note reference. |

**Pagination:** Repeat headers and category context on continuation pages; keep item, response and note associated.

For example, preserve an existing 1 / 2 / 3 / 4 / IA / NE / N/A grid and any additional native codes; this is not a mandatory response set for every checklist.

## 8. Thickness measurements

**Main format:** Component-specific measurement grid.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Measurement basis and units | compact labelled fields | State component, side/phase, method and captured units. |
| Measurements | native measurement: Native item / location; Native reading columns with units | Retain point labels, order, grouping and precision; no universal R1–R5 assumption. |
| Point and layout correspondence | table note cross references | Link point IDs to the applicable layout figure. |
| Unmeasured points and limitations | row status and table notes | Unmeasured or inaccessible points retain their recorded status. |

**Pagination:** Repeat identity and unit headers; split large grids only into explicit location/point groups.

Observed variants include plate A–E readings, shell course × compass stations × vertical points, roof-nozzle compass points, shell-nozzle clock positions, and separate or combined reinforcement-pad tables. Preserve the current native variant; these examples are not mandatory columns.

## 9. Component layout and locations

**Main format:** Drawing page with legend and correspondence.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Layout | full content width | Preserve geometry, orientation and native labels; use a dedicated page when needed. |
| Legend and orientation | legend below or beside drawing | Keep orientation, symbols and title block readable. |
| Source item correspondence | identifier mapping: Drawing ID; Current record / plate ID | Include only when aliases differ; preserve both identifiers. |

**Pagination:** Keep drawing, caption and legend on one page where legible; otherwise use a labelled continuation.

## 10. Calculations

**Main format:** Method statement, inputs, verified results and review.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Method and applicability | labelled method reference | Show the selected method/edition and applicability. |
| Inputs and units | calculation inputs: Parameter; Value; Unit; Readable source reference | Display verified input bindings; no raw internal evidence IDs. |
| Calculated results | calculation results: Result; Value; Unit; Criterion / status if supplied | Render verified outputs only; formulas must come from the reviewed calculator. |
| Interpretation and review | short reviewed paragraphs | Place interpretation immediately after the associated results. |

**Pagination:** Keep small input/result groups together; continue large tables with repeated headings.

## 11. NDT examination results

**Main format:** Method-specific examination form.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Test location and extent | native location metadata: Native asset / component / area / side / phase fields + location drawing (when applicable) | Identify asset/component, area, side and phase; include a drawing when supplied. |
| Procedure and examination details | native examination metadata: Procedure / equipment / examiner field; Recorded value | Preserve the actual form fields for the selected method. |
| Indications and results | native ndt results: Native indication / location ID; Method-specific result columns | MPI, penetrant, vacuum-box, PAUT and other methods keep their own schemas. |
| Reviewed disposition | reviewed disposition | Use only recorded assessment; preserve genuine sign-off fields where supplied. |
| Limitations | form notes | Place method/coverage limitations with the examination record. |

**Pagination:** Start each standalone examination sheet on a new page; preserve original approved attachment pages when selected.

Do not invent signatures, approvals or an acceptance-status column.

## 12. Survey results

**Main format:** Datum, stations and survey-specific reading tables.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Survey datum and method | compact labelled fields | Identify datum, survey type, method, direction and inspection phase. |
| Station and coordinate locations | native stations: Station ID; Native coordinate / location columns + station location diagram (when applicable) | Keep coordinate axes, reference centre and station order; associate the location figure. |
| Survey readings | native survey: Station / direction; Native reading and unit columns | Roundness, plumbness, roof cross-section and settlement schemas remain distinct. |
| Reviewed interpretation | short reviewed paragraphs with references | Reference reviewed calculations and matching plots. |
| Survey limitations | table notes | State missing stations, inaccessible areas and survey limitations. |

**Pagination:** Repeat datum/unit context on continued tables; group by survey, direction or station series.

## 13. Survey graphs

**Main format:** Survey plots with legends and concise interpretation.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Graphs | one or more legible plots | Use verified data/plots; retain axes, scales, station order, orientation and datum. |
| Axes, units and legend | plot legend | Units and series identities remain adjacent to each plot. |
| Reviewed interpretation | short reviewed paragraphs | Place interpretation after its matching plot. |

**Pagination:** Keep each plot, legend and caption together; prefer a dedicated page over unreadable scaling.

## 14. Photographs

**Main format:** Captioned photograph sheet.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Selected photographs | one column or two column grid | Use at most two columns when details remain legible; otherwise one full-width image. Preserve aspect ratio. |
| Captions and finding links | caption below each image | Use figure number, component/location and factual description; link the relevant finding. |

**Pagination:** Keep each photo with its caption; break between photo groups, not through them.

## 15. Method interpretation guidance

**Main format:** Controlled method text and symbol legend.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Interpretation guidance | approved guidance layout | Use the applicable approved method/equipment guidance and its version, preserving its paragraphs, illustrations and footnotes. |
| Symbols and units | symbol legend: Symbol / category; Meaning / unit | Preserve method-specific terminology and colour meanings. |
| Applicability and limitations | short paragraphs | Include only applicable approved interpretation limitations. |

**Pagination:** Keep symbol rows together; preserve an approved vendor attachment layout when selected.

## 16. Floor corrosion plan

**Main format:** Floor drawing with verified corrosion overlay.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Floor layout | drawing base layer | Use the current immutable floor layout as the base. |
| Verified corrosion overlay | same drawing overlay layer | Compose on the same drawing; do not print a second duplicate base figure. |
| Legend and plate correspondence | legend + plate correspondence: Native plate ID; Current plate ID (when applicable) | Keep severity/category keys and plate correspondence readable and factual. |
| Coverage limitations | drawing notes | Mark recorded unscanned areas and stated coverage limitations. |

**Pagination:** Use a dedicated figure page when necessary; preserve orientation and correspondence across continuations.

## 17. MFL plate maps

**Main format:** Index followed by individual plate-map sheets.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Plate map index | plate index: Native plate ID; Current plate ID when different; Map figure / page | Resolve figure/page references after assembly. |
| Plate maps | one plate map per sheet by default | Preserve scale bars, orientation, legend and native labels; selected approved map sheets retain their layout. |
| Coverage and interpretation limitations | map notes | Attach limitations to the affected plate or map series. |

**Pagination:** Break between plate maps; a reviewed compact variant may group maps only when all labels remain legible.

## 18. Engineering assessment

**Main format:** Structured engineering assessment narrative.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Assessment basis and scope | labelled basis and short paragraphs | Separate assessment method, scope and applicability. |
| Results and calculation references | assessment summary: Assessment item; Verified result; Criterion if supplied; Detail reference | Reference canonical calculations rather than repeating input tables. |
| Reviewed conclusion | reviewed conclusion paragraphs | Preserve qualifications and the reviewed conclusion. |
| Assumptions and limitations | labelled assumptions and limitations | Keep assumptions distinct from measured facts. |

**Pagination:** Keep each conclusion with its material qualifications and references.

## 19. B-scan and local scan profiles

**Main format:** Location diagram followed by labelled profile traces.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Profile locations | location diagram | Use native area/trace IDs to connect locations and traces. |
| Scan profiles | ordered profile panels | Retain axes, scales, units, scan direction and trace IDs. |
| Profile findings | native trace findings: Native trace / location / result columns OR trace linked paragraphs | Associate recorded indications with their exact trace/location. |
| Profile coverage and limitations | profile notes | Retain coverage gaps and instrument/method limitations. |

**Pagination:** Keep trace and caption together; repeat area/phase identity when a trace group continues.

## 20. 3D and dimensional assessment results

**Main format:** Scan-location diagram, geometry views and dimensional results.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Scan station locations and coverage | native scan stations: Native station / location / coverage columns + scan station diagram | Preserve station identity and scan coverage. |
| Geometry views and heat maps | labelled geometry panels | Preserve colour scales, coordinate system, units, orientation and reference centre. |
| Dimensional results | native dimensional results: Location / station; Native geometry/deviation columns | Do not combine different coordinate frames or measurement types. |
| Reviewed interpretation | short reviewed paragraphs | Link reviewed interpretation to the corresponding result/view. |
| Scan coverage and limitations | scan notes | State verified coverage and processing limitations. |

**Pagination:** Break by area/view or result series; retain matching legends with each geometry panel.

## 21. Post-repair inspection

**Main format:** Repair register with linked verification and condition.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Repair work and locations | repair register: Repair ID; Component / location; Confirmed work; Phase / date if supplied | Retain the original location binding and repair identity. |
| Verification examinations | verification register: Repair ID; Examination; Recorded result; Detail reference | Link to the actual examination; do not infer acceptance. |
| Post-repair condition and outstanding items | repair grouped paragraphs | Separate post-repair condition and recorded outstanding items. |
| Verification limitations | short paragraphs | Identify limitations of verification. |

**Pagination:** Repeat repair IDs on continued tables; do not merge before/after/follow-up phases.

## 22. Repair consultation and review

**Main format:** Three-part consultation narrative.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Consultation scope | short paragraphs | State the question and commissioned review scope. |
| Proposed work and available basis | paragraphs with references | Describe the confirmed proposal and available supporting information. |
| Review comments | numbered review comments | Keep professional comments distinct from the original proposal; link confirmed actions to recommendations. |

**Pagination:** Allow a short consultation to share a page with related identity/recommendations; no artificial page expansion.

## 23. Tank calibration table

**Main format:** Calibration metadata and native calibration grid.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Asset, datum and calibration basis | compact labelled fields | Identify asset, reference datum, units and calibration basis. |
| Calibration data | native calibration: Native dip / ullage / volume columns | Preserve grouping, ordering and recorded precision; do not interpolate or add values. |
| Applicability and limitations | table notes | Keep applicability and limitations adjacent to the data. |

**Pagination:** Repeat column headings and datum/unit context on each page; optional side-by-side column groups must preserve reading order.

## 24. References

**Main format:** Consistently numbered reference list.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Referenced documents and editions | numbered reference list | Show document title, identifier, edition/revision and attachment reference where provided; readable without hyperlinks. |

**Pagination:** Keep each reference entry together and wrap long titles; numbering resolves with document assembly.

## 25. Summary and conclusions

**Main format:** Concise summary with references to detail.

**Headings:** Numbered section heading; outline-block headings are used where they help navigation. Field labels, captions and legends are not extra TOC headings.

| Outline block | Format / fields | Placement and preservation rule |
| --- | --- | --- |
| Scope overview | short opening paragraph | State the commissioned scope without repeating the full scope section. |
| Principal reviewed results | short paragraphs or bullets | Summarize reviewed results; reference detailed sections and preserve qualifications. |
| Confirmed actions | short confirmed action list | Reference confirmed recommendations without duplicating their complete register. |

**Pagination:** No forced one-page or word-count cap; remain concise without omitting required material.

## Preview, export and evaluation boundary

Formatting belongs to the deterministic report formatter. AI may supply only permitted section wording; it cannot choose fonts, columns, figure scaling, page breaks or output markup. The Maintenance Regime section bypasses AI entirely. The same semantic document should feed preview and export so changes in presentation do not alter values, row relationships or required evidence.

The current exporter partially matches the typography and table baseline, but these specifications are not yet implemented end to end. It does not explicitly enforce A4 dimensions, repeated report headers/footers, general image rendering or full row/figure pagination; some map sizing and legacy section page breaks also need review. No exporter change or product promotion is included in this format-definition task.

Before treating a profile as export-ready, render representative narrative, native measurement/checklist, specialist form, graph, map and photo pages and check: content width; wrapping; complete rows and markers; legible axes and legends; figure/caption grouping; resolved references; no clipped columns; and no review/debug content. Format readiness is a separate evaluation dimension from captured-fact recovery. No new rendered-report quality result is claimed here.
