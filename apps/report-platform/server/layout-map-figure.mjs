const SVG_WIDTH = 1120;
const SVG_HEIGHT = 720;
const CIRCULAR_MAP = {
  x: 56,
  y: 60,
  size: 640,
};
const SHELL_GRID = {
  x: 88,
  y: 132,
  width: 820,
  height: 420,
};
const DRAWING_BLOCK = {
  x: 812,
  y: 596,
  width: 280,
  height: 104,
};

export function buildLayoutFigureSvg(reportState, tocSection) {
  const layoutMap = getEffectiveLayoutMap(reportState, tocSection);
  if (!layoutMap) return null;

  return buildLayoutMapFigureSvg(layoutMap);
}

export function buildLayoutMapFigureSvg(layoutMap) {
  if (!layoutMap) return null;

  if (layoutMap.appMap?.surfaceType === "floor" && layoutMap.sourceDrawing) {
    return buildSourceFloorFigureSvg(layoutMap);
  }

  const clipId = `circle-clip-${safeId(layoutMap.id)}`;
  const floorOuterClipId = floorTankClipId(layoutMap.id);
  const annularWidthRatio = layoutMap.appMap?.floor?.annularWidthRatio ?? 0.12;
  const floorOuterRadius = CIRCULAR_MAP.size * 0.42
    * (1 + clamp(annularWidthRatio, 0.06, 0.18));
  const body =
    layoutMap.appMap?.surfaceType === "shell"
      ? renderShellMap(layoutMap)
      : renderCircularMap(layoutMap, clipId);

  return {
    title: layoutMap.title,
    width: SVG_WIDTH,
    height: SVG_HEIGHT,
    svg: [
      `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(layoutMap.title)}" viewBox="0 0 ${SVG_WIDTH} ${SVG_HEIGHT}" width="${SVG_WIDTH}" height="${SVG_HEIGHT}">`,
      "<defs>",
      "<style>",
      svgStyles(),
      "</style>",
      `<clipPath id="${clipId}"><circle cx="${CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2}" cy="${CIRCULAR_MAP.y + CIRCULAR_MAP.size / 2}" r="${CIRCULAR_MAP.size * 0.42}" /></clipPath>`,
      ...(layoutMap.appMap?.surfaceType === "floor"
        ? [`<clipPath id="${floorOuterClipId}"><circle cx="${CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2}" cy="${CIRCULAR_MAP.y + CIRCULAR_MAP.size / 2}" r="${floorOuterRadius}" /></clipPath>`]
        : []),
      ...(layoutMap.appMap?.surfaceType === "floor"
        ? layoutMap.plates.map((plate) => (
            `<clipPath id="${floorPlateClipId(layoutMap.id, plate.id)}">${renderCircularPlateShape(plate)}</clipPath>`
          ))
        : []),
      "</defs>",
      `<rect class="map-page" height="${SVG_HEIGHT - 18}" rx="22" width="${SVG_WIDTH - 18}" x="9" y="9" />`,
      body,
      renderDrawingBlock(layoutMap),
      "</svg>",
    ].join(""),
  };
}

function buildSourceFloorFigureSvg(layoutMap) {
  const sourceDrawing = layoutMap.sourceDrawing;
  const width = Number(sourceDrawing.width) || SVG_WIDTH;
  const height = Number(sourceDrawing.height) || SVG_HEIGHT;
  const sourceHref = safeInlineCorrosionImage(sourceDrawing.inlineImageDataUrl);
  const foregroundHref = safeInlineCorrosionImage(sourceDrawing.foregroundInlineImageDataUrl);
  const usesExtractedVector = sourceDrawing.renderMode === "extracted_vector";
  const platesById = new Map(layoutMap.plates.map((plate) => [plate.id, plate]));
  const overlays = (layoutMap.floorCorrosion?.overlays ?? []).flatMap((overlay) => {
    const plate = platesById.get(overlay.hostPlateId);
    const href = safeInlineCorrosionImage(overlay.inlineImageDataUrl);
    if (!plate || !href || overlay.status === "blocked") return [];
    const rect = sourcePlateRect(plate, width, height);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const rotation = normalizeRotation(overlay.rotationDegrees);
    const swapsAxes = rotation === 90 || rotation === 270;
    const imageWidth = swapsAxes ? rect.height : rect.width;
    const imageHeight = swapsAxes ? rect.width : rect.height;
    const transform = [
      `translate(${centerX} ${centerY})`,
      `rotate(${rotation})`,
      `scale(${overlay.flipX ? -1 : 1} ${overlay.flipY ? -1 : 1})`,
      `translate(${-centerX} ${-centerY})`,
    ].join(" ");
    return [
      `<g clip-path="url(#${sourceFloorPlateClipId(layoutMap.id, plate.id)})">`,
      `<image class="floor-corrosion-overlay" href="${href}" x="${centerX - imageWidth / 2}" y="${centerY - imageHeight / 2}" width="${imageWidth}" height="${imageHeight}" opacity="${clamp(overlay.opacity ?? 0.88, 0.1, 1)}" preserveAspectRatio="xMidYMid slice" transform="${transform}" />`,
      "</g>",
    ];
  });

  return {
    title: layoutMap.title,
    width,
    height,
    svg: [
      `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(layoutMap.title)}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
      "<defs>",
      ...layoutMap.plates.map((plate) => (
        `<clipPath id="${sourceFloorPlateClipId(layoutMap.id, plate.id)}">${renderSourcePlateShape(plate, width, height)}</clipPath>`
      )),
      "</defs>",
      `<rect x="0" y="0" width="${width}" height="${height}" fill="#ffffff" />`,
      ...(!usesExtractedVector && sourceHref
        ? [`<image href="${sourceHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" />`]
        : []),
      ...overlays,
      ...(usesExtractedVector && sourceHref
        ? [`<image href="${sourceHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" />`]
        : []),
      ...(foregroundHref
        ? [`<image href="${foregroundHref}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="none" />`]
        : []),
      "</svg>",
    ].join(""),
  };
}

function renderSourcePlateShape(plate, width, height) {
  if (Array.isArray(plate.points) && plate.points.length >= 3) {
    const points = plate.points.map((point) => `${point.x * width},${point.y * height}`).join(" ");
    return `<polygon points="${points}" />`;
  }
  const rect = sourcePlateRect(plate, width, height);
  return `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" />`;
}

function sourcePlateRect(plate, width, height) {
  return {
    x: plate.x * width,
    y: plate.y * height,
    width: plate.width * width,
    height: plate.height * height,
  };
}

function sourceFloorPlateClipId(layoutMapId, plateId) {
  return `source-floor-plate-clip-${safeId(`${layoutMapId}-${plateId}`)}`;
}

export function getEffectiveLayoutMap(reportState, tocSection) {
  const surface = tocSection?.layoutSurface;
  if (!surface || !reportState?.exportPackage) return null;

  const override = reportState.layoutOverrides?.find((item) => item.sectionId === tocSection.id)?.layoutMap;
  const exportLayoutMap = buildLayoutMapFromExport(reportState, tocSection);
  if (override?.appMap?.surfaceType === surface) {
    return normalizeLayoutMap(mergeLayoutOverrideWithBaseline(exportLayoutMap, override));
  }

  return exportLayoutMap;
}

function buildLayoutMapFromExport(reportState, tocSection) {
  const { exportPackage } = reportState;
  const surface = tocSection.layoutSurface;
  const targetKey = surface === "roof" ? "external_roof" : surface;
  const config = exportPackage.layoutConfigs.find((item) => item.targetKey === targetKey);
  if (!config) return null;

  if (surface === "shell") {
    return buildShellLayoutMap(reportState, tocSection, config);
  }

  return buildCircularLayoutMap(reportState, tocSection, config);
}

function buildCircularLayoutMap(reportState, tocSection, config) {
  const { exportPackage } = reportState;
  const surface = tocSection.layoutSurface;
  const targetKey = surface === "roof" ? "external_roof" : "floor";
  const requiresResolvedGeometry = surface === "floor"
    && exportPackage.packageType === "v3_product_export"
    && exportPackage.schemaVersion >= 3;
  const gridRows =
    surface === "roof"
      ? config.roofRowCount ?? 6
      : config.floorPatternCountX ?? Math.max(1, Math.ceil(Math.sqrt(config.floorPlateCount || 36)));
  const gridColumns =
    surface === "roof"
      ? config.roofWidestRowPlateCount ?? 11
      : config.floorPatternCountY ?? Math.max(1, Math.ceil((config.floorPlateCount || gridRows) / gridRows));
  const plates = buildAndroidCircularPlateCells(
    gridRows,
    gridColumns,
    surface === "roof" ? "android:RoofSurfaceMap:circular_plate" : "android:FloorSurfaceMap:circular_plate",
  );
  const customPlates = buildCustomCircularPlateCells(
    config.customCircularLayout,
    surface === "roof"
      ? "v3-app:RoofSurfaceMap:custom_circular_plate"
      : "v3-app:FloorSurfaceMap:custom_circular_plate",
    gridRows,
    gridColumns,
    surface,
    !requiresResolvedGeometry,
  );
  const mainPlates = (customPlates.length > 0 ? customPlates : requiresResolvedGeometry ? [] : plates)
    .map((plate) => ({ ...plate, plateKind: "main" }));
  const customLayoutSettings = readCircularLayoutSettings(config.customCircularLayout);
  const resolvedAnnularPlates = parseResolvedAnnularPlateGeometry(
    config.customCircularLayout,
    "v3-app:FloorSurfaceMap:annular_ring:resolved",
  );
  const annularPlates = surface === "floor" && config.floorTemplate === "circular_plate_ar"
    ? resolvedAnnularPlates.length > 0
      ? resolvedAnnularPlates
      : requiresResolvedGeometry
        ? []
        : buildV3AppAnnularRingSections(
          config.floorAnnularSectionCount ?? 0,
          customLayoutSettings.annularRotationDeg,
          customLayoutSettings.annularWidthRatio,
          "v3-app:FloorSurfaceMap:annular_ring:legacy_fallback",
        )
    : [];
  const effectivePlates = [...mainPlates, ...annularPlates];
  const markers = [
    ...buildTargetFindingMarkers(exportPackage, targetKey, effectivePlates),
    ...buildTargetElementMarkers(exportPackage, targetKey),
  ];

  return normalizeLayoutMap({
    id: tocSection.id,
    title: tocSection.title,
    subtitle:
      surface === "roof"
        ? customPlates.length > 0
          ? `Roof map: V3 app custom circular plate layout, ${gridRows} rows, ${effectivePlates.length} visible plates`
          : `Roof map: circular plate template, ${gridRows} rows, ${gridColumns} widest-row plates, ${effectivePlates.length} visible plates`
        : customPlates.length > 0
          ? `V3 app floor layout: ${gridRows} rows, ${mainPlates.length} bottom plates, ${annularPlates.length} AR sections`
          : `Floor map: circular plate template, ${gridRows} rows, ${gridColumns} widest-row plates, ${effectivePlates.length} visible plates`,
    surfaceLabel: surface === "roof" ? "Roof plate layout" : "Floor/bottom plate layout",
    appFigure: surface === "floor"
      ? exportPackage.layoutFigures?.find((figure) => figure.targetKey === "floor")
      : undefined,
    markers,
    plates: effectivePlates,
    gridRows,
    gridColumns,
    drawingBlock: buildDrawingBlock(reportState, tocSection, config),
    appMap: {
      surfaceType: surface,
      referenceMode: humanizeKey(config.referenceMode ?? "tank_north"),
      referenceNote: config.referenceNote,
      ...(surface === "floor"
        ? {
            floor: {
              template: config.floorTemplate ?? "circular_plate",
              rowCount: gridRows,
              widestRowPlateCount: gridColumns,
              plateCount: config.floorPlateCount ?? mainPlates.length,
              hasAnnularRing: config.floorTemplate === "circular_plate_ar",
              annularSectionCount: config.floorAnnularSectionCount ?? 0,
              annularRotationDeg: customLayoutSettings.annularRotationDeg,
              annularWidthRatio: customLayoutSettings.annularWidthRatio,
              customCircularLayout: config.customCircularLayout,
            },
          }
        : {}),
    },
    overrideCount: 0,
  });
}

function buildShellLayoutMap(reportState, tocSection, config) {
  const { exportPackage } = reportState;
  const gridRows = config.shellCourseCount ?? exportPackage.inspectionRecord.shellCourseCount ?? 8;
  const gridColumns = config.shellLaneCount ?? exportPackage.inspectionRecord.shellLaneCount ?? 4;
  const plates = buildAndroidShellPlateSegments(
    gridRows,
    config.shellPlatesPerCourse ?? 9,
    config.shellPlateOffset ?? "none",
    config.shellOffsetStartRow ?? "even",
    config.shellThirdOffsetStart,
  );
  const markers = [
    ...buildShellFindingMarkers(exportPackage, gridRows, gridColumns),
    ...buildTargetElementMarkers(exportPackage, "shell"),
  ];

  return normalizeLayoutMap({
    id: tocSection.id,
    title: tocSection.title,
    subtitle: `Shell map: ${gridRows} courses, ${gridColumns} UT lanes`,
    surfaceLabel: "Shell layout",
    markers,
    plates,
    gridRows,
    gridColumns,
    drawingBlock: buildDrawingBlock(reportState, tocSection, config),
    appMap: {
      surfaceType: "shell",
      referenceMode: humanizeKey(config.referenceMode ?? "tank_north"),
      referenceNote: config.referenceNote,
      shell: {
        courseCount: gridRows,
        platesPerCourse: config.shellPlatesPerCourse ?? 9,
        laneCount: gridColumns,
        plateOffset: config.shellPlateOffset ?? "none",
        offsetStartRow: config.shellOffsetStartRow ?? "even",
        thirdOffsetStart: config.shellThirdOffsetStart,
      },
    },
    overrideCount: 0,
  });
}

function buildDrawingBlock(reportState, tocSection, config) {
  const { exportPackage, reportJob, manualSupplement } = reportState;
  const surfaceLabel = tocSection.layoutSurface === "roof"
    ? "External Roof Layout"
    : tocSection.layoutSurface === "floor"
      ? "Floor Plate Layout"
      : "Shell Layout";

  return {
    client: exportPackage.task.client,
    project: `Tank ${exportPackage.task.tankNumber} ${surfaceLabel}`,
    drawing: `Section-${tocSection.number}`,
    reference: manualSupplement?.reportReference ?? reportJob?.reportReference ?? "Pending confirmation",
    referenceMode: humanizeKey(config.referenceMode ?? "tank_north"),
    updatedAtLabel: formatShortDate(exportPackage.exportedAtIso),
  };
}

function normalizeLayoutMap(layoutMap) {
  return {
    ...layoutMap,
    markers: (layoutMap.markers ?? []).map(clampMarker),
    plates: (layoutMap.plates ?? []).map(clampPlate),
  };
}

function mergeLayoutOverrideWithBaseline(baselineLayoutMap, layoutOverride) {
  if (!baselineLayoutMap) return layoutOverride;

  const overrideMarkersById = new Map((layoutOverride.markers ?? []).map((marker) => [marker.id, marker]));
  const lockAppFloorGeometry = baselineLayoutMap.appMap?.surfaceType === "floor"
    && Boolean(baselineLayoutMap.appFigure?.svg);
  const replaceBaselineMarkers = layoutOverride.geometrySource === "reference_test_fixture"
    || layoutOverride.geometrySource === "app_export_mock"
    || layoutOverride.geometrySource === "report_side_approved_layout"
    || layoutOverride.geometrySource === "source_drawing_import";

  return {
    ...baselineLayoutMap,
    ...layoutOverride,
    geometrySource: lockAppFloorGeometry ? baselineLayoutMap.geometrySource : layoutOverride.geometrySource,
    sourceDrawing: lockAppFloorGeometry ? undefined : layoutOverride.sourceDrawing,
    appFigure: lockAppFloorGeometry ? baselineLayoutMap.appFigure : layoutOverride.appFigure ?? baselineLayoutMap.appFigure,
    plates: lockAppFloorGeometry
      ? baselineLayoutMap.plates
      : Array.isArray(layoutOverride.plates) && layoutOverride.plates.length > 0
      ? layoutOverride.plates
      : baselineLayoutMap.plates,
    markers: lockAppFloorGeometry
      ? baselineLayoutMap.markers
      : replaceBaselineMarkers
      ? (layoutOverride.markers ?? [])
      : (baselineLayoutMap.markers ?? []).map((baselineMarker) => {
          const overrideMarker = overrideMarkersById.get(baselineMarker.id);
          return overrideMarker
            ? {
                ...baselineMarker,
                ...overrideMarker,
              }
            : baselineMarker;
        }),
    drawingBlock: {
      ...(baselineLayoutMap.drawingBlock ?? {}),
      ...(layoutOverride.drawingBlock ?? {}),
    },
    appMap: lockAppFloorGeometry
      ? baselineLayoutMap.appMap
      : {
          ...(baselineLayoutMap.appMap ?? {}),
          ...(layoutOverride.appMap ?? {}),
        },
  };
}

function renderCircularMap(layoutMap, clipId) {
  const center = CIRCULAR_MAP.x + CIRCULAR_MAP.size / 2;
  const radius = CIRCULAR_MAP.size * 0.42;
  const annularWidthRatio = layoutMap.appMap?.floor?.annularWidthRatio ?? 0.12;
  const annularRadius = radius * (1 + clamp(annularWidthRatio, 0.06, 0.18));
  const annularPlates = layoutMap.plates.filter(isAnnularPlate);
  const mainPlates = layoutMap.plates.filter((plate) => !isAnnularPlate(plate));
  const appFigureHref = layoutMap.appMap?.surfaceType === "floor"
    ? safeAppOwnedFloorFigureDataUri(layoutMap.appFigure)
    : null;

  if (appFigureHref) {
    return [
      `<text class="map-title" x="${CIRCULAR_MAP.x}" y="38">Floor Layout Map</text>`,
      `<text class="map-subtitle" x="${CIRCULAR_MAP.x}" y="58">Reference: 0 degree = ${escapeXml(layoutMap.appMap?.referenceMode ?? layoutMap.drawingBlock.referenceMode)}</text>`,
      `<image href="${appFigureHref}" x="${CIRCULAR_MAP.x}" y="${CIRCULAR_MAP.y}" width="${CIRCULAR_MAP.size}" height="${CIRCULAR_MAP.size}" preserveAspectRatio="xMidYMid meet" />`,
      ...(layoutMap.floorCorrosion
        ? [
            `<g clip-path="url(#${floorTankClipId(layoutMap.id)})">`,
            ...renderFloorCorrosionOverlays(layoutMap, "main"),
            ...renderFloorCorrosionOverlays(layoutMap, "annular"),
            "</g>",
          ]
        : []),
      ...(layoutMap.floorCorrosion ? [renderFloorCorrosionLegend()] : []),
      renderMarkers(
        {
          ...layoutMap,
          markers: (layoutMap.markers ?? []).filter((marker) => marker.type !== "element"),
        },
        CIRCULAR_MAP,
      ),
    ].join("");
  }

  return [
    `<text class="map-title" x="${CIRCULAR_MAP.x}" y="38">${escapeXml(
      layoutMap.floorCorrosion
        ? "Floor Plate Corrosion Map"
        : layoutMap.appMap?.surfaceType === "floor"
          ? "Floor Layout Map"
          : "Roof Layout Map",
    )}</text>`,
    `<text class="map-subtitle" x="${CIRCULAR_MAP.x}" y="58">Reference: 0 degree = ${escapeXml(layoutMap.appMap?.referenceMode ?? layoutMap.drawingBlock.referenceMode)}</text>`,
    ...annularPlates.map((plate) => renderCircularPlateShape(plate, 'class="plate"')),
    `<circle class="circular-fill" cx="${center}" cy="${center}" r="${radius}" />`,
    `<line class="reference-line" x1="${center}" x2="${center}" y1="${center}" y2="${center - annularRadius}" />`,
    `<text class="zero-label" x="${center - 8}" y="${center - annularRadius - 10}">0°</text>`,
    `<g clip-path="url(#${clipId})">`,
    ...mainPlates.map((plate) => renderCircularPlateShape(plate, 'class="plate"')),
    ...(layoutMap.appMap?.surfaceType === "floor"
      ? renderFloorCorrosionOverlays(layoutMap, "main")
      : []),
    "</g>",
    ...(layoutMap.appMap?.surfaceType === "floor"
      ? renderFloorCorrosionOverlays(layoutMap, "annular")
      : []),
    `<circle class="circular-outline" cx="${center}" cy="${center}" r="${radius}" />`,
    ...(annularPlates.length > 0
      ? [`<circle class="circular-outline" cx="${center}" cy="${center}" r="${annularRadius}" />`]
      : []),
    ...(layoutMap.floorCorrosion ? [renderFloorCorrosionLegend()] : []),
    ...layoutMap.plates.flatMap((plate) => {
      const displayLabel = plate.mapLabel ?? plate.label;
      if (displayLabel === "") return [];
      const labelX = CIRCULAR_MAP.x + (plate.labelX ?? plate.x + plate.width / 2) * CIRCULAR_MAP.size;
      const labelY = CIRCULAR_MAP.y + (plate.labelY ?? plate.y + plate.height / 2) * CIRCULAR_MAP.size + 4;
      return [`<text class="plate-label" x="${labelX}" y="${labelY}">${escapeXml(displayLabel)}</text>`];
    }),
    renderMarkers(layoutMap, CIRCULAR_MAP),
  ].join("");
}

function renderFloorCorrosionLegend() {
  const bands = [
    { label: "20", color: "#ffffff" },
    { label: "30", color: "#12fbff" },
    { label: "40", color: "#0ec800" },
    { label: "50", color: "#001dc8" },
    { label: "60", color: "#ef0700" },
    { label: "70", color: "#dc006e" },
    { label: "80", color: "#470073" },
  ];
  const x = 804;
  const y = 86;
  const swatchWidth = 34;
  return [
    `<g class="floor-corrosion-legend">`,
    `<rect height="92" rx="8" width="276" x="${x}" y="${y}" />`,
    `<text class="floor-corrosion-legend-title" x="${x + 14}" y="${y + 23}">CORROSION PERCENTAGE</text>`,
    ...bands.flatMap((band, index) => [
      `<text x="${x + 18 + index * swatchWidth}" y="${y + 45}">${band.label}</text>`,
      `<rect fill="${band.color}" height="22" stroke="#1c2f45" stroke-width="1" width="${swatchWidth}" x="${x + 14 + index * swatchWidth}" y="${y + 54}" />`,
    ]),
    "</g>",
  ].join("");
}

function renderFloorCorrosionOverlays(layoutMap, plateKind) {
  const platesById = new Map(layoutMap.plates.map((plate) => [plate.id, plate]));
  return (layoutMap.floorCorrosion?.overlays ?? []).flatMap((overlay) => {
    const plate = platesById.get(overlay.hostPlateId);
    const href = safeInlineCorrosionImage(overlay.inlineImageDataUrl);
    if (!plate || !href || overlay.status === "blocked" || isAnnularPlate(plate) !== (plateKind === "annular")) return [];

    const rect = circularPlateRect(plate);
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const rotation = normalizeRotation(overlay.rotationDegrees);
    const swapsAxes = rotation === 90 || rotation === 270;
    const imageWidth = swapsAxes ? rect.height : rect.width;
    const imageHeight = swapsAxes ? rect.width : rect.height;
    const transform = [
      `translate(${centerX} ${centerY})`,
      `rotate(${rotation})`,
      `scale(${overlay.flipX ? -1 : 1} ${overlay.flipY ? -1 : 1})`,
      `translate(${-centerX} ${-centerY})`,
    ].join(" ");

    return [
      `<g clip-path="url(#${floorPlateClipId(layoutMap.id, plate.id)})">`,
      `<image class="floor-corrosion-overlay" href="${href}" x="${centerX - imageWidth / 2}" y="${centerY - imageHeight / 2}" width="${imageWidth}" height="${imageHeight}" opacity="${clamp(overlay.opacity ?? 0.88, 0.1, 1)}" preserveAspectRatio="xMidYMid slice" transform="${transform}" />`,
      "</g>",
    ];
  });
}

function isAnnularPlate(plate) {
  return plate?.plateKind === "annular" || /^AR\d+$/i.test(plate?.id ?? "");
}

function renderCircularPlateShape(plate, attributes = "") {
  if (Array.isArray(plate.points) && plate.points.length >= 3) {
    const points = plate.points
      .map((point) => `${CIRCULAR_MAP.x + point.x * CIRCULAR_MAP.size},${CIRCULAR_MAP.y + point.y * CIRCULAR_MAP.size}`)
      .join(" ");
    return `<polygon ${attributes} points="${points}" />`;
  }

  const rect = circularPlateRect(plate);
  return `<rect ${attributes} height="${rect.height}" rx="4" width="${rect.width}" x="${rect.x}" y="${rect.y}" />`;
}

function renderShellMap(layoutMap) {
  const shell = layoutMap.appMap?.shell;
  const courseCount = shell?.courseCount ?? layoutMap.gridRows;
  const laneCount = shell?.laneCount ?? layoutMap.gridColumns;
  const plates =
    layoutMap.plates.length > 0
      ? layoutMap.plates
      : buildAndroidShellPlateSegments(
          courseCount,
          shell?.platesPerCourse ?? 9,
          shell?.plateOffset ?? "none",
          shell?.offsetStartRow ?? "even",
          shell?.thirdOffsetStart,
        );
  const rowHeight = SHELL_GRID.height / Math.max(courseCount, 1);
  const laneWidth = SHELL_GRID.width / Math.max(laneCount, 1);

  return [
    `<text class="map-title" x="${SHELL_GRID.x}" y="42">Shell Surface Map</text>`,
    `<text class="map-subtitle" x="${SHELL_GRID.x}" y="64">0 degree / 360 degree = ${escapeXml(layoutMap.appMap?.referenceMode ?? "Tank North")}</text>`,
    `<text class="map-subtitle shell-edge-label" x="${SHELL_GRID.x + SHELL_GRID.width}" y="64">360 degree</text>`,
    ...Array.from({ length: courseCount }).map((_, rowIndex) => {
      const course = courseCount - rowIndex;
      const y = SHELL_GRID.y + rowIndex * rowHeight;
      return `<text class="course-label" x="${SHELL_GRID.x - 44}" y="${y + rowHeight * 0.6}">C${course}</text>`;
    }),
    ...Array.from({ length: laneCount }).map((_, laneIndex) =>
      `<text class="lane-label" x="${SHELL_GRID.x + laneIndex * laneWidth + laneWidth / 2}" y="${SHELL_GRID.y - 18}">${escapeXml(shellLaneDisplayLabel(laneIndex, laneCount))}</text>`,
    ),
    ...plates.map((plate) => {
      const rect = shellPlateRect(plate);
      return `<rect class="shell-segment" height="${rect.height}" rx="6" width="${rect.width}" x="${rect.x}" y="${rect.y}" />`;
    }),
    ...Array.from({ length: courseCount }).flatMap((_, rowIndex) => {
      const course = courseCount - rowIndex;
      const y = SHELL_GRID.y + rowIndex * rowHeight;
      return Array.from({ length: laneCount }).map((__, laneIndex) => {
        const label = shellRegionDisplayLabel(laneIndex, laneCount, course);
        return [
          `<rect class="shell-region" height="${rowHeight - 2}" width="${laneWidth}" x="${SHELL_GRID.x + laneIndex * laneWidth}" y="${y}" />`,
          `<text class="shell-region-label" x="${SHELL_GRID.x + laneIndex * laneWidth + laneWidth / 2}" y="${y + rowHeight / 2 + 4}">${escapeXml(label)}</text>`,
        ].join("");
      });
    }),
    renderMarkers(layoutMap, SHELL_GRID),
  ].join("");
}

function renderMarkers(layoutMap, mapBox) {
  return `<g>${layoutMap.markers.map((marker) => {
    const point = markerPoint(marker, mapBox);
    const isElement = marker.type === "element";
    return [
      `<g class="${isElement ? "marker marker-element" : "marker"}">`,
      `<circle class="marker-circle" cx="${point.x}" cy="${point.y}" r="${isElement ? 8 : 9}" />`,
      `<text class="marker-label" x="${point.x + 12}" y="${point.y - 10}">${escapeXml(compactMarkerLabel(marker.label))}</text>`,
      "</g>",
    ].join("");
  }).join("")}</g>`;
}

function renderDrawingBlock(layoutMap) {
  const block = layoutMap.drawingBlock ?? {};
  return [
    `<g class="drawing-block">`,
    `<rect height="${DRAWING_BLOCK.height}" rx="8" width="${DRAWING_BLOCK.width}" x="${DRAWING_BLOCK.x}" y="${DRAWING_BLOCK.y}" />`,
    `<text x="${DRAWING_BLOCK.x + 14}" y="${DRAWING_BLOCK.y + 24}">CLIENT: ${escapeXml(block.client ?? "")}</text>`,
    `<text x="${DRAWING_BLOCK.x + 14}" y="${DRAWING_BLOCK.y + 44}">PROJECT: ${escapeXml(block.project ?? "")}</text>`,
    `<text x="${DRAWING_BLOCK.x + 14}" y="${DRAWING_BLOCK.y + 64}">DRAWING: ${escapeXml(block.drawing ?? "")}</text>`,
    `<text x="${DRAWING_BLOCK.x + 14}" y="${DRAWING_BLOCK.y + 84}">REF: ${escapeXml(block.reference ?? "")}</text>`,
    "</g>",
  ].join("");
}

function buildTargetElementMarkers(exportPackage, targetKey) {
  return exportPackage.elements
    .filter((element) => element.targetKey === targetKey)
    .map((element) => {
      const position =
        targetKey === "external_roof" || targetKey === "floor"
          ? {
              x: clamp(element.normalizedX, 0, 1),
              y: clamp(element.normalizedY, 0, 1),
            }
          : {
              x: clamp(element.normalizedX, 0, 1),
              y: clamp(element.normalizedY, 0, 1),
            };

      return {
        id: element.elementId,
        label: element.elementLabel,
        type: "element",
        x: position.x,
        y: position.y,
        source: `v3-app:element:${element.elementTypeKey}`,
      };
    });
}

function buildTargetFindingMarkers(exportPackage, targetKey, plates) {
  return exportPackage.findings
    .filter((finding) => finding.targetKey === targetKey && !isElementLinkedFinding(finding))
    .map((finding, index) => buildSurfaceFindingMarker(finding, exportPackage.elements, plates, index));
}

function isElementLinkedFinding(finding) {
  return getLinkedElementId(finding.linkedUtItemKey) != null;
}

function getLinkedElementId(linkedUtItemKey) {
  return /:element:([^:]+)$/i.exec(linkedUtItemKey ?? "")?.[1] ?? null;
}

function getLinkedRegionId(linkedUtItemKey) {
  return /:region:(.+)$/i.exec(linkedUtItemKey ?? "")?.[1] ?? null;
}

function buildSurfaceFindingMarker(finding, elements, plates, index) {
  const linkedElementId = getLinkedElementId(finding.linkedUtItemKey);
  const linkedElement = linkedElementId ? elements.find((element) => element.elementId === linkedElementId) : undefined;
  if (linkedElement) {
    const position = coerceCircularMarkerPosition(linkedElement.normalizedX + 0.025, linkedElement.normalizedY + 0.025);
    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: position.x,
      y: position.y,
    };
  }

  const linkedRegionId = getLinkedRegionId(finding.linkedUtItemKey);
  const linkedPlate = linkedRegionId
    ? plates.find((plate) => plate.id === linkedRegionId || plate.aliases?.includes(linkedRegionId))
    : undefined;
  if (linkedPlate) {
    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: clamp(linkedPlate.labelX ?? linkedPlate.x + linkedPlate.width / 2, 0.02, 0.98),
      y: clamp(linkedPlate.labelY ?? linkedPlate.y + linkedPlate.height / 2, 0.02, 0.98),
    };
  }

  const plateNumber = extractPlateNumber(finding.linkedUtItemKey) ?? extractPlateNumber(finding.itemLabel);
  if (plateNumber != null && plateNumber > 0) {
    const matchingPlate = plates.find((plate) => plate.id === plateNumber.toString());
    const x = matchingPlate ? matchingPlate.x + matchingPlate.width / 2 : 0.5;
    const y = matchingPlate ? matchingPlate.y + matchingPlate.height / 2 : 0.5;

    return {
      id: finding.findingId,
      label: finding.itemLabel,
      type: "finding",
      x: clamp(x, 0.08, 0.92),
      y: clamp(y, 0.12, 0.88),
    };
  }

  return {
    id: finding.findingId,
    label: finding.itemLabel,
    type: "finding",
    ...coerceCircularMarkerPosition(0.14 + index * 0.08, 0.22 + index * 0.06),
  };
}

function buildShellFindingMarkers(exportPackage, courseCount, laneCount) {
  return exportPackage.findings
    .filter((finding) => finding.targetKey === "shell" && !isElementLinkedFinding(finding))
    .map((finding, index) => {
      const linkedElementId = getLinkedElementId(finding.linkedUtItemKey);
      const linkedElement = linkedElementId
        ? exportPackage.elements.find((element) => element.elementId === linkedElementId)
        : undefined;

      if (linkedElement) {
        return {
          id: finding.findingId,
          label: finding.itemLabel,
          type: "finding",
          x: clamp(linkedElement.normalizedX + 0.025, 0.08, 0.92),
          y: clamp(linkedElement.normalizedY + 0.025, 0.12, 0.88),
        };
      }

      const regionMatch = /:region:(L\d+)-C(\d+)/i.exec(finding.linkedUtItemKey ?? "");
      const regionPosition = regionMatch
        ? shellRegionMarkerPosition(regionMatch[1], Number(regionMatch[2]), laneCount, courseCount)
        : null;
      if (regionPosition) {
        return {
          id: finding.findingId,
          label: finding.itemLabel,
          type: "finding",
          x: regionPosition.x,
          y: regionPosition.y,
        };
      }

      return {
        id: finding.findingId,
        label: finding.itemLabel,
        type: "finding",
        x: clamp(0.12 + index * 0.08, 0.08, 0.92),
        y: clamp(0.2 + index * 0.04, 0.12, 0.88),
      };
    });
}

function buildAndroidCircularPlateCells(rowCount, widestRowPlateCount, source) {
  const rows = Math.max(Math.floor(rowCount), 1);
  const widest = Math.max(Math.floor(widestRowPlateCount), 1);
  const radius = 0.42;
  const center = 0.5;
  const rowHeight = (2 * radius) / rows;
  const nominalPlateWidth = (2 * radius) / widest;
  const cells = [];
  let nextPlateNumber = 1;

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const rowNumber = rowIndex + 1;
    const topNorm = center - radius + rowIndex * rowHeight;
    const bottomNorm = topNorm + rowHeight;
    const rowCenter = (topNorm + bottomNorm) / 2;
    const dy = rowCenter - center;
    const xSpan = Math.sqrt(Math.max(0, radius * radius - dy * dy));
    const rowLeft = center - xSpan;
    const rowRight = center + xSpan;
    const staggerOffset = rowIndex % 2 === 0 ? 0 : nominalPlateWidth / 2;
    const nominalStart = center - radius - staggerOffset;
    const nominalEnd = center + radius + nominalPlateWidth;
    const rowCells = [];
    let segmentStart = nominalStart;

    while (segmentStart < nominalEnd) {
      const segmentEnd = segmentStart + nominalPlateWidth;
      const visibleLeft = Math.max(segmentStart, rowLeft);
      const visibleRight = Math.min(segmentEnd, rowRight);

      if (visibleRight - visibleLeft > nominalPlateWidth * 0.04) {
        rowCells.push({ left: segmentStart, right: segmentEnd });
      }

      segmentStart = segmentEnd;
    }

    rowCells.forEach((cell, position) => {
      const plateNumber =
        rowNumber % 2 === 1
          ? nextPlateNumber + position
          : nextPlateNumber + (rowCells.length - 1 - position);

      cells.push(
        clampPlate({
          id: plateNumber.toString(),
          label: plateNumber.toString(),
          row: rowNumber,
          column: position + 1,
          x: cell.left,
          y: topNorm,
          width: cell.right - cell.left,
          height: bottomNorm - topNorm,
          source,
        }),
      );
    });

    nextPlateNumber += rowCells.length;
  }

  return cells;
}

function buildCustomCircularPlateCells(
  customLayout,
  source,
  rowCount,
  widestRowPlateCount,
  labelMode = "roof",
  allowLegacyFallback = true,
) {
  const resolvedPlates = parseResolvedMainPlateGeometry(customLayout, `${source}:resolved`);
  if (resolvedPlates.length > 0) return resolvedPlates;
  if (!allowLegacyFallback) return [];

  const rows = parseCustomCircularRows(customLayout);
  if (rows.length === 0) return [];

  const labelsByRowAndPlate = buildCustomCircularPlateRefs(rows, labelMode);
  const cells = [];
  const totalHeightWeight = Math.max(rows.reduce((total, row) => total + row.heightWeight, 0), 0.001);
  const stableHorizontalRowHeight = 0.84 / Math.max(rows.length, 1);
  let rowTop = 0.08;

  rows.forEach((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const rowHeight = 0.84 * (row.heightWeight / totalHeightWeight);
    const topNorm = rowTop;
    const bottomNorm = Math.min(rowTop + rowHeight, 0.92);
    rowTop = bottomNorm;
    const stableTop = 0.08 + stableHorizontalRowHeight * rowIndex;
    const stableBottom = stableTop + stableHorizontalRowHeight;
    const nearestCenterY = clamp(0.5, stableTop, stableBottom);
    const chordHalfWidth = Math.sqrt(Math.max(0, 0.42 ** 2 - (nearestCenterY - 0.5) ** 2));
    const rowWidth = Math.max(chordHalfWidth * 2, 0.06);
    const maxShift = rowWidth * 0.16;
    const stripLeft = 0.5 - chordHalfWidth - maxShift;
    const stripWidth = rowWidth + 2 * maxShift;
    const weightSum = Math.max(row.plates.reduce((total, plate) => total + Math.max(plate.widthWeight, 0.001), 0), 0.001);
    const labelByPlateIndex = labelsByRowAndPlate.get(rowIndex) ?? new Map();
    let x = stripLeft + clamp(row.shiftRatio, -1, 1) * maxShift;

    row.plates.forEach((plate, position) => {
      const width = stripWidth * (Math.max(plate.widthWeight, 0.001) / weightSum);
      const label = labelByPlateIndex.get(position) ?? `${rowNumber}.${position + 1}`;

      cells.push(
        clampPlate({
          id: label,
          label,
          row: row.rowNumber,
          column: position + 1,
          x,
          y: topNorm,
          width,
          height: bottomNorm - topNorm,
          source,
        }),
      );
      x += width;
    });
  });

  return cells;
}

function buildV3AppAnnularRingSections(sectionCount, rotationDegrees, annularWidthRatio, source) {
  const count = Math.max(Math.floor(sectionCount), 0);
  if (count === 0) return [];

  const innerRadius = 0.42;
  const outerRadius = innerRadius * (1 + clamp(annularWidthRatio, 0.06, 0.18));
  const step = 360 / count;

  return Array.from({ length: count }, (_, sectionIndex) => {
    const start = rotationDegrees + step * sectionIndex;
    const end = start + step;
    const points = [
      ...sampleAzimuthArc(start, end, outerRadius),
      ...sampleAzimuthArc(end, start, innerRadius),
    ];
    const xValues = points.map((point) => point.x);
    const yValues = points.map((point) => point.y);
    const x = Math.min(...xValues);
    const y = Math.min(...yValues);
    const right = Math.max(...xValues);
    const bottom = Math.max(...yValues);
    const sectionNumber = sectionIndex + 1;
    return {
      id: `AR${sectionNumber}`,
      label: `AR${sectionNumber}`,
      aliases: [`A${sectionNumber}`],
      plateKind: "annular",
      row: 0,
      column: sectionNumber,
      x: roundGeometry(x),
      y: roundGeometry(y),
      width: roundGeometry(right - x),
      height: roundGeometry(bottom - y),
      points,
      source,
    };
  });
}

function readCircularLayoutSettings(customLayout) {
  if (!customLayout || typeof customLayout !== "object" || Array.isArray(customLayout)) {
    return { annularRotationDeg: 0, annularWidthRatio: 0.12 };
  }
  return {
    annularRotationDeg: Number.isFinite(customLayout.annularRotationDeg) ? customLayout.annularRotationDeg : 0,
    annularWidthRatio: Number.isFinite(customLayout.annularWidthRatio) ? customLayout.annularWidthRatio : 0.12,
  };
}

function sampleAzimuthArc(startDegrees, endDegrees, radius) {
  const span = endDegrees - startDegrees;
  const segmentCount = Math.max(2, Math.ceil(Math.abs(span) / 5));
  return Array.from({ length: segmentCount + 1 }, (_, index) => {
    const azimuth = startDegrees + (span * index) / segmentCount;
    const radians = ((azimuth - 90) * Math.PI) / 180;
    return {
      x: roundGeometry(0.5 + Math.cos(radians) * radius),
      y: roundGeometry(0.5 + Math.sin(radians) * radius),
    };
  });
}

function roundGeometry(value) {
  return Math.round(value * 100_000) / 100_000;
}

function buildAndroidShellPlateSegments(courseCount, platesPerCourse, offsetMode, offsetStartRow, thirdOffsetStart) {
  const rows = Math.max(Math.floor(courseCount), 1);
  const plateCount = Math.max(Math.floor(platesPerCourse), 1);
  const rowHeight = 1 / rows;
  const cellWidth = 1 / plateCount;
  const segments = [];

  for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
    const course = rows - rowIndex;
    const y = rowIndex * rowHeight;
    const offsetFraction = shellOffsetFraction(course, offsetMode, offsetStartRow, thirdOffsetStart);

    if (offsetFraction > 0 && plateCount > 1) {
      const leadingRight = cellWidth * offsetFraction;
      const trailingLeft = 1 - cellWidth * (1 - offsetFraction);

      segments.push(shellPlateSegment(`course-${course}-lead`, course, 0, 0, leadingRight, y, rowHeight));
      for (let plateIndex = 0; plateIndex < plateCount - 1; plateIndex += 1) {
        const x = cellWidth * offsetFraction + plateIndex * cellWidth;
        segments.push(shellPlateSegment(`course-${course}-plate-${plateIndex + 1}`, course, plateIndex + 1, x, cellWidth, y, rowHeight));
      }
      segments.push(shellPlateSegment(`course-${course}-trail`, course, plateCount, trailingLeft, 1 - trailingLeft, y, rowHeight));
    } else {
      for (let plateIndex = 0; plateIndex < plateCount; plateIndex += 1) {
        segments.push(shellPlateSegment(`course-${course}-plate-${plateIndex + 1}`, course, plateIndex + 1, plateIndex * cellWidth, cellWidth, y, rowHeight));
      }
    }
  }

  return segments;
}

function shellPlateSegment(id, course, column, x, width, y, rowHeight) {
  return clampPlate({
    id,
    label: "",
    row: course,
    column,
    x,
    y,
    width,
    height: rowHeight * 0.95,
    source: "android:shell-ut-segment",
  });
}

function shellOffsetFraction(courseNo, offsetMode, offsetStartRow, thirdOffsetStart) {
  if (offsetMode === "third_plate") {
    const startStep = thirdOffsetStart === "one_third" ? 1 : thirdOffsetStart === "two_thirds" ? 2 : 0;
    return ((startStep + courseNo - 1) % 3) / 3;
  }

  if (offsetMode === "half_plate") {
    const shouldOffset = offsetStartRow === "odd" ? courseNo % 2 === 1 : courseNo % 2 === 0;
    return shouldOffset ? 0.5 : 0;
  }

  return 0;
}

function groupPlatesByRow(plates) {
  const grouped = new Map();
  for (const plate of plates) {
    grouped.set(plate.row, [...(grouped.get(plate.row) ?? []), plate]);
  }
  return grouped;
}

function buildCustomCircularPlateRefs(rows, labelMode) {
  const labelsByRowAndPlate = new Map();
  let roofCounter = 1;

  rows.forEach((row, rowIndex) => {
    const plateGroups = groupCustomPlatesBySplitKey(row.plates);
    const groupCount = plateGroups.length;
    const rowLabels = Array.from({ length: groupCount }, (_, groupIndex) =>
      labelMode === "floor"
        ? `${row.rowNumber}.${groupIndex + 1}`
        : String(roofCounter + (row.rowNumber % 2 === 0 ? groupCount - 1 - groupIndex : groupIndex)),
    );
    const rowLabelsByPlate = new Map();

    plateGroups.forEach((group, groupIndex) => {
      const base = rowLabels[groupIndex];
      group.forEach((plateIndex) => {
        const plate = row.plates[plateIndex];
        const suffix = plate.splitGroupKey ? splitSuffix(plate.splitPartIndex ?? 0) : "";
        rowLabelsByPlate.set(plateIndex, `${base}${suffix}`);
      });
    });

    labelsByRowAndPlate.set(rowIndex, rowLabelsByPlate);
    if (labelMode === "roof") roofCounter += groupCount;
  });

  return labelsByRowAndPlate;
}

function groupCustomPlatesBySplitKey(plates) {
  const groups = [];
  let plateIndex = 0;

  while (plateIndex < plates.length) {
    const splitKey = plates[plateIndex].splitGroupKey;
    if (!splitKey) {
      groups.push([plateIndex]);
      plateIndex += 1;
      continue;
    }

    const groupStart = plateIndex;
    let groupEnd = plateIndex;
    while (groupEnd + 1 < plates.length && plates[groupEnd + 1].splitGroupKey === splitKey) {
      groupEnd += 1;
    }
    groups.push(Array.from({ length: groupEnd - groupStart + 1 }, (_, index) => groupStart + index));
    plateIndex = groupEnd + 1;
  }

  return groups;
}

function splitSuffix(index) {
  return String.fromCharCode("a".charCodeAt(0) + Math.max(Math.floor(index), 0));
}

function parseCustomCircularRows(customLayout) {
  if (!customLayout || typeof customLayout !== "object" || !Array.isArray(customLayout.rows)) return [];

  return customLayout.rows
    .map((row, index) => {
      if (!row || typeof row !== "object" || !Array.isArray(row.plates)) return null;
      const plates = row.plates
        .map((plate) => {
          const widthWeight =
            plate && typeof plate === "object" && Number.isFinite(plate.widthWeight) && plate.widthWeight > 0
              ? plate.widthWeight
              : null;
          return widthWeight
            ? {
                widthWeight,
                splitGroupKey: typeof plate.splitGroupKey === "string" ? plate.splitGroupKey : null,
                splitPartIndex: Number.isFinite(plate.splitPartIndex) ? Math.floor(plate.splitPartIndex) : null,
              }
            : null;
        })
        .filter(Boolean);

      if (plates.length === 0) return null;

      return {
        rowNumber: Number.isFinite(row.rowNumber) && row.rowNumber > 0 ? row.rowNumber : index + 1,
        shiftRatio: clamp(Number.isFinite(row.shiftRatio) ? row.shiftRatio : 0, -0.4, 0.4),
        heightWeight: Number.isFinite(row.heightWeight) && row.heightWeight > 0 ? row.heightWeight : 1,
        plates,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.rowNumber - b.rowNumber);
}

function parseResolvedMainPlateGeometry(customLayout, source) {
  if (
    !customLayout ||
    typeof customLayout !== "object" ||
    ![1, 2].includes(customLayout.resolvedGeometryVersion)
  ) return [];
  if (!Array.isArray(customLayout.resolvedMainPlateGeometry)) return [];

  return customLayout.resolvedMainPlateGeometry
    .map((value, index) => {
      if (!value || typeof value !== "object" || typeof value.plateId !== "string" || value.plateId.trim() === "") {
        return null;
      }
      const { leftNorm, rightNorm, topNorm, bottomNorm } = value;
      if (
        !Number.isFinite(leftNorm) ||
        !Number.isFinite(rightNorm) ||
        !Number.isFinite(topNorm) ||
        !Number.isFinite(bottomNorm) ||
        rightNorm <= leftNorm ||
        bottomNorm <= topNorm
      ) {
        return null;
      }
      const plateId = value.plateId.trim();
      return clampPlate({
        id: plateId,
        label: plateId,
        mapLabel: typeof value.mapLabel === "string" ? value.mapLabel : plateId,
        labelX: Number.isFinite(value.labelXNorm) ? value.labelXNorm : (leftNorm + rightNorm) / 2,
        labelY: Number.isFinite(value.labelYNorm) ? value.labelYNorm : (topNorm + bottomNorm) / 2,
        row: Number.isFinite(value.rowNumber) ? Math.floor(value.rowNumber) : 0,
        column: index + 1,
        x: leftNorm,
        y: topNorm,
        width: rightNorm - leftNorm,
        height: bottomNorm - topNorm,
        source,
      });
    })
    .filter(Boolean);
}

function parseResolvedAnnularPlateGeometry(customLayout, source) {
  if (!customLayout || typeof customLayout !== "object" || customLayout.resolvedGeometryVersion !== 2) return [];
  if (!Array.isArray(customLayout.resolvedAnnularPlateGeometry)) return [];

  return customLayout.resolvedAnnularPlateGeometry
    .map((value, index) => {
      if (!value || typeof value !== "object" || typeof value.plateId !== "string" || value.plateId.trim() === "") {
        return null;
      }
      const { leftNorm, rightNorm, topNorm, bottomNorm } = value;
      const points = Array.isArray(value.points)
        ? value.points
            .map((point) => (
              point && Number.isFinite(point.xNorm) && Number.isFinite(point.yNorm)
                ? { x: point.xNorm, y: point.yNorm }
                : null
            ))
            .filter(Boolean)
        : [];
      if (
        !Number.isFinite(leftNorm) ||
        !Number.isFinite(rightNorm) ||
        !Number.isFinite(topNorm) ||
        !Number.isFinite(bottomNorm) ||
        rightNorm <= leftNorm ||
        bottomNorm <= topNorm ||
        points.length < 3
      ) return null;

      const sectionNumber = Number.isFinite(value.sectionNumber) ? Math.floor(value.sectionNumber) : index + 1;
      const plateId = value.plateId.trim();
      return clampPlate({
        id: plateId,
        label: plateId,
        mapLabel: typeof value.mapLabel === "string" ? value.mapLabel : `A${sectionNumber}`,
        labelX: Number.isFinite(value.labelXNorm) ? value.labelXNorm : (leftNorm + rightNorm) / 2,
        labelY: Number.isFinite(value.labelYNorm) ? value.labelYNorm : (topNorm + bottomNorm) / 2,
        aliases: [`A${sectionNumber}`],
        plateKind: "annular",
        row: 0,
        column: sectionNumber,
        x: leftNorm,
        y: topNorm,
        width: rightNorm - leftNorm,
        height: bottomNorm - topNorm,
        points,
        source,
      });
    })
    .filter(Boolean);
}

function shellRegionMarkerPosition(laneId, course, laneCount, courseCount) {
  const laneMatch = /^L(\d+)$/i.exec(laneId ?? "");
  const laneNumber = laneMatch ? Number(laneMatch[1]) : null;
  if (!laneNumber || !course) return null;

  return {
    x: clamp((laneNumber - 0.5) / Math.max(laneCount, 1), 0.04, 0.96),
    y: clamp((Math.max(courseCount, 1) - course + 0.5) / Math.max(courseCount, 1), 0.05, 0.95),
  };
}

function circularPlateRect(plate) {
  return {
    x: CIRCULAR_MAP.x + plate.x * CIRCULAR_MAP.size,
    y: CIRCULAR_MAP.y + plate.y * CIRCULAR_MAP.size,
    width: plate.width * CIRCULAR_MAP.size,
    height: plate.height * CIRCULAR_MAP.size,
  };
}

function shellPlateRect(plate) {
  return {
    x: SHELL_GRID.x + plate.x * SHELL_GRID.width,
    y: SHELL_GRID.y + plate.y * SHELL_GRID.height,
    width: plate.width * SHELL_GRID.width,
    height: plate.height * SHELL_GRID.height,
  };
}

function markerPoint(marker, mapBox) {
  const width = mapBox.width ?? mapBox.size;
  const height = mapBox.height ?? mapBox.size;
  return {
    x: mapBox.x + marker.x * width,
    y: mapBox.y + marker.y * height,
  };
}

function clampPlate(plate) {
  const source = normalizeLayoutSource(plate.source);
  const isAppGeometry = source.startsWith("android:") || source.startsWith("v3-app:");
  const width = clamp(plate.width, isAppGeometry ? 0.001 : 0.02, isAppGeometry ? 1.5 : 1);
  const height = clamp(plate.height, isAppGeometry ? 0.001 : 0.02, 1);
  return {
    ...plate,
    source,
    x: clamp(plate.x, isAppGeometry ? -0.25 : 0, isAppGeometry ? 1.25 - width : 0.98),
    y: clamp(plate.y, 0, 1 - height),
    width,
    height,
    points: Array.isArray(plate.points) && plate.points.length >= 3
      ? plate.points.map((point) => ({
          x: clamp(point.x, 0, 1),
          y: clamp(point.y, 0, 1),
        }))
      : undefined,
  };
}

function clampMarker(marker) {
  const source = normalizeLayoutSource(marker.source);
  const isAppGeometry = source.startsWith("v3-app:");
  return {
    ...marker,
    source,
    x: clamp(marker.x, isAppGeometry ? 0 : 0.02, isAppGeometry ? 1 : 0.98),
    y: clamp(marker.y, isAppGeometry ? 0 : 0.04, isAppGeometry ? 1 : 0.96),
  };
}

function normalizeLayoutSource(source) {
  return typeof source === "string" && source.trim() !== ""
    ? source
    : "report-platform:legacy-layout-override";
}

function coerceCircularMarkerPosition(x, y) {
  const center = 0.5;
  const controlledRadius = 0.42;
  const dx = x - center;
  const dy = y - center;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance <= controlledRadius || distance === 0) {
    return {
      x: clamp(x, center - controlledRadius, center + controlledRadius),
      y: clamp(y, center - controlledRadius, center + controlledRadius),
    };
  }

  const scale = controlledRadius / distance;
  return {
    x: center + dx * scale,
    y: center + dy * scale,
  };
}

function shellLaneDisplayLabel(laneIndex, laneCount) {
  if (laneCount === 4) return ["N", "E", "S", "W"][Math.min(Math.max(laneIndex, 0), 3)] ?? `L${laneIndex + 1}`;
  if (laneIndex === 0) return "L1 (N)";
  return `L${laneIndex + 1}`;
}

function shellRegionDisplayLabel(laneIndex, laneCount, course) {
  if (laneCount === 4) return `${shellLaneDisplayLabel(laneIndex, laneCount)}-C${course}`;
  return `L${laneIndex + 1}-C${course}`;
}

function compactMarkerLabel(label) {
  return String(label ?? "")
    .replace(/^Roof Plate\s+/i, "P")
    .replace(/^Strake\s+/i, "S")
    .replace(/\s*\/\s*/g, "/");
}

function extractPlateNumber(value) {
  if (!value) return null;
  const match = /(?:plate|region)[:\s-]*(\d+)/i.exec(value) ?? /(\d+)/.exec(value);
  return match ? Number(match[1]) : null;
}

function formatShortDate(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Pending" : date.toISOString().slice(0, 10);
}

function humanizeKey(value) {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function safeId(value) {
  return String(value ?? "layout").replace(/[^a-z0-9_-]+/gi, "-");
}

function floorPlateClipId(layoutMapId, plateId) {
  return `floor-plate-clip-${safeId(`${layoutMapId}-${plateId}`)}`;
}

function floorTankClipId(layoutMapId) {
  return `floor-tank-clip-${safeId(layoutMapId)}`;
}

function safeInlineCorrosionImage(value) {
  const candidate = String(value ?? "");
  return /^data:image\/(?:png|svg\+xml);base64,[a-z0-9+/=]+$/i.test(candidate) ? candidate : null;
}

function safeAppOwnedFloorFigureDataUri(figure) {
  if (
    figure?.targetKey !== "floor" ||
    figure?.mediaType !== "image/svg+xml" ||
    figure?.renderVersion !== 1 ||
    figure?.sourceGeometryVersion !== 2 ||
    typeof figure?.svg !== "string" ||
    !/^<svg\b/i.test(figure.svg) ||
    figure.svg.length > 500_000
  ) {
    return null;
  }
  const withoutInternalUrls = figure.svg.replace(/url\(#[A-Za-z0-9_.:-]+\)/g, "");
  if (
    /<(?:script|foreignObject|image|use|a)\b/i.test(figure.svg) ||
    /\bon[a-z]+\s*=/i.test(figure.svg) ||
    /\b(?:href|xlink:href)\s*=/i.test(figure.svg) ||
    /<!DOCTYPE|<!ENTITY/i.test(figure.svg) ||
    /javascript:|data:/i.test(figure.svg) ||
    /url\s*\(/i.test(withoutInternalUrls)
  ) {
    return null;
  }
  return `data:image/svg+xml;base64,${Buffer.from(figure.svg, "utf8").toString("base64")}`;
}

function normalizeRotation(value) {
  const normalized = ((Number(value) % 360) + 360) % 360;
  return [0, 90, 180, 270].includes(normalized) ? normalized : 0;
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number(value ?? 0)));
}

function svgStyles() {
  return `
    .map-page { fill: #ffffff; stroke: rgba(13, 79, 144, 0.14); stroke-width: 2; }
    .map-title { fill: #0a3f73; font: 900 20px Arial, sans-serif; letter-spacing: 0.01em; }
    .map-subtitle { fill: #637083; font: 700 13px Arial, sans-serif; }
    .shell-edge-label { text-anchor: end; }
    .circular-fill { fill: rgba(13, 79, 144, 0.06); stroke: none; }
    .circular-outline { fill: none; stroke: rgba(239, 76, 87, 0.78); stroke-width: 3.5; }
    .reference-line { stroke: rgba(13, 79, 144, 0.86); stroke-width: 3.4; }
    .zero-label { fill: #ef4c57; font: 900 12px Arial, sans-serif; }
    .floor-corrosion-legend > rect { fill: #ffffff; stroke: rgba(13,79,144,0.65); stroke-width: 1.3; }
    .floor-corrosion-legend text { fill: #0a3f73; font: 850 10px Arial, sans-serif; text-anchor: middle; }
    .floor-corrosion-legend-title { font-size: 12px; text-anchor: start !important; }
    .plate { fill: #ffffff; stroke: rgba(111, 124, 142, 0.55); stroke-width: 1; }
    .plate-label { fill: #253447; font: 800 10px Arial, sans-serif; text-anchor: middle; }
    .floor-corrosion-overlay { image-rendering: auto; }
    .course-label { fill: #637083; font: 700 13px Arial, sans-serif; text-anchor: start; }
    .lane-label { fill: #ef4c57; font: 900 13px Arial, sans-serif; text-anchor: middle; }
    .shell-segment { fill: rgba(255,255,255,0.72); stroke: rgba(13,79,144,0.36); stroke-width: 1.2; }
    .shell-region { fill: rgba(255,255,255,0.02); stroke: rgba(239,76,87,0.42); stroke-width: 1.1; stroke-dasharray: 6 6; }
    .shell-region-label { fill: rgba(99,112,131,0.88); font: 800 11px Arial, sans-serif; text-anchor: middle; }
    .marker-circle { fill: rgba(234,242,251,0.96); stroke: #0d4f90; stroke-width: 2.2; }
    .marker-element .marker-circle { stroke: #0a3f73; }
    .marker-label { fill: #0a3f73; font: 900 11px Arial, sans-serif; paint-order: stroke; stroke: #ffffff; stroke-width: 4; }
    .drawing-block rect { fill: #ffffff; stroke: #0a3f73; stroke-width: 1.5; }
    .drawing-block text { fill: #0a3f73; font: 800 12px Arial, sans-serif; }
  `;
}
