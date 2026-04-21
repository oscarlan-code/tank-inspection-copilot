async page => {
  const BASE = "http://localhost:5173";
  const OUT = "output/playwright/product-report";
  const STORAGE_KEY = "tank-inspection-coplilot:draft";
  const VP = { width: 430, height: 932 };

  function defect(id, surface, x, y, plateId, type, severity) {
    const now = "2026-04-20T10:00:00.000Z";
    return {
      id,
      inspectionId: "INS-2026-0413-001",
      tankId: "TK-201",
      location: {
        surface,
        x,
        y,
        gridId: `${x}-${y}`,
        plateId,
        locationMode: surface === "shell" ? "tap_map" : "plate_id",
        isAnnular: surface === "bottom" ? y <= 1 || y >= 10 || x <= 1 || x >= 20 : false,
      },
      defectType: type,
      defectSubtype: type === "Crack" ? "toe crack indication" : "pitting",
      severity,
      extent: "single cell",
      description: surface === "shell"
        ? "Indication near vertical seam, requires follow-up UT verification."
        : "Localised pitting near annular ring. Contractor MFL report confirms minor anomaly.",
      weldLocation: surface === "shell" ? "vertical_seam" : null,
      measurements: type === "Crack"
        ? { method: "visual + dye penetrant", crackLengthMm: 42, crackWidthMm: 1 }
        : { method: "UT probe", utThicknessMm: 7.8, minThicknessMm: 7.2, pitDepthMm: 1.4 },
      evidence: [{
        id: `EV-${id}`,
        type: "photo",
        uri: "local://photo/tk-201-defect.jpg",
        timestamp: now,
        gps: null,
        linkedX: x,
        linkedY: y,
        linkedSurface: surface,
      }],
      createdBy: "Field Engineer",
      createdAt: now,
    };
  }

  function session(options = {}) {
    const {
      complete = false,
      withDefects = false,
      withMfl = false,
      shellConfig = null,
      roofConfig = null,
      annularConfig = null,
      nozzleConfig = null,
    } = options;
    const bottomDefect = defect("DEF-BOTTOM-001", "bottom", 12, 4, "A12", "Corrosion", "minor");
    const shellDefect = defect("DEF-SHELL-001", "shell", 18, 3, null, "Crack", "moderate");
    return {
      id: "INS-2026-0413-001",
      siteId: "SLNG Terminal",
      clientId: "Operations Integrity",
      tankId: "TK-201",
      inspectionType: "internal",
      inspectorId: "Field Engineer",
      startedAt: "2026-04-20T09:00:00.000Z",
      tankProfile: {
        designCode: "API_653",
        diameterM: 30,
        heightM: 14.5,
        capacityM3: 10200,
        roofType: "single_deck_floating",
        foundationType: "concrete_ring_wall",
      },
      orientation: {
        gpsLat: 1.2644,
        gpsLng: 103.7502,
        referenceOrigin: "true_north",
        referenceMarker: null,
        referenceDescription: null,
        referenceMarkerBearingDeg: null,
      },
      shellConfig,
      roofConfig,
      annularConfig,
      nozzleConfig,
      surfaces: [
        {
          surface: "bottom",
          gridCols: 20,
          gridRows: 10,
          completed: complete,
          defects: withDefects ? [bottomDefect] : [],
          mflReport: withMfl ? {
            contractor: "TechnipFMC Inspection Services",
            reportRef: "MFL-TK201-2026-001",
            reportDate: "2026-04-10",
            scanCoverage: "full",
            scanCoverageNote: null,
            totalAnomalies: 3,
            overallSeverity: "minor",
            reportUri: null,
            notes: "Three minor pitting anomalies near annular ring at zones 2-1, 5-3 and 18-9.",
          } : null,
        },
        {
          surface: "shell",
          gridCols: 24,
          gridRows: 12,
          completed: complete,
          defects: withDefects ? [shellDefect] : [],
        },
        { surface: "roof", gridCols: 20, gridRows: 10, completed: false, defects: [] },
        { surface: "annular", gridCols: 20, gridRows: 10, completed: false, defects: [] },
        { surface: "nozzle", gridCols: 20, gridRows: 10, completed: false, defects: [] },
      ],
      syncStatus: complete ? "pending_sync" : "draft",
    };
  }

  const configured = {
    shellConfig: {
      numCourses: 8,
      plateWidthMm: 1800,
      plateLengthMm: 1812,
      seamOriginC1Deg: 0,
      seamOffsetRule: "half_plate",
      customOffsetDeg: null,
    },
    roofConfig: {
      sectorCount: 12,
      ringCount: 5,
      apexHeightM: null,
    },
    annularConfig: {
      widthMm: 700,
    },
    nozzleConfig: {
      nozzles: [
        {
          id: "N1",
          nozzleType: "inlet",
          azimuthDeg: 45,
          elevationMm: 1200,
          diameterMm: 300,
          description: "North-east inlet nozzle",
        },
        {
          id: "M1",
          nozzleType: "manway",
          azimuthDeg: 180,
          elevationMm: 850,
          diameterMm: 600,
          description: "South manway",
        },
      ],
    },
  };

  async function wait() {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
    await page.waitForTimeout(280);
  }

  async function seed(data = session()) {
    await page.goto(BASE);
    await page.evaluate(({ key, value }) => {
      window.localStorage.clear();
      window.localStorage.setItem(key, JSON.stringify(value));
    }, { key: STORAGE_KEY, value: data });
    await page.reload();
    await wait();
  }

  async function shot(name) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(180);
    await page.screenshot({ path: `${OUT}/${name}`, fullPage: false });
    console.log(`captured ${name}`);
  }

  async function click(nameOrRegex) {
    const name = nameOrRegex instanceof RegExp ? nameOrRegex : new RegExp(nameOrRegex);
    await page.getByRole("button", { name }).click();
    await wait();
  }

  async function toOverview(data = session()) {
    await seed(data);
    await click(/Start New Inspection/);
    await click(/^Continue$/);
    await click(/^Continue$/);
    await click(/^Continue$/);
  }

  async function toBottomMode() {
    await toOverview(session());
    await click(/Bottom/);
    await click(/Add Manual Observations/);
  }

  async function captureBottomDefectFlow() {
    await toOverview(session());
    await shot("latest-05-tank-overview.png");

    await click(/Bottom/);
    await shot("latest-06-bottom-mfl-report.png");

    await click(/Add Manual Observations/);
    await shot("latest-07-location-mode.png");

    await toBottomMode();
    await click(/Manual X,Y Entry/);
    await shot("latest-09-manual-xy-entry.png");

    await toBottomMode();
    await click(/Plate ID Entry/);
    await shot("latest-10-plate-id-picker.png");

    await toBottomMode();
    await click(/Tap on Grid Map/);
    await shot("latest-08-bottom-grid-map.png");

    await click(/Confirm Location/);
    await shot("latest-11-confirm-location.png");

    await click(/Use This Location/);
    await shot("latest-12-defect-type.png");

    await click(/Corrosion/);
    await page.getByRole("button", { name: /^minor$/i }).click();
    await wait();
    await shot("latest-13-defect-details.png");

    await click(/Next: Measurements/);
    await shot("latest-14-measurements.png");

    await click(/Next: Evidence/);
    await shot("latest-15-evidence-required.png");

    await click(/Take Photo/);
    await shot("latest-16-evidence-with-photo.png");

    await click(/Save Defect/);
    await shot("latest-17-defect-saved.png");

    await click(/Return to Surface Map/);
    await shot("latest-18-saved-defect-map.png");

    await click(/Finish Surface/);
    await shot("latest-19-surface-review.png");

    await click(/Mark Surface Complete/);
    await shot("latest-29-inspection-validation.png");
  }

  async function captureSurfaceVariants() {
    await toOverview(session());
    await click(/Shell/);
    await shot("latest-20-shell-setup.png");
    await click(/Start Shell Inspection/);
    await click(/Tap on Grid Map/);
    await shot("latest-21-shell-map.png");

    await toOverview(session());
    await click(/Roof/);
    await shot("latest-22-roof-setup.png");
    await click(/Start Roof Inspection/);
    await click(/Tap on Grid Map/);
    await shot("latest-23-roof-map.png");

    await toOverview(session());
    await click(/Annular ring/);
    await shot("latest-24-annular-setup.png");
    await click(/Start Annular Inspection/);
    await page.locator("svg[aria-label='Annular ring top view']").click({ position: { x: 140, y: 40 } });
    await wait();
    await shot("latest-25-annular-map.png");

    const withNozzles = session({ nozzleConfig: configured.nozzleConfig });
    await toOverview(withNozzles);
    await click(/Nozzle area/);
    await shot("latest-27-nozzle-list.png");
    await click(/Edit Nozzle Registry/);
    await shot("latest-26-nozzle-registry.png");

    await toOverview(withNozzles);
    await click(/Nozzle area/);
    await click(/N1/);
    await page.locator("svg[aria-label='Nozzle clock map']").click({ position: { x: 140, y: 50 } });
    await wait();
    await shot("latest-28-nozzle-clock-map.png");
  }

  async function captureStartScreens() {
    await seed(session());
    await shot("latest-01-home.png");
    await click(/Start New Inspection/);
    await shot("latest-02-inspection-setup.png");
    await click(/^Continue$/);
    await shot("latest-03-tank-profile.png");
    await click(/^Continue$/);
    await shot("latest-04-orientation.png");
  }

  async function captureSubmitScreens() {
    const complete = session({
      complete: true,
      withDefects: true,
      withMfl: true,
      ...configured,
    });
    await seed(complete);
    await click(/^Export$/);
    await shot("latest-30-export-summary.png");
    await click(/Confirm & Submit Inspection/);
    await shot("latest-31-submission-success.png");
  }

  await page.setViewportSize(VP);
  page.setDefaultTimeout(10000);

  await captureStartScreens();
  await captureBottomDefectFlow();
  await captureSurfaceVariants();
  await captureSubmitScreens();

  return "latest screen capture complete";
}
