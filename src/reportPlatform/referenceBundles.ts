export type SectionReferenceBundle = {
  sampleReportFormat: string[];
  apiGuardRails: string[];
  outputConstraints: string[];
  sectionPromptProfile: string[];
};

const defaultBundle: SectionReferenceBundle = {
  sampleReportFormat: [
    "Keep the section aligned to the TK-465 report order and professional IRS tone.",
    "Use compact engineering wording instead of chatty explanation.",
  ],
  apiGuardRails: [
    "Prefer structured captured facts over generalized prose.",
    "Do not overstate unsupported inspection coverage or conclusions.",
  ],
  outputConstraints: [
    "Stay inside the active section.",
    "If required inputs are missing, say so explicitly.",
  ],
  sectionPromptProfile: [
    "Match the expected section shape before defaulting to generic prose.",
    "If the active section is list-led, caption-led, or placeholder-led, preserve that structure.",
  ],
};

const bundles: Record<string, SectionReferenceBundle> = {
  "scope-of-inspection": {
    sampleReportFormat: [
      "The real report opens with a bullet-style scope section before all narrative detail.",
      "Scope should read like a job-scope list, not a narrative paragraph.",
    ],
    apiGuardRails: [
      "Do not imply floor or MFL interpretation is complete if the package does not contain it.",
      "Scope language should reflect actual methods present in the workspace.",
    ],
    outputConstraints: [
      "List only supported coverage areas.",
      "Keep the scope neutral and operational, not conclusion-heavy.",
      "Prefer meaningful coverage metrics such as measured plate counts and readings-per-location profile over raw exported row counts.",
    ],
    sectionPromptProfile: [
      "Write one bullet per supported scope item.",
      "Prefer action-led bullets such as `To carry out ...`.",
      "When captured data provides useful scope coverage metrics, mention them directly, such as the number of measured roof plates or the readings-per-location profile.",
      "Describe inspection methods and scope items instead of generic dataset row totals unless the reviewer explicitly asks for those totals.",
      "Do not collapse the scope into a paragraph unless the reviewer explicitly asks for it.",
    ],
  },
  "inspection-maintenance-regime": {
    sampleReportFormat: [
      "This section follows scope and precedes general tank information in the sample report.",
      "The tone should be concise and policy-like, not a long narrative.",
    ],
    apiGuardRails: [
      "Use confirmed API basis and reviewer-supplied maintenance context only.",
      "Do not invent inspection interval history or client maintenance practices.",
    ],
    outputConstraints: [
      "Preserve manual review responsibility.",
      "Treat this section as partially manual until business rules are finalized.",
    ],
    sectionPromptProfile: [
      "Use a short regime block, not a long narrative.",
      "Lead with governing basis and maintenance context.",
    ],
  },
  "general-tank-information": {
    sampleReportFormat: [
      "Present factual identity, geometry, and job context in a clean report block.",
      "Do not add interpretive language here.",
    ],
    apiGuardRails: [
      "Use exact captured identifiers and dimensions.",
      "Do not rewrite client, site, tank number, or dates inaccurately.",
    ],
    outputConstraints: [
      "Keep this section factual.",
      "No recommendations or conclusions in this section.",
    ],
    sectionPromptProfile: [
      "Present this section as a factual information block.",
      "Prefer one field per line instead of a loose narrative sentence.",
    ],
  },
  "inspection-report": {
    sampleReportFormat: [
      "The sample report uses this as the main condition narrative section before recommendations.",
      "The section should synthesize findings, UT, and limitations into a readable engineering summary.",
    ],
    apiGuardRails: [
      "Ground statements in linked measurements, findings, and photographs.",
      "Do not infer unsupported bottom/floor conditions from shell or roof data.",
    ],
    outputConstraints: [
      "Highlight limitations where data is missing.",
      "Keep wording reviewer-friendly and technically restrained.",
    ],
    sectionPromptProfile: [
      "Use short technical paragraphs.",
      "Lead with observations and evidence before limitations.",
    ],
  },
  "repair-recommendations-api-assessment": {
    sampleReportFormat: [
      "This section comes after the narrative and before test information in the real report.",
      "Recommendations should read like reviewed engineering output, not brainstorming.",
    ],
    apiGuardRails: [
      "Use deterministic calculations and reviewer-approved evidence before drafting recommendations.",
      "Do not fabricate assessment outcomes from prose alone.",
    ],
    outputConstraints: [
      "Human approval is mandatory before release.",
      "Separate observations from recommendation wording.",
    ],
    sectionPromptProfile: [
      "Structure this section as finding, impact, recommendation.",
      "Keep tone neutral and approval-aware.",
    ],
  },
  "test-information": {
    sampleReportFormat: [
      "Keep this as a compact methods-and-dates section.",
      "Use inspection methods actually present in the package.",
    ],
    apiGuardRails: [
      "Do not list methods that were not captured.",
      "Prefer direct inspection metadata over inferred process text.",
    ],
    outputConstraints: [
      "Short, factual, and methods-focused.",
    ],
    sectionPromptProfile: [
      "Keep this section compact.",
      "Prefer tight method-summary wording over narrative prose.",
    ],
  },
  "tank-inspection-checklist": {
    sampleReportFormat: [
      "The sample report treats the checklist as a dedicated section, not buried in narrative.",
      "Checklist outcomes should be summarizable after manual completion.",
    ],
    apiGuardRails: [
      "Checklist answers remain user-owned facts.",
      "Do not mark unanswered checklist items as passed.",
    ],
    outputConstraints: [
      "Show unanswered or needs-review items clearly.",
      "Summary should reflect actual checklist state.",
    ],
    sectionPromptProfile: [
      "Summarize outcomes as grouped checklist results.",
      "Make unresolved items visible.",
    ],
  },
  "roof-plate-thickness-measurements": {
    sampleReportFormat: [
      "This section precedes roof layout in the real report.",
      "Present measurements first, then short commentary if needed.",
    ],
    apiGuardRails: [
      "Use actual roof UT rows and notes.",
      "Do not invent original thickness assumptions or extra plate IDs.",
    ],
    outputConstraints: [
      "Keep commentary tied to rows and linked roof findings.",
    ],
    sectionPromptProfile: [
      "Use a short intro plus table-supporting commentary.",
      "Do not turn this into a long narrative section.",
    ],
  },
  "roof-plate-layout": {
    sampleReportFormat: [
      "The layout page should visually follow the roof thickness section.",
      "Use the layout as a location aid and report figure, not as freeform design art.",
    ],
    apiGuardRails: [
      "Only describe markers and roof features that exist in the current scene.",
      "Do not claim CAD precision beyond the renderer's current capability.",
    ],
    outputConstraints: [
      "Prefer captioning, labels, and location explanation over narrative overload.",
    ],
    sectionPromptProfile: [
      "Write this like a figure caption with a short support note.",
      "Keep the text secondary to the layout figure.",
    ],
  },
  "roof-nozzle-reinforcement-measurements": {
    sampleReportFormat: [
      "This section comes right after the roof layout in the real report.",
      "Focus on roof nozzle and pad measurement context only.",
    ],
    apiGuardRails: [
      "Do not imply reinforcement-pad readings exist if only registry data is present.",
      "Use actual nozzle definitions and rows only.",
    ],
    outputConstraints: [
      "Be explicit about missing pad detail.",
    ],
    sectionPromptProfile: [
      "Use short measurement-led wording.",
      "Call out missing pad detail directly.",
    ],
  },
  "minimum-shell-thickness-calculations": {
    sampleReportFormat: [
      "The real report includes a dedicated calculations section before shell thickness tables.",
      "Numbers should read as formal engineering calculations, not generated prose.",
    ],
    apiGuardRails: [
      "Only use deterministic calculation outputs once the engine exists.",
      "Do not invent minimum thickness results.",
    ],
    outputConstraints: [
      "Keep this section blocked or manual until real calculations are available.",
    ],
    sectionPromptProfile: [
      "This section should read like a formal calculations block.",
      "Do not create pseudo-math from prose.",
    ],
  },
  "shell-plate-thickness-measurements": {
    sampleReportFormat: [
      "This is a major tabular section in the real report and should stay row-grounded.",
      "Shell thickness commentary should follow the measurement evidence closely.",
    ],
    apiGuardRails: [
      "Use actual shell line plan and shell UT rows.",
      "Do not summarize shell condition without row-level support.",
    ],
    outputConstraints: [
      "Commentary must remain tied to measured coverage and linked findings.",
    ],
    sectionPromptProfile: [
      "Use a short intro plus table-supporting commentary.",
      "Lead with lane/course coverage before interpretation.",
    ],
  },
  "shell-plate-layout": {
    sampleReportFormat: [
      "The shell layout page follows shell thickness measurements in the sample report.",
      "Use it to locate shell rows, nozzles, and findings in a report-usable figure.",
    ],
    apiGuardRails: [
      "Describe only visible shell markers and known shell geometry.",
      "Do not exaggerate visual precision beyond the current renderer.",
    ],
    outputConstraints: [
      "Prefer captions, labels, and evidence linkage over broad narrative text.",
    ],
    sectionPromptProfile: [
      "Write this like a figure caption with a short support note.",
      "Keep the text secondary to the shell layout figure.",
    ],
  },
  "shell-nozzle-reinforcement-measurements": {
    sampleReportFormat: [
      "This section closes the shell measurement run before photographs.",
      "Keep shell nozzle discussion concise and measurement-led.",
    ],
    apiGuardRails: [
      "Do not imply reinforcement-pad data exists if it is only in notes.",
      "Use shell nozzle rows and registry data exactly.",
    ],
    outputConstraints: [
      "Make data gaps visible instead of smoothing them over.",
    ],
    sectionPromptProfile: [
      "Use short measurement-led wording.",
      "Make missing nozzle or pad detail explicit.",
    ],
  },
  photographs: {
    sampleReportFormat: [
      "The photographs section acts like an evidence appendix.",
      "Captions should be short and useful, not narrative-heavy.",
    ],
    apiGuardRails: [
      "Only describe uploaded attachments and linked finding context.",
      "Do not infer unseen conditions from a photograph caption alone.",
    ],
    outputConstraints: [
      "Keep captions factual and location-aware.",
    ],
    sectionPromptProfile: [
      "Prefer caption-style output or grouped evidence notes.",
      "Keep descriptions short and factual.",
    ],
  },
  "floor-plate-layout": {
    sampleReportFormat: [
      "The real report includes floor layout and MFL-related sections later in the document.",
      "Keep these sections visible for format honesty.",
    ],
    apiGuardRails: [
      "Do not generate floor layout content without actual floor data.",
    ],
    outputConstraints: [
      "State clearly that this section is deferred or blocked.",
    ],
    sectionPromptProfile: [
      "Use one short blocked-state explanation.",
      "Do not simulate floor layout content.",
    ],
  },
  "floor-recommended-repair-locations": {
    sampleReportFormat: [
      "This section should remain in the report sequence even if blocked today.",
    ],
    apiGuardRails: [
      "Do not invent repair locations without floor evidence and reviewer approval.",
    ],
    outputConstraints: [
      "Keep the blocked reason explicit.",
    ],
    sectionPromptProfile: [
      "Use one short blocked-state explanation.",
      "State what must exist before this section can be drafted.",
    ],
  },
  "tru-flux-guidelines": {
    sampleReportFormat: [
      "The sample report contains a dedicated TRU-FLUX interpretation guidance section.",
    ],
    apiGuardRails: [
      "Do not summarize or interpret TRU-FLUX data if none is present.",
    ],
    outputConstraints: [
      "Treat this as deferred MFL support.",
    ],
    sectionPromptProfile: [
      "Use one short blocked-state explanation.",
      "Keep the wording honest about deferred TRU-FLUX support.",
    ],
  },
  "floor-plate-corrosion-plan": {
    sampleReportFormat: [
      "This belongs to the floor/MFL tail of the real report structure.",
    ],
    apiGuardRails: [
      "Do not generate a corrosion plan without floor mapping and evidence.",
    ],
    outputConstraints: [
      "Remain blocked until floor workflow exists.",
    ],
    sectionPromptProfile: [
      "Use one short blocked-state explanation.",
      "Do not imply corrosion-plan outputs exist.",
    ],
  },
  "magnetic-flux-leakage-platemaps": {
    sampleReportFormat: [
      "The report closes with MFL platemaps in the sample document.",
    ],
    apiGuardRails: [
      "Do not fabricate platemap content or labels when no MFL dataset exists.",
    ],
    outputConstraints: [
      "Visible for format consistency only until MFL support is implemented.",
    ],
    sectionPromptProfile: [
      "Use one short blocked-state explanation.",
      "Do not invent platemap content or labels.",
    ],
  },
};

export function getSectionReferenceBundle(sectionId: string): SectionReferenceBundle {
  return bundles[sectionId] ?? defaultBundle;
}
