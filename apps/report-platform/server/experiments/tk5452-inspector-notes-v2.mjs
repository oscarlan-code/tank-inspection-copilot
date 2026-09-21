// Authored mock capture, not original audio or an independent field inspection.
// Source IDs below are preparation-side references only; never export them to a worker.
const c = (kind, number, note) => ({ sourceId: `tk5452-${kind}-${number}`, note });
const s = (number, note) => c('scope', number, note);
const f = (number, note) => c('finding', number, note);
const r = (number, note) => c('recommendation', number, note);
const event = (id, label, targetKey, cardKey, claims) => ({ id, label, targetKey, cardKey, screenKey: cardKey === 'inspection_scope' ? 'task_home' : 'inspection_checklist', claims });

export const INSPECTOR_NOTE_EVENTS = [
  event('scope-roof-shell', 'Job brief: roof and shell', 'tank', 'inspection_scope', [
    s(1, 'Roof UT on the job list. Minimum 5 readings on each plate, only where access, safety and the surface allow it.'),
    s(2, 'Side wall: use ultrasonic crawler, or another suitable permitted method. Cover 4 compass positions, at least 5 readings per strake.'),
  ]),
  event('scope-floor', 'Job brief: floor and sump', 'tank', 'inspection_scope', [
    s(3, 'Floor work planned: MFLmap, backed up with continuous ultrasonic corrosion scanning of the plates.'),
    s(4, 'Include a continuous corrosion scan of the perimeter band, 100 mm wide. Also scan the patches the MFLmap cannot reach.'),
    s(5, 'Sump at the tank bottom: thickness readings needed as well.'),
    s(6, 'Floor B-scan is sampling only, at selected areas.'),
  ]),
  event('scope-other', 'Job brief: fittings, visual checks and deliverables', 'tank', 'inspection_scope', [
    s(7, 'Add UT spot checks for the inside and outside nozzles and piping in the tank.'),
    s(8, 'Visual walkdown too. Note anything that could affect tank serviceability.'),
    s(9, 'Deliverable: full report, readings tied to their locations, API 653 review, engineering integrity assessment and comments.'),
  ]),
  event('piping', 'Diked area: piping', 'surroundings', 'diked_area', [
    f(1, 'Tank site piping already taken apart and removed before this inspection.'),
    f(2, 'Weathered paint and rust on the site piping.'),
    f(3, 'Spot UT at several points on the removed pipes: satisfactory.'),
    f(4, 'Detailed pipe readings are on the tank piping spot-UT sheet.'),
    f(5, 'Piping drawing to use: IRS/SE/19T5452-3.'),
    r(1, 'Recommend recoating the site pipe areas where the paint has failed.'),
  ]),
  event('foundation-visual', 'Foundation and floor projection: visual checks', 'floor', 'tank_foundation', [
    f(6, 'Earth connections, North and South: satisfactory.'),
    f(7, 'Floor projection is about 2.5 inches wide.'),
    f(8, 'West projection edge: minor corrosion along roughly 450 mm.'),
    f(9, 'Also failed paint with minor corrosion on the West projection.'),
    r(2, 'Recommend cleaning, surface prep and recoating on the projection wherever the paint has failed or there is minor corrosion, including the leading edge.'),
  ]),
  event('foundation-ut', 'Floor projection: scan notes', 'floor', 'tank_foundation', [
    f(10, 'Projection scan: generally 5.90 to 6.45 mm left, average 6.00 mm. Separate Northeast patch is about 480 mm long. Up to 2 inches from the shell-to-floor weld: 5.90 to 6.45 mm, average 6.00 mm. At 2 inches away from that weld: 4.80 to 6.00 mm, average 5.70 mm.'),
    f(11, 'Could not run the B-scan buggy on the projection. It needs a strip at least 3 inches wide to travel properly.'),
  ]),
  event('shell-outside', 'External shell walkdown', 'shell', 'shell_external', [
    f(12, 'Viewed the outside shell from ground level.'),
    f(13, 'Failed paint on the external shell at the manhole and around it.'),
    f(14, 'North and South outside shell: spots of rust.'),
    f(15, 'Outside shell UT: 6.00 to 6.38 mm. Every reading is above the calculated minimum thickness.'),
    f(16, 'Full set of shell readings is on the shell plate UT sheet.'),
    f(17, 'Shell drawing: IRS/SE/19T5452-2.'),
    r(3, 'Recommend cleaning, preparing and recoating the outside shell patches with failed paint or spot rust.'),
  ]),
  event('shell-fittings', 'Shell nozzles and connecting pipes', 'shell', 'shell_appurtenances', [
    f(18, 'S4, South side, 2-inch nozzle: inside at 6 o\'clock, minor corrosion, about 0.5 mm.'),
    f(19, 'Shell nozzle tell-tales at 6 o\'clock: not compliant with the code.'),
    f(20, 'Shell connection pipes were already dismantled and removed when inspected.'),
    f(21, 'Spot UT on outside shell nozzles and the removed pipes: satisfactory.'),
    f(22, 'Detailed readings: shell nozzle and pad UT sheet, plus tank piping spot-UT sheet.'),
    f(23, 'Use drawings IRS/SE/19T5452-2 and IRS/SE/19T5452-3 for these fittings and pipes.'),
  ]),
  event('ladder', 'Access ladder', 'shell', 'access_structure', [
    f(24, 'Vertical ladder fixed to the shell: looks satisfactory on visual check.'),
  ]),
  event('roof-outside', 'External fixed roof and curb angle', 'external_roof', 'fixed_roof_cone_dome', [
    f(25, 'Outside roof plates: patches of failed paint scattered across them.'),
    f(26, 'Under the curb angle, minor corrosion at the leading edge.'),
    f(27, 'Roof is not frangible. Weld around the roof edge is about 6 to 8 mm.'),
    f(28, 'Spot UT on outside roof plates: remaining metal 3.96 to 4.48 mm.'),
    f(29, 'Roof plate UT sheet has the detailed readings.'),
    f(30, 'Roof drawing reference IRS/SE/19T5452-1.'),
    r(4, 'Recommend clean-up, surface preparation and recoating for corroded outside roof plates and curb angle.'),
    r(5, 'Recommend an emergency-venting assessment for this roof because the design is non-frangible.'),
  ]),
  event('roof-fittings', 'Roof manhole, nozzles and bracket', 'external_roof', 'roof_appurtenances', [
    f(31, 'Paint generally failed on roof manhole and nozzles, with minor corrosion following it.'),
    f(32, 'Inlet on roof, 3-inch nozzle: flange face has minor corrosion, about 0.5 mm metal loss.'),
    f(33, 'Outside roof bracket connection: minor crevice attack.'),
    f(34, 'Roof connecting pipes were dismantled and removed by inspection time.'),
    f(35, 'Spot UT on outside roof nozzles and the removed pipes: satisfactory.'),
    f(36, 'Details on the roof nozzle/pad UT sheet and the tank piping spot-UT sheet.'),
    f(37, 'For these roof fittings use drawing IRS/SE/19T5452-1.'),
    r(6, 'Recommend clean, prepare and recoat where the roof manhole or nozzles have failed paint and corrosion.'),
    r(7, 'Recommend cleaning out and preparing the crevice-corroded roof bracket attachment, then recoating.'),
  ]),
  event('roof-inside', 'Roof underside', 'internal_roof', 'fixed_roof_internal', [
    f(38, 'Inside roof viewed while standing on the floor.'),
    f(39, 'Underside of roof: no coating.'),
    f(40, 'Visual condition of the inside roof looks satisfactory.'),
    f(41, 'Roof vent nozzle, 3 inches: end not cut back flush.'),
  ]),
  event('shell-inside', 'Internal shell', 'shell', 'shell_internal', [
    f(42, 'Checked the inside shell visually from the floor.'),
    f(43, 'Inside shell: bare, no coating.'),
    f(44, 'Inside shell looks satisfactory on visual examination.'),
    f(45, 'Spot UT on internal shell nozzles and removed pipework: satisfactory.'),
    f(46, 'Readings filed under shell nozzle/pad UT and tank piping spot UT.'),
    f(47, 'Piping layout for this check: IRS/SE/19T5452-3.'),
  ]),
  event('floor-visual', 'Inside floor: visual check', 'floor', 'floor_internal', [
    f(48, 'Floor arrangement: bottom plates only, disk-type sump in the centre.'),
    f(49, 'Floor inside has no coating.'),
    f(50, 'Some bottom plates have weld tags here and there.'),
    f(51, 'Did not see significant pitting on the top face of the bottom plates.'),
  ]),
  event('floor-mfl', 'Bottom plates: MFL and UT verification', 'floor', 'floor_internal', [
    f(52, 'Bottom plate MFL: no significant signal for loss underneath. Minor calls at 20% loss were checked with UT, plus random spots elsewhere on the plates. UT remaining metal 5.95 to 6.20 mm, average 6.00 mm.'),
  ]),
  event('floor-band', 'Floor strip beside the shell', 'floor', 'floor_internal', [
    f(53, 'Inside perimeter, 100 mm strip beside the shell: scan gives 5.82 to 6.38 mm left, mean 6.00 mm. No significant corrosion underneath in that strip.'),
  ]),
  event('floor-restricted', 'Floor areas outside MFL access', 'floor', 'floor_internal', [
    f(54, 'Used UT scan on floor patches the MFL could not access: remaining metal 5.98 to 6.27 mm, mean 6.00 mm. No significant underside corrosion there.'),
  ]),
  event('sump', 'Centre sump: visual, dimensions and UT', 'floor', 'floor_internal', [
    f(55, 'Centre disk sump looks satisfactory visually.'),
    f(56, 'Sump size noted: 300 mm across, 135 mm deep.'),
    f(57, 'Inside sump UT: upper wall 7.5 to 9.8 mm, lower wall 6.4 to 8.0 mm, bottom 6.0 to 7.0 mm remaining.'),
    f(58, 'Could not do sump B-scan. The curved shape stops the buggy moving through it.'),
  ]),
];
