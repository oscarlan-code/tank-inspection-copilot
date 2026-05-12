import { useEffect, useMemo, useState } from "react";
import InspectionSetupPrototype from "./concept/InspectionSetupPrototype";
import type {
  AnnularConfig,
  DefectMeasurement,
  DefectRecord,
  EvidenceItem,
  GridLocation,
  InspectionSession,
  LocationMode,
  MflReport,
  MflSeverity,
  NozzleConfig,
  NozzleDefinition,
  NozzleType,
  ReferenceMarkerType,
  ReferenceOriginType,
  RoofConfig,
  SeamOffsetRule,
  ShellConfig,
  SurfaceInspection,
  SurfaceType,
  TankOrientation,
  TankProfile,
  WeldLocation,
} from "./types";

const ENABLE_V2_DESIGN_PROTOTYPE = true;

type Screen =
  | "home"
  | "setup"
  | "tankProfile"
  | "orientation"
  | "overview"
  | "shellSetup"
  | "roofSetup"
  | "annularSetup"
  | "nozzleSetup"
  | "nozzleList"
  | "mode"
  | "map"
  | "manual"
  | "plate"
  | "confirm"
  | "type"
  | "details"
  | "measurements"
  | "evidence"
  | "saved"
  | "mflImport"
  | "surfaceMap"
  | "surfaceReview"
  | "validation"
  | "export"
  | "success";

type Severity = "minor" | "moderate" | "severe";

type DraftDefect = {
  location: GridLocation | null;
  defectType: string;
  defectSubtype: string;
  severity: Severity | "";
  extent: string;
  description: string;
  weldLocation: WeldLocation | null;
  measurements: DefectMeasurement;
  evidence: EvidenceItem[];
};

type LayerState = {
  plateIds: boolean;
  previousDefects: boolean;
  repairs: boolean;
  gridLabels: boolean;
};

const STORAGE_KEY = "tank-inspection-coplilot:draft";

const surfaces: Array<{ surface: SurfaceType; label: string; description: string }> = [
  { surface: "bottom", label: "Bottom", description: "Floor plate matrix and annular band" },
  { surface: "shell", label: "Shell", description: "Unwrapped cylinder — courses and plates" },
  { surface: "roof", label: "Roof", description: "Polar sector grid — apex to outer edge" },
  { surface: "annular", label: "Annular ring", description: "Circumferential band at shell junction" },
  { surface: "nozzle", label: "Nozzle area", description: "Clock-face map per nozzle / manway" },
];

const defectTypes = [
  "Corrosion",
  "Crack",
  "Deformation",
  "Coating Failure",
  "Leakage",
  "Weld Defect",
  "Patch/Repair Observation",
  "Other",
];

const plateMap = [
  { plateId: "A01", x: 4, y: 2, subzone: "North floor plate" },
  { plateId: "A07", x: 7, y: 3, subzone: "North-east floor plate" },
  { plateId: "A12", x: 12, y: 4, subzone: "Central repaired plate" },
  { plateId: "B04", x: 5, y: 6, subzone: "West annular edge" },
  { plateId: "C09", x: 15, y: 7, subzone: "South-east floor plate" },
];

const nowIso = () => new Date().toISOString();

const makeLocation = (
  surface: SurfaceType,
  x: number,
  y: number,
  locationMode: LocationMode,
  plateId?: string | null,
): GridLocation => ({
  surface,
  x,
  y,
  gridId: `${x}-${y}`,
  plateId: plateId ?? inferPlateId(x, y),
  locationMode,
  isAnnular: y <= 1 || y >= 10 || x <= 1 || x >= 20,
});

const inferPlateId = (x: number, y: number) => {
  const match = plateMap.find((plate) => plate.x === x && plate.y === y);
  return match?.plateId ?? null;
};

const createSurface = (surface: SurfaceType): SurfaceInspection => ({
  surface,
  gridCols: surface === "shell" ? 24 : 20,
  gridRows: surface === "shell" ? 12 : 10,
  completed: false,
  defects: [],
});

const createSession = (): InspectionSession => ({
  id: "INS-2026-0413-001",
  siteId: "SLNG Terminal",
  clientId: "Operations Integrity",
  tankId: "TK-201",
  inspectionType: "internal",
  inspectorId: "Field Engineer",
  startedAt: nowIso(),
  tankProfile: {
    designCode: "API_653",
    diameterM: 30.0,
    heightM: 14.5,
    capacityM3: 10200,
    roofType: "single_deck_floating",
    foundationType: "concrete_ring_wall",
  },
  orientation: {
    gpsLat: 1.2644,
    gpsLng: 103.7502,
    referenceOrigin: "true_north" as ReferenceOriginType,
    referenceMarker: null,
    referenceDescription: null,
    referenceMarkerBearingDeg: null,
  },
  shellConfig: null,
  roofConfig: null,
  annularConfig: null,
  nozzleConfig: null,
  surfaces: surfaces.map(({ surface }) => createSurface(surface)),
  syncStatus: "draft",
});

const createDraft = (): DraftDefect => ({
  location: makeLocation("bottom", 12, 4, "tap_map", "A12"),
  defectType: "",
  defectSubtype: "",
  severity: "",
  extent: "single cell",
  description: "",
  weldLocation: null,
  measurements: {},
  evidence: [],
});

const severityClass: Record<Severity, string> = {
  minor: "bg-yellow-100 text-ink border-yellow-300",
  moderate: "bg-orange-100 text-ink border-orange-300",
  severe: "bg-red-100 text-danger border-red-300",
};

function usePersistedSession() {
  const [session, setSession] = useState<InspectionSession>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createSession();
    try {
      const parsed = JSON.parse(stored) as InspectionSession;
      const defaults = createSession();
      return {
        ...parsed,
        tankProfile: parsed.tankProfile ?? defaults.tankProfile,
        orientation: parsed.orientation ?? defaults.orientation,
        shellConfig: parsed.shellConfig ?? null,
        roofConfig: parsed.roofConfig ?? null,
        annularConfig: parsed.annularConfig ?? null,
        nozzleConfig: parsed.nozzleConfig ?? null,
      };
    } catch {
      return createSession();
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  return [session, setSession] as const;
}

type ShellGeometry = {
  numCourses: number;
  platesPerCourse: number;
  stdCourseHeightMm: number;
  topCourseHeightMm: number;
  seamOriginC1Deg: number;
  offsetDeg: number;       // single step per cycle (half plate, third plate, or custom)
  plateSpanDeg: number;
  circumferenceMm: number;
  plateWidthMm: number;
  seamOffsetRule: SeamOffsetRule;
};

function computeShellGeometry(sc: ShellConfig, diameterM: number): ShellGeometry | null {
  if (!sc.numCourses || !diameterM || !sc.plateWidthMm) return null;
  const circumferenceMm = diameterM * Math.PI * 1000;
  const platesPerCourse = Math.floor(circumferenceMm / sc.plateWidthMm);
  if (platesPerCourse < 1) return null;
  const plateSpanDeg = 360 / platesPerCourse;
  const stepDeg =
    sc.seamOffsetRule === "half_plate" ? plateSpanDeg / 2
    : sc.seamOffsetRule === "third_plate" ? plateSpanDeg / 3
    : sc.customOffsetDeg ?? 0;
  const topCourseHeightMm = sc.plateLengthMm * sc.numCourses !== Math.round(diameterM * 1000)
    ? sc.plateLengthMm
    : sc.plateLengthMm;
  return {
    numCourses: sc.numCourses,
    platesPerCourse,
    stdCourseHeightMm: sc.plateLengthMm,
    topCourseHeightMm: sc.plateLengthMm,
    seamOriginC1Deg: sc.seamOriginC1Deg,
    offsetDeg: stepDeg,
    plateSpanDeg,
    circumferenceMm,
    plateWidthMm: sc.plateWidthMm,
    seamOffsetRule: sc.seamOffsetRule,
  };
}

// Returns the seam origin for course i (0-indexed) using the conventional repeating pattern:
//   half_plate  → 2-course repeat: odd=0, even=½ plate
//   third_plate → 3-course repeat: 0, ⅓, ⅔, 0, ⅓, ⅔ …
//   custom      → cumulative (each course adds the fixed step)
function courseSeamOrigin(i: number, c1: number, stepDeg: number, rule: SeamOffsetRule): number {
  const cycle = rule === "half_plate" ? 2 : rule === "third_plate" ? 3 : 0;
  const phaseIndex = cycle > 0 ? i % cycle : i;
  return ((c1 + phaseIndex * stepDeg) % 360 + 360) % 360;
}

function App() {
  if (ENABLE_V2_DESIGN_PROTOTYPE) {
    return <InspectionSetupPrototype />;
  }

  const [screen, setScreen] = useState<Screen>("home");
  const [session, setSession] = usePersistedSession();
  const [surface, setSurface] = useState<SurfaceType>("bottom");
  const [locationMode, setLocationMode] = useState<LocationMode>("tap_map");
  const [draft, setDraft] = useState<DraftDefect>(() => createDraft());
  const [layers, setLayers] = useState<LayerState>({
    plateIds: true,
    previousDefects: true,
    repairs: true,
    gridLabels: true,
  });
  const [manualX, setManualX] = useState("12");
  const [manualY, setManualY] = useState("4");
  const [selectedNozzle, setSelectedNozzle] = useState<NozzleDefinition | null>(null);

  const shellGeometry = useMemo(
    () => session.shellConfig && session.tankProfile
      ? computeShellGeometry(session.shellConfig, session.tankProfile.diameterM)
      : null,
    [session.shellConfig, session.tankProfile],
  );

  const surfaceInspection = useMemo(
    () => session.surfaces.find((item) => item.surface === surface) ?? createSurface(surface),
    [session.surfaces, surface],
  );

  const updateDraft = (patch: Partial<DraftDefect>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSession((current) => ({ ...current, syncStatus: "pending_sync" }));
  };

  const setLocation = (location: GridLocation) => {
    updateDraft({ location });
  };

  const saveDefect = () => {
    if (!draft.location || !draft.defectType || !draft.severity || draft.evidence.length === 0) {
      return;
    }
    const record: DefectRecord = {
      id: `DEF-${Date.now()}`,
      inspectionId: session.id,
      tankId: session.tankId,
      location: draft.location,
      defectType: draft.defectType,
      defectSubtype: draft.defectSubtype || null,
      severity: draft.severity,
      extent: draft.extent || null,
      description: draft.description || null,
      weldLocation: draft.weldLocation,
      measurements: draft.measurements,
      evidence: draft.evidence,
      createdBy: session.inspectorId,
      createdAt: nowIso(),
    };

    setSession((current) => ({
      ...current,
      syncStatus: "pending_sync",
      surfaces: current.surfaces.map((item) =>
        item.surface === surface ? { ...item, defects: [...item.defects, record] } : item,
      ),
    }));
    setScreen("saved");
  };

  const markSurfaceComplete = () => {
    setSession((current) => ({
      ...current,
      syncStatus: "pending_sync",
      surfaces: current.surfaces.map((item) =>
        item.surface === surface ? { ...item, completed: true } : item,
      ),
    }));
    setScreen("validation");
  };

  const addEvidence = () => {
    if (!draft.location) return;
    const evidence: EvidenceItem = {
      id: `EV-${Date.now()}`,
      type: "photo",
      uri: "local://photo/tk-201-floor-defect.jpg",
      timestamp: nowIso(),
      gps: null,
      linkedX: draft.location.x,
      linkedY: draft.location.y,
      linkedSurface: draft.location.surface,
    };
    updateDraft({ evidence: [...draft.evidence, evidence] });
  };

  const validateManualCoordinates = () => {
    const x = Number(manualX);
    const y = Number(manualY);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return;
    if (!isCellValid(surface, x, y, surfaceInspection.gridCols, surfaceInspection.gridRows)) return;
    setLocation(makeLocation(surface, x, y, "manual_xy"));
    setScreen("confirm");
  };

  const choosePlate = (plate: (typeof plateMap)[number]) => {
    setLocation(makeLocation(surface, plate.x, plate.y, "plate_id", plate.plateId));
    setScreen("confirm");
  };

  return (
    <AppShell
      title="Tank Inspection Copilot"
      syncStatus={session.syncStatus}
      screen={screen}
      onHome={() => setScreen("home")}
      onDrafts={() => setScreen("surfaceMap")}
      onValidation={() => setScreen("validation")}
      onExport={() => setScreen("export")}
    >
      {screen === "home" && (
        <HomeScreen
          session={session}
          onStart={() => setScreen("setup")}
          onResume={() => setScreen("overview")}
        />
      )}

      {screen === "setup" && (
        <InspectionSetupScreen
          session={session}
          setSession={setSession}
          onContinue={() => setScreen("tankProfile")}
          onSaveDraft={() => setScreen("home")}
        />
      )}

      {screen === "overview" && (
        <TankOverviewScreen
          session={session}
          onChooseSurface={(nextSurface) => {
            setSurface(nextSurface);
            setDraft((current) => ({
              ...current,
              location: makeLocation(nextSurface, 12, 4, "tap_map", inferPlateId(12, 4)),
            }));
            if (nextSurface === "bottom") { setScreen("mflImport"); return; }
            if (nextSurface === "shell") { setScreen("shellSetup"); return; }
            if (nextSurface === "roof") { setScreen("roofSetup"); return; }
            if (nextSurface === "annular") { setScreen("annularSetup"); return; }
            if (nextSurface === "nozzle") {
              if (!session.nozzleConfig) { setScreen("nozzleSetup"); return; }
              setScreen("nozzleList"); return;
            }
            setScreen("mode");
          }}
        />
      )}

      {screen === "mode" && (
        <LocationModeScreen
          surface={surface}
          onChoose={(mode) => {
            setLocationMode(mode);
            setScreen(mode === "tap_map" ? "map" : mode === "manual_xy" ? "manual" : "plate");
          }}
        />
      )}

      {screen === "map" && (
        <MapLocationScreen
          session={session}
          surfaceInspection={surfaceInspection}
          shellGeometry={surface === "shell" ? shellGeometry : null}
          roofConfig={surface === "roof" ? (session.roofConfig ?? null) : null}
          annularConfig={surface === "annular" ? (session.annularConfig ?? null) : null}
          selectedNozzle={surface === "nozzle" ? selectedNozzle : null}
          selected={draft.location}
          layers={layers}
          setLayers={setLayers}
          onSelect={(x, y) => setLocation(makeLocation(
            surface, x, y, "tap_map",
            surface === "nozzle" && selectedNozzle ? selectedNozzle.id : undefined,
          ))}
          onConfirm={() => draft.location && setScreen("confirm")}
        />
      )}

      {screen === "manual" && (
        <ManualEntryScreen
          surfaceInspection={surfaceInspection}
          surface={surface}
          manualX={manualX}
          manualY={manualY}
          setManualX={setManualX}
          setManualY={setManualY}
          onPreview={() => setScreen("map")}
          onConfirm={validateManualCoordinates}
        />
      )}

      {screen === "plate" && <PlatePickerScreen onChoose={choosePlate} onMap={() => setScreen("map")} />}

      {screen === "confirm" && (
        <LocationConfirmationScreen
          location={draft.location}
          surfaceInspection={surfaceInspection}
          shellGeometry={draft.location?.surface === "shell" ? shellGeometry : null}
          roofConfig={draft.location?.surface === "roof" ? (session.roofConfig ?? null) : null}
          annularConfig={draft.location?.surface === "annular" ? (session.annularConfig ?? null) : null}
          selectedNozzle={draft.location?.surface === "nozzle" ? selectedNozzle : null}
          onEdit={() => setScreen(locationMode === "tap_map" ? "map" : locationMode === "manual_xy" ? "manual" : "plate")}
          onUse={() => setScreen("type")}
        />
      )}

      {screen === "type" && (
        <DefectTypeScreen
          location={draft.location}
          onChoose={(defectType) => {
            updateDraft({ defectType });
            setScreen("details");
          }}
        />
      )}

      {screen === "details" && (
        <DefectDetailScreen
          draft={draft}
          updateDraft={updateDraft}
          onNext={() => setScreen("measurements")}
          onSkip={() => setScreen("evidence")}
        />
      )}

      {screen === "measurements" && (
        <MeasurementScreen
          draft={draft}
          updateDraft={updateDraft}
          onNext={() => setScreen("evidence")}
        />
      )}

      {screen === "evidence" && (
        <EvidenceScreen
          draft={draft}
          addEvidence={addEvidence}
          removeEvidence={(id) => updateDraft({ evidence: draft.evidence.filter((item) => item.id !== id) })}
          onSave={saveDefect}
        />
      )}

      {screen === "saved" && (
        <DefectSavedScreen
          draft={draft}
          onAddAnother={() => {
            const nextLocation = draft.location;
            setDraft({ ...createDraft(), location: nextLocation });
            setScreen("type");
          }}
          onReturnMap={() => setScreen("surfaceMap")}
          onFinishSurface={() => setScreen("surfaceReview")}
        />
      )}

      {screen === "surfaceMap" && (
        <SurfaceDefectMapScreen
          session={session}
          surfaceInspection={surfaceInspection}
          shellGeometry={surface === "shell" ? shellGeometry : null}
          roofConfig={surface === "roof" ? (session.roofConfig ?? null) : null}
          annularConfig={surface === "annular" ? (session.annularConfig ?? null) : null}
          selectedNozzle={surface === "nozzle" ? selectedNozzle : null}
          layers={layers}
          setLayers={setLayers}
          selected={draft.location}
          onAdd={() => setScreen("mode")}
          onFinish={() => setScreen("surfaceReview")}
        />
      )}

      {screen === "surfaceReview" && (
        <SurfaceReviewScreen surfaceInspection={surfaceInspection} onFix={() => setScreen("surfaceMap")} onComplete={markSurfaceComplete} />
      )}

      {screen === "validation" && (
        <InspectionValidationScreen
          session={session}
          onFix={() => setScreen("overview")}
          onSubmit={() => setScreen("export")}
        />
      )}

      {screen === "tankProfile" && (
        <TankProfileScreen
          session={session}
          setSession={setSession}
          onContinue={() => setScreen("orientation")}
          onSaveDraft={() => setScreen("home")}
        />
      )}

      {screen === "orientation" && (
        <OrientationScreen
          session={session}
          setSession={setSession}
          onContinue={() => setScreen("overview")}
          onSaveDraft={() => setScreen("home")}
        />
      )}

      {screen === "shellSetup" && (
        <ShellSetupScreen
          session={session}
          setSession={setSession}
          onContinue={() => setScreen("mode")}
          onBack={() => setScreen("overview")}
        />
      )}

      {screen === "roofSetup" && (
        <RoofSetupScreen
          session={session}
          setSession={setSession}
          onContinue={() => setScreen("mode")}
          onBack={() => setScreen("overview")}
        />
      )}

      {screen === "annularSetup" && (
        <AnnularSetupScreen
          session={session}
          setSession={setSession}
          onContinue={() => setScreen("map")}
          onBack={() => setScreen("overview")}
        />
      )}

      {screen === "nozzleSetup" && (
        <NozzleSetupScreen
          session={session}
          setSession={setSession}
          onContinue={() => setScreen("nozzleList")}
          onBack={() => setScreen("overview")}
        />
      )}

      {screen === "nozzleList" && (
        <NozzleListScreen
          session={session}
          onSetup={() => setScreen("nozzleSetup")}
          onBack={() => setScreen("overview")}
          onSelectNozzle={(nozzle) => {
            setSelectedNozzle(nozzle);
            setDraft((cur) => ({ ...cur, location: null }));
            setScreen("map");
          }}
        />
      )}

      {screen === "mflImport" && (
        <MflImportScreen
          surfaceInspection={surfaceInspection}
          onSave={(report) => {
            setSession((current) => ({
              ...current,
              syncStatus: "pending_sync",
              surfaces: current.surfaces.map((item) =>
                item.surface === "bottom"
                  ? { ...item, mflReport: report, completed: true }
                  : item,
              ),
            }));
            setScreen("surfaceMap");
          }}
          onManual={() => setScreen("mode")}
          onSkip={() => setScreen("surfaceMap")}
        />
      )}

      {screen === "export" && (
        <ExportScreen
          session={session}
          onSubmit={() => {
            setSession((current) => ({ ...current, syncStatus: "synced" }));
            setScreen("success");
          }}
        />
      )}

      {screen === "success" && (
        <SubmissionSuccessScreen
          onMap={() => setScreen("surfaceMap")}
          onNew={() => {
            const next = createSession();
            setSession(next);
            setDraft(createDraft());
            setScreen("setup");
          }}
          onHome={() => setScreen("home")}
        />
      )}
    </AppShell>
  );
}

function AppShell({
  children,
  title,
  syncStatus,
  screen,
  onHome,
  onDrafts,
  onValidation,
  onExport,
}: {
  children: React.ReactNode;
  title: string;
  syncStatus: InspectionSession["syncStatus"];
  screen: Screen;
  onHome: () => void;
  onDrafts: () => void;
  onValidation: () => void;
  onExport: () => void;
}) {
  return (
    <main className="min-h-screen bg-[#e8eeeb] text-ink">
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-field shadow-soft">
        <header className="sticky top-0 z-30 border-b border-line bg-panel px-4 pb-3 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase text-tealDark">Field capture</p>
              <h1 className="text-xl font-semibold">{title}</h1>
            </div>
            <SyncStatusBadge status={syncStatus} />
          </div>
        </header>

        <section className="min-h-[calc(100vh-144px)] px-4 py-4">{children}</section>

        <nav className="sticky bottom-0 z-30 grid grid-cols-4 border-t border-line bg-panel px-2 py-2 text-xs font-semibold">
          <NavButton label="Home" active={screen === "home"} onClick={onHome} />
          <NavButton label="Drafts" active={screen === "surfaceMap"} onClick={onDrafts} />
          <NavButton label="QA" active={screen === "validation"} onClick={onValidation} />
          <NavButton label="Export" active={screen === "export"} onClick={onExport} />
        </nav>
      </div>
    </main>
  );
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mx-1 min-h-12 rounded-md px-2 ${active ? "bg-mint text-tealDark" : "text-slate-600"}`}
    >
      {label}
    </button>
  );
}

function SyncStatusBadge({ status }: { status: InspectionSession["syncStatus"] }) {
  const label = status === "synced" ? "Synced" : status === "pending_sync" ? "Unsynced" : "Draft";
  const color = status === "synced" ? "border-teal bg-mint text-tealDark" : "border-caution bg-yellow-50 text-ink";
  return <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${color}`}>{label}</span>;
}

function HomeScreen({ session, onStart, onResume }: { session: InspectionSession; onStart: () => void; onResume: () => void }) {
  const defectCount = session.surfaces.reduce((sum, item) => sum + item.defects.length, 0);
  return (
    <div className="space-y-4">
      <InspectionHeader session={session} />
      <section className="panel">
        <p className="eyebrow">Today</p>
        <h2 className="section-title">Capture tank defects on a grid map</h2>
        <p className="body-copy">Select the tank surface, tap the exact partition, attach evidence, and keep the record ready for API 653 review.</p>
        <div className="mt-4 grid gap-3">
          <button type="button" className="primary-button" onClick={onStart}>Start New Inspection</button>
          <button type="button" className="secondary-button" onClick={onResume}>Resume Draft Inspection</button>
          <button type="button" className="secondary-button">View Past Inspections</button>
        </div>
      </section>
      <section className="panel">
        <p className="eyebrow">Open draft</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Tank" value={session.tankId} />
          <Metric label="Defects" value={String(defectCount)} />
          <Metric label="Surfaces" value={`${session.surfaces.filter((item) => item.completed).length}/${session.surfaces.length}`} />
        </div>
      </section>
    </div>
  );
}

function InspectionHeader({ session }: { session: InspectionSession }) {
  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{session.siteId}</p>
          <h2 className="text-lg font-semibold">{session.tankId}</h2>
        </div>
        <span className="rounded-md bg-field px-2 py-1 text-xs font-semibold capitalize">{session.inspectionType}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">Inspector: {session.inspectorId}</p>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-field p-2">
      <p className="text-xs text-slate-600">{label}</p>
      <p className="mt-1 text-base font-semibold">{value}</p>
    </div>
  );
}

function InspectionSetupScreen({
  session,
  setSession,
  onContinue,
  onSaveDraft,
}: {
  session: InspectionSession;
  setSession: React.Dispatch<React.SetStateAction<InspectionSession>>;
  onContinue: () => void;
  onSaveDraft: () => void;
}) {
  const [siteId, setSiteId] = useState(session.siteId);
  const [clientId, setClientId] = useState(session.clientId ?? "");
  const [tankId, setTankId] = useState(session.tankId);
  const [inspectionType, setInspectionType] = useState(session.inspectionType);
  const valid = siteId && tankId && inspectionType;

  const save = () => {
    setSession((current) => ({ ...current, siteId, clientId, tankId, inspectionType, syncStatus: "pending_sync" }));
  };

  return (
    <div className="space-y-4">
      <ScreenTitle title="Inspection Setup" subtitle="Define the field context before location capture." />
      <section className="panel space-y-3">
        <Field label="Site" value={siteId} onChange={setSiteId} />
        <Field label="Client" value={clientId} onChange={setClientId} />
        <Field label="Tank ID" value={tankId} onChange={setTankId} />
        <label className="field-label">
          Inspection type
          <select
            value={inspectionType}
            onChange={(event) => setInspectionType(event.target.value as InspectionSession["inspectionType"])}
            className="field-input"
          >
            <option value="routine">Routine</option>
            <option value="external">External</option>
            <option value="internal">Internal</option>
            <option value="special">Special</option>
          </select>
        </label>
        <p className="text-sm text-slate-600">Inspection date and inspector are auto-filled for this draft.</p>
      </section>
      <div className="action-stack">
        <button type="button" className="primary-button" disabled={!valid} onClick={() => { save(); onContinue(); }}>Continue</button>
        <button type="button" className="secondary-button" onClick={() => { save(); onSaveDraft(); }}>Save Draft</button>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      {label}
      <input className="field-input" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TankOverviewScreen({
  session,
  onChooseSurface,
}: {
  session: InspectionSession;
  onChooseSurface: (surface: SurfaceType) => void;
}) {
  const configuredMap: Partial<Record<SurfaceType, boolean>> = {
    shell: Boolean(session.shellConfig),
    roof: Boolean(session.roofConfig),
    annular: Boolean(session.annularConfig),
    nozzle: Boolean(session.nozzleConfig),
  };

  return (
    <div className="space-y-4">
      <InspectionHeader session={session} />
      <ScreenTitle title="Tank Overview" subtitle="Choose a surface — configure geometry then inspect." />
      <div className="grid gap-3">
        {surfaces.map((surfaceItem) => {
          const state = session.surfaces.find((item) => item.surface === surfaceItem.surface);
          const defectCount = state?.defects.length ?? 0;
          const needsSetup = surfaceItem.surface in configuredMap && !configuredMap[surfaceItem.surface];
          return (
            <SurfaceSelectorCard
              key={surfaceItem.surface}
              label={surfaceItem.label}
              description={surfaceItem.description}
              completed={Boolean(state?.completed)}
              defectCount={defectCount}
              needsSetup={needsSetup}
              onClick={() => onChooseSurface(surfaceItem.surface)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SurfaceSelectorCard({
  label,
  description,
  completed,
  defectCount,
  needsSetup,
  onClick,
}: {
  label: string;
  description: string;
  completed: boolean;
  defectCount: number;
  needsSetup?: boolean;
  onClick: () => void;
}) {
  const badge = completed
    ? { text: "Complete", cls: "bg-mint text-tealDark" }
    : needsSetup
    ? { text: "Setup required", cls: "bg-yellow-100 text-caution border border-caution" }
    : defectCount
    ? { text: `${defectCount} defects`, cls: "bg-field text-slate-700" }
    : { text: "Tap to inspect", cls: "bg-field text-slate-700" };
  return (
    <button type="button" className="touch-row text-left" onClick={onClick}>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      <span className={`rounded-md px-2 py-1 text-xs font-semibold ${badge.cls}`}>{badge.text}</span>
    </button>
  );
}

function LocationModeScreen({ surface, onChoose }: { surface: SurfaceType; onChoose: (mode: LocationMode) => void }) {
  return (
    <div className="space-y-4">
      <ScreenTitle title="Select location method" subtitle={`${formatSurface(surface)} location capture`} />
      <LocationModeCard title="Tap on Grid Map" description="Recommended for field use. Tap the exact partition and confirm." onClick={() => onChoose("tap_map")} recommended />
      <LocationModeCard title="Manual X,Y Entry" description="Use when map interaction is inconvenient or values are read from a checklist." onClick={() => onChoose("manual_xy")} />
      <LocationModeCard title="Plate ID Entry" description="Search a plate number and auto-fill its mapped grid partition." onClick={() => onChoose("plate_id")} />
    </div>
  );
}

function LocationModeCard({
  title,
  description,
  recommended,
  onClick,
}: {
  title: string;
  description: string;
  recommended?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="touch-row text-left" onClick={onClick}>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {recommended && <span className="rounded-md bg-mint px-2 py-1 text-xs font-semibold text-tealDark">Recommended</span>}
    </button>
  );
}

function MapLocationScreen({
  session,
  surfaceInspection,
  shellGeometry,
  roofConfig,
  annularConfig,
  selectedNozzle,
  selected,
  layers,
  setLayers,
  onSelect,
  onConfirm,
}: {
  session: InspectionSession;
  surfaceInspection: SurfaceInspection;
  shellGeometry?: ShellGeometry | null;
  roofConfig?: RoofConfig | null;
  annularConfig?: AnnularConfig | null;
  selectedNozzle?: NozzleDefinition | null;
  selected: GridLocation | null;
  layers: LayerState;
  setLayers: React.Dispatch<React.SetStateAction<LayerState>>;
  onSelect: (x: number, y: number) => void;
  onConfirm: () => void;
}) {
  const surf = surfaceInspection.surface;
  const hasCustomMap = (surf === "shell" && shellGeometry) || (surf === "roof" && roofConfig) || (surf === "annular" && annularConfig) || (surf === "nozzle" && selectedNozzle);
  const subtitle = surf === "shell" && shellGeometry
    ? `${shellGeometry.numCourses} courses · ${shellGeometry.platesPerCourse} plates · tap to select`
    : surf === "roof" && roofConfig
    ? `${roofConfig.sectorCount} sectors × ${roofConfig.ringCount} rings · tap to select`
    : surf === "annular"
    ? "36 zones × 10° each · tap the ring to select"
    : surf === "nozzle" && selectedNozzle
    ? `${selectedNozzle.id} — 12 clock positions × 3 rings · tap to select`
    : `${surfaceInspection.gridCols} × ${surfaceInspection.gridRows} grid`;
  return (
    <div className="space-y-4">
      <InspectionHeader session={session} />
      <ScreenTitle title={`${formatSurface(surf)} Map`} subtitle={subtitle} />
      {!hasCustomMap && <MapToolbar layers={layers} setLayers={setLayers} />}
      <SurfaceMapRenderer
        surfaceInspection={surfaceInspection}
        shellGeometry={shellGeometry}
        roofConfig={roofConfig}
        annularConfig={annularConfig}
        selectedNozzle={selectedNozzle}
        selected={selected}
        layers={layers}
        defects={surfaceInspection.defects}
        onSelect={onSelect}
      />
      <LocationSummaryCard location={selected} shellGeometry={shellGeometry} roofConfig={roofConfig} annularConfig={annularConfig} selectedNozzle={selectedNozzle} />
      <button type="button" className="primary-button" disabled={!selected} onClick={onConfirm}>Confirm Location</button>
    </div>
  );
}

function MapToolbar({ layers, setLayers }: { layers: LayerState; setLayers: React.Dispatch<React.SetStateAction<LayerState>> }) {
  const toggle = (key: keyof LayerState) => setLayers((current) => ({ ...current, [key]: !current[key] }));
  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <div className="grid grid-cols-2 gap-2">
        <LayerToggle label="Plate IDs" enabled={layers.plateIds} onClick={() => toggle("plateIds")} />
        <LayerToggle label="Grid labels" enabled={layers.gridLabels} onClick={() => toggle("gridLabels")} />
        <LayerToggle label="Prior defects" enabled={layers.previousDefects} onClick={() => toggle("previousDefects")} />
        <LayerToggle label="Repairs" enabled={layers.repairs} onClick={() => toggle("repairs")} />
      </div>
    </section>
  );
}

function LayerToggle({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${enabled ? "border-teal bg-mint text-tealDark" : "border-line bg-field text-slate-600"}`} onClick={onClick}>
      {label}
    </button>
  );
}

// ── Shell Surface Map ─────────────────────────────────────────────────────────
function ShellSurfaceMap({
  geometry,
  selected,
  defects,
  onSelect,
}: {
  geometry: ShellGeometry;
  selected: GridLocation | null;
  defects: DefectRecord[];
  onSelect?: (x: number, y: number) => void;
}) {
  const { numCourses, platesPerCourse, stdCourseHeightMm, topCourseHeightMm, seamOriginC1Deg, offsetDeg, plateSpanDeg, seamOffsetRule } = geometry;

  const ZOOM_STEPS = [10, 16, 24, 36, 52];
  const [zoomIdx, setZoomIdx] = useState(1);
  const cellW = ZOOM_STEPS[zoomIdx];
  const cellH = 44;
  const labelW = 72;
  const labelH = 28;
  const totalShellW = platesPerCourse * cellW;
  const svgW = labelW + totalShellW;
  const svgH = labelH + numCourses * cellH;

  const azimuthTicks = [0, 45, 90, 135, 180, 225, 270, 315];

  const getSeamOrigin = (courseIdx: number) =>
    courseSeamOrigin(courseIdx, seamOriginC1Deg, offsetDeg, seamOffsetRule);

  // Seam x-positions for a given course (0-indexed from bottom)
  const seamXs = (courseIdx: number): number[] => {
    const origin = getSeamOrigin(courseIdx);
    const originX = (origin / 360) * totalShellW;
    const xs: number[] = [];
    for (let j = -1; j <= platesPerCourse + 1; j++) {
      const x = ((originX + j * cellW) % totalShellW + totalShellW) % totalShellW;
      if (x >= 0 && x <= totalShellW) xs.push(x);
    }
    return [...new Set(xs.map(Math.round))].sort((a, b) => a - b);
  };

  const courseY = (courseNum: number) => labelH + (numCourses - courseNum) * cellH;

  const handleClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelect) return;
    const rect = (evt.currentTarget as SVGSVGElement).getBoundingClientRect();
    const cx = evt.clientX - rect.left - labelW;
    const cy = evt.clientY - rect.top - labelH;
    if (cx < 0 || cy < 0) return;
    const courseNum = numCourses - Math.floor(cy / cellH);
    if (courseNum < 1 || courseNum > numCourses) return;
    const azimuth = (cx / totalShellW) * 360;
    const courseIdx = courseNum - 1;
    const seamOrigin = getSeamOrigin(courseIdx);
    const relAzimuth = ((azimuth - seamOrigin) % 360 + 360) % 360;
    const plateIdx = Math.floor(relAzimuth / plateSpanDeg) + 1;
    onSelect(Math.min(plateIdx, platesPerCourse), courseNum);
  };

  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500">Scroll horizontally · each column = 1 plate · C1=bottom</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="min-h-8 min-w-8 rounded border border-line bg-field text-sm font-bold text-slate-700 disabled:opacity-30"
            disabled={zoomIdx === 0}
            onClick={() => setZoomIdx((z) => Math.max(0, z - 1))}
          >−</button>
          <span className="w-8 text-center text-xs font-semibold text-slate-600">{cellW}px</span>
          <button
            type="button"
            className="min-h-8 min-w-8 rounded border border-line bg-field text-sm font-bold text-slate-700 disabled:opacity-30"
            disabled={zoomIdx === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIdx((z) => Math.min(ZOOM_STEPS.length - 1, z + 1))}
          >+</button>
        </div>
      </div>
      <div className="overflow-auto rounded-md bg-field p-1">
        <svg
          width={svgW}
          height={svgH}
          onClick={handleClick}
          className="block cursor-crosshair"
          aria-label="Shell unwrapped surface map"
        >
          {/* Azimuth labels top */}
          {azimuthTicks.map((deg) => {
            const x = labelW + (deg / 360) * totalShellW;
            return (
              <g key={deg}>
                <line x1={x} y1={labelH - 6} x2={x} y2={labelH} stroke="#94A3A0" strokeWidth="1" />
                <text x={x} y={labelH - 8} textAnchor="middle" fontSize="9" fill="#52625E">{deg}°</text>
              </g>
            );
          })}
          {/* Reference origin tick */}
          <line x1={labelW} y1={labelH - 10} x2={labelW} y2={svgH} stroke="#075F5C" strokeWidth="1" strokeDasharray="3,3" />

          {/* Course rows */}
          {Array.from({ length: numCourses }, (_, i) => {
            const courseNum = i + 1;
            const y = courseY(courseNum);
            const courseH = courseNum === numCourses ? topCourseHeightMm : stdCourseHeightMm;
            const isTop = courseNum === numCourses;
            const seams = seamXs(i);

            // Plate cells — for coloring selected/defect
            return (
              <g key={courseNum}>
                {/* Course background */}
                <rect x={labelW} y={y} width={totalShellW} height={cellH}
                  fill={i % 2 === 0 ? "#F0F7F4" : "#E8F2EE"}
                  stroke="none"
                />
                {/* Plate seam vertical lines */}
                {seams.map((sx) => (
                  <line key={sx} x1={labelW + sx} y1={y} x2={labelW + sx} y2={y + cellH}
                    stroke="#9BB5AE" strokeWidth="1.5"
                  />
                ))}
                {/* Selected cell highlight */}
                {selected?.surface === "shell" && selected.y === courseNum && (() => {
                  const seamOrig = getSeamOrigin(courseNum - 1);
                  const plateStartDeg = (seamOrig + (selected.x - 1) * plateSpanDeg) % 360;
                  const px = labelW + (plateStartDeg / 360) * totalShellW;
                  return <rect x={px} y={y + 1} width={cellW - 1} height={cellH - 2} fill="#00857A" fillOpacity="0.25" stroke="#00857A" strokeWidth="1.5" rx="2" />;
                })()}
                {/* Defect dots */}
                {defects.filter((d) => d.location.surface === "shell" && d.location.y === courseNum).map((d) => {
                  const seamOrig = getSeamOrigin(courseNum - 1);
                  const plateStartDeg = (seamOrig + (d.location.x - 1) * plateSpanDeg) % 360;
                  const dotX = labelW + ((plateStartDeg + plateSpanDeg / 2) / 360) * totalShellW;
                  return <circle key={d.id} cx={dotX} cy={y + cellH / 2} r="5" fill="#DC2626" opacity="0.85" />;
                })}
                {/* Course horizontal border */}
                <line x1={labelW} y1={y} x2={svgW} y2={y} stroke="#9BB5AE" strokeWidth={courseNum === 1 ? 2 : 1} />
                {/* Y-axis label */}
                <rect x={0} y={y} width={labelW - 2} height={cellH} fill={i % 2 === 0 ? "#EAF3EF" : "#E0EDE9"} />
                <text x={4} y={y + 14} fontSize="10" fontWeight="bold" fill="#17201E">C{courseNum}{isTop ? " ▲" : ""}</text>
                <text x={4} y={y + 26} fontSize="8" fill="#52625E">{courseH}mm</text>
                <text x={4} y={y + 37} fontSize="8" fill="#9BB5AE">{getSeamOrigin(i).toFixed(1)}°</text>
              </g>
            );
          })}
          {/* Bottom border */}
          <line x1={labelW} y1={svgH} x2={svgW} y2={svgH} stroke="#9BB5AE" strokeWidth="2" />
          {/* Wrap boundary (360°=0°) */}
          <line x1={svgW} y1={labelH} x2={svgW} y2={svgH} stroke="#075F5C" strokeWidth="1" strokeDasharray="3,3" />
        </svg>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-danger" /> Defect</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded bg-teal opacity-50" /> Selected</span>
        <span className="flex items-center gap-1"><span className="inline-block w-3 border-t border-dashed border-tealDark" /> 0° ref</span>
      </div>
    </section>
  );
}

function GridMap({
  surfaceInspection,
  selected,
  layers,
  defects,
  onSelect,
}: {
  surfaceInspection: SurfaceInspection;
  selected: GridLocation | null;
  layers: LayerState;
  defects: DefectRecord[];
  onSelect?: (x: number, y: number) => void;
}) {
  const cols = surfaceInspection.gridCols;
  const rows = surfaceInspection.gridRows;
  const size = 40;
  const label = 28;
  const width = cols * size + label;
  const height = rows * size + label;
  const repairCells = new Set(["12-4", "13-4", "5-6", "16-7"]);
  const priorCells = new Set(["3-2", "8-3", "15-6"]);

  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-600">
        <span>Origin: {surfaceInspection.surface === "shell" ? "lower-left" : "top-left"}</span>
        <span>Pinch zoom and pan with the device browser</span>
      </div>
      <div className="overflow-auto rounded-md bg-field p-2">
        <svg role="img" aria-label={`${surfaceInspection.surface} location grid`} width={width} height={height} className="block">
          {layers.gridLabels && (
            <>
              {Array.from({ length: cols }, (_, index) => (
                <text key={`x-${index}`} x={label + index * size + size / 2} y={18} textAnchor="middle" className="svg-label">
                  {index + 1}
                </text>
              ))}
              {Array.from({ length: rows }, (_, index) => (
                <text key={`y-${index}`} x={14} y={label + index * size + size / 2 + 4} textAnchor="middle" className="svg-label">
                  {surfaceInspection.surface === "shell" ? rows - index : index + 1}
                </text>
              ))}
            </>
          )}
          {Array.from({ length: rows }, (_, rowIndex) =>
            Array.from({ length: cols }, (_, colIndex) => {
              const x = colIndex + 1;
              const y = surfaceInspection.surface === "shell" ? rows - rowIndex : rowIndex + 1;
              const valid = isCellValid(surfaceInspection.surface, x, y, cols, rows);
              const gridId = `${x}-${y}`;
              const isSelected = selected?.gridId === gridId && selected.surface === surfaceInspection.surface;
              const isAnnular = surfaceInspection.surface === "bottom" && (x === 1 || y === 1 || x === cols || y === rows);
              const hasDefect = defects.some((defect) => defect.location.gridId === gridId);
              const hasPrior = layers.previousDefects && priorCells.has(gridId);
              const hasRepair = layers.repairs && repairCells.has(gridId);
              const plateId = inferPlateId(x, y);
              return (
                <g key={gridId}>
                  <rect
                    x={label + colIndex * size}
                    y={label + rowIndex * size}
                    width={size}
                    height={size}
                    rx="3"
                    className={[
                      "grid-cell",
                      valid ? "grid-cell-valid" : "grid-cell-disabled",
                      isAnnular ? "grid-cell-annular" : "",
                      hasRepair ? "grid-cell-repair" : "",
                      hasPrior ? "grid-cell-prior" : "",
                      isSelected ? "grid-cell-selected" : "",
                    ].join(" ")}
                    onClick={() => valid && onSelect?.(x, y)}
                  />
                  {layers.plateIds && plateId && valid && (
                    <text x={label + colIndex * size + size / 2} y={label + rowIndex * size + 24} textAnchor="middle" className="svg-cell-text">
                      {plateId}
                    </text>
                  )}
                  {hasDefect && (
                    <circle cx={label + colIndex * size + size / 2} cy={label + rowIndex * size + size / 2} r="7" className="defect-dot" />
                  )}
                </g>
              );
            }),
          )}
        </svg>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <LegendSwatch label="Annular" className="border-teal bg-white" />
        <LegendSwatch label="Repair" className="border-repair bg-violet-100" />
        <LegendSwatch label="Defect" className="border-danger bg-red-100" />
      </div>
    </section>
  );
}

function LegendSwatch({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <span className={`h-4 w-4 rounded border-2 ${className}`} />
      {label}
    </div>
  );
}

function LocationSummaryCard({
  location, shellGeometry, roofConfig, annularConfig, selectedNozzle,
}: {
  location: GridLocation | null;
  shellGeometry?: ShellGeometry | null;
  roofConfig?: RoofConfig | null;
  annularConfig?: AnnularConfig | null;
  selectedNozzle?: NozzleDefinition | null;
}) {
  const surf = location?.surface;

  const shellInfo = surf === "shell" && shellGeometry && location ? (() => {
    const courseIdx = location.y - 1;
    const seamOrigin = courseSeamOrigin(courseIdx, shellGeometry.seamOriginC1Deg, shellGeometry.offsetDeg, shellGeometry.seamOffsetRule);
    const thetaDeg = ((seamOrigin + (location.x - 1) * shellGeometry.plateSpanDeg) % 360).toFixed(1);
    const zStart = courseIdx * shellGeometry.stdCourseHeightMm;
    const courseH = location.y === shellGeometry.numCourses ? shellGeometry.topCourseHeightMm : shellGeometry.stdCourseHeightMm;
    return { thetaDeg, zStart, courseH };
  })() : null;

  const roofInfo = surf === "roof" && roofConfig && location ? (() => {
    const spanDeg = 360 / roofConfig.sectorCount;
    const startDeg = ((location.x - 1) * spanDeg).toFixed(0);
    const endDeg = (location.x * spanDeg).toFixed(0);
    return { sector: location.x, ring: location.y, startDeg, endDeg };
  })() : null;

  const annularInfo = surf === "annular" && location ? (() => {
    const startDeg = ((location.x - 1) * 10).toFixed(0);
    const endDeg = (location.x * 10).toFixed(0);
    return { zone: location.x, startDeg, endDeg };
  })() : null;

  const CLOCK_LABELS = ["12","1","2","3","4","5","6","7","8","9","10","11"];
  const RING_LABELS = ["0–50 mm", "50–100 mm", "100–150 mm"];
  const nozzleInfo = surf === "nozzle" && selectedNozzle && location ? {
    nozzleId: selectedNozzle.id,
    clockLabel: CLOCK_LABELS[(location.x - 1) % 12] + ":00",
    ringLabel: RING_LABELS[(location.y - 1)] ?? "",
  } : null;

  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <p className="eyebrow">Selected location</p>
      {location ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {shellInfo ? (
            <>
              <Metric label="Course" value={`C${location.y}`} />
              <Metric label="Plate" value={`P${location.x}`} />
              <Metric label="Azimuth" value={`${shellInfo.thetaDeg}°`} />
              <Metric label="Elevation" value={`${shellInfo.zStart}–${shellInfo.zStart + shellInfo.courseH} mm`} />
            </>
          ) : roofInfo ? (
            <>
              <Metric label="Sector" value={`S${roofInfo.sector}`} />
              <Metric label="Ring" value={`R${roofInfo.ring}`} />
              <Metric label="Azimuth range" value={`${roofInfo.startDeg}°–${roofInfo.endDeg}°`} />
              <Metric label="Zone" value={`S${roofInfo.sector}-R${roofInfo.ring}`} />
            </>
          ) : annularInfo ? (
            <>
              <Metric label="Azimuth zone" value={`Zone ${annularInfo.zone}`} />
              <Metric label="Range" value={`${annularInfo.startDeg}°–${annularInfo.endDeg}°`} />
              <Metric label="Grid ID" value={location.gridId} />
              <Metric label="Band" value="Annular ring" />
            </>
          ) : nozzleInfo ? (
            <>
              <Metric label="Nozzle" value={nozzleInfo.nozzleId} />
              <Metric label="Position" value={nozzleInfo.clockLabel} />
              <Metric label="Distance" value={nozzleInfo.ringLabel} />
              <Metric label="Zone" value={`${nozzleInfo.clockLabel} R${location.y}`} />
            </>
          ) : (
            <>
              <Metric label="X" value={String(location.x)} />
              <Metric label="Y" value={String(location.y)} />
              <Metric label="Grid ID" value={location.gridId} />
              <Metric label="Plate" value={location.plateId ?? "Optional"} />
            </>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-slate-600">Tap the map to select a location.</p>
      )}
    </section>
  );
}

function ManualEntryScreen({
  surfaceInspection,
  surface,
  manualX,
  manualY,
  setManualX,
  setManualY,
  onPreview,
  onConfirm,
}: {
  surfaceInspection: SurfaceInspection;
  surface: SurfaceType;
  manualX: string;
  manualY: string;
  setManualX: (value: string) => void;
  setManualY: (value: string) => void;
  onPreview: () => void;
  onConfirm: () => void;
}) {
  const x = Number(manualX);
  const y = Number(manualY);
  const valid = Number.isInteger(x) && Number.isInteger(y) && isCellValid(surface, x, y, surfaceInspection.gridCols, surfaceInspection.gridRows);
  return (
    <div className="space-y-4">
      <ScreenTitle title="Manual X,Y Entry" subtitle={`Surface: ${formatSurface(surface)}`} />
      <section className="panel space-y-3">
        <Field label="X partition" value={manualX} onChange={setManualX} />
        <Field label="Y partition" value={manualY} onChange={setManualY} />
        <p className={`rounded-md border p-3 text-sm ${valid ? "border-teal bg-mint text-tealDark" : "border-danger bg-red-50 text-danger"}`}>
          {valid ? `Valid partition ${manualX}-${manualY}` : "This partition is outside the inspectable surface"}
        </p>
      </section>
      <div className="action-stack">
        <button type="button" className="secondary-button" onClick={onPreview}>Preview on Map</button>
        <button type="button" className="primary-button" disabled={!valid} onClick={onConfirm}>Confirm Location</button>
      </div>
    </div>
  );
}

function PlatePickerScreen({ onChoose, onMap }: { onChoose: (plate: (typeof plateMap)[number]) => void; onMap: () => void }) {
  const [query, setQuery] = useState("");
  const filtered = plateMap.filter((plate) => plate.plateId.toLowerCase().includes(query.toLowerCase()));
  return (
    <div className="space-y-4">
      <ScreenTitle title="Plate ID Picker" subtitle="Search the plate number from the drawing map." />
      <Field label="Plate ID" value={query} onChange={setQuery} />
      <div className="grid gap-3">
        {filtered.map((plate) => (
          <button type="button" className="touch-row text-left" key={plate.plateId} onClick={() => onChoose(plate)}>
            <div>
              <p className="font-semibold">{plate.plateId}</p>
              <p className="mt-1 text-sm text-slate-600">{plate.subzone}</p>
            </div>
            <span className="rounded-md bg-field px-2 py-1 text-sm font-semibold">{plate.x}-{plate.y}</span>
          </button>
        ))}
      </div>
      <button type="button" className="secondary-button" onClick={onMap}>Show on Map</button>
    </div>
  );
}

function LocationConfirmationScreen({
  location,
  surfaceInspection,
  shellGeometry,
  roofConfig,
  annularConfig,
  selectedNozzle,
  onEdit,
  onUse,
}: {
  location: GridLocation | null;
  surfaceInspection: SurfaceInspection;
  shellGeometry?: ShellGeometry | null;
  roofConfig?: RoofConfig | null;
  annularConfig?: AnnularConfig | null;
  selectedNozzle?: NozzleDefinition | null;
  onEdit: () => void;
  onUse: () => void;
}) {
  return (
    <div className="space-y-4">
      <ScreenTitle title="Confirm Location" subtitle="Lock the location before defect typing." />
      <LocationSummaryCard location={location} shellGeometry={shellGeometry} roofConfig={roofConfig} annularConfig={annularConfig} selectedNozzle={selectedNozzle} />
      <SurfaceMapRenderer
        surfaceInspection={surfaceInspection}
        shellGeometry={shellGeometry}
        roofConfig={roofConfig}
        annularConfig={annularConfig}
        selectedNozzle={selectedNozzle}
        selected={location}
        layers={{ plateIds: true, previousDefects: false, repairs: true, gridLabels: false }}
        defects={[]}
      />
      <div className="action-stack">
        <button type="button" className="primary-button" disabled={!location} onClick={onUse}>Use This Location</button>
        <button type="button" className="secondary-button" onClick={onEdit}>Edit Location</button>
      </div>
    </div>
  );
}

function DefectTypeScreen({ location, onChoose }: { location: GridLocation | null; onChoose: (defectType: string) => void }) {
  return (
    <div className="space-y-4">
      <ScreenTitle title="Defect Type" subtitle={location ? `${formatSurface(location.surface)} ${location.gridId}` : "No location selected"} />
      <DefectTypePicker onChoose={onChoose} />
    </div>
  );
}

function DefectTypePicker({ onChoose }: { onChoose: (defectType: string) => void }) {
  return (
    <div className="grid gap-3">
      {defectTypes.map((type) => (
        <button type="button" key={type} className="touch-row text-left font-semibold" onClick={() => onChoose(type)}>
          {type}
          <span className="text-sm font-normal text-slate-600">Select</span>
        </button>
      ))}
    </div>
  );
}

const WELD_OPTIONS: Array<{ value: WeldLocation; label: string; hint: string }> = [
  { value: "vertical_seam", label: "Vertical seam (VS)", hint: "At the vertical weld between adjacent plates in a course" },
  { value: "horizontal_seam", label: "Horizontal seam (HS)", hint: "At the weld along a course boundary" },
  { value: "nozzle_toe", label: "Nozzle toe weld", hint: "At the fillet or butt weld joining nozzle to shell / bottom" },
  { value: "annular_seam", label: "Annular seam", hint: "At the weld joining the annular plate to the shell or bottom" },
];

function DefectDetailScreen({
  draft,
  updateDraft,
  onNext,
  onSkip,
}: {
  draft: DraftDefect;
  updateDraft: (patch: Partial<DraftDefect>) => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const surf = draft.location?.surface;
  const showWeld = surf === "shell" || surf === "bottom" || surf === "roof" || surf === "annular" || surf === "nozzle";

  return (
    <div className="space-y-4">
      <ScreenTitle title="Defect Details" subtitle={draft.defectType || "Choose a defect type"} />
      <section className="panel space-y-3">
        <Field label="Subtype" value={draft.defectSubtype} onChange={(value) => updateDraft({ defectSubtype: value })} />
        <SeveritySelector value={draft.severity} onChange={(severity) => updateDraft({ severity })} />
        <label className="field-label">
          Extent
          <select className="field-input" value={draft.extent} onChange={(event) => updateDraft({ extent: event.target.value })}>
            <option>single cell</option>
            <option>multi-cell region</option>
            <option>edge/annular</option>
          </select>
        </label>
        {showWeld && (
          <div>
            <p className="mb-2 text-sm font-semibold">At a weld seam?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`min-h-11 rounded-md border px-3 text-sm font-semibold ${!draft.weldLocation ? "border-teal bg-mint text-tealDark" : "border-line bg-field text-slate-700"}`}
                onClick={() => updateDraft({ weldLocation: null })}
              >
                Field (no weld)
              </button>
              {WELD_OPTIONS.filter((o) => {
                if (surf === "annular") return o.value === "annular_seam" || o.value === "nozzle_toe";
                if (surf === "nozzle") return o.value === "nozzle_toe";
                return o.value !== "annular_seam";
              }).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  className={`min-h-11 rounded-md border px-2 text-xs font-semibold text-left leading-tight ${draft.weldLocation === o.value ? "border-teal bg-mint text-tealDark" : "border-line bg-field text-slate-700"}`}
                  onClick={() => updateDraft({ weldLocation: o.value })}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {draft.weldLocation && (
              <p className="mt-1 text-xs text-slate-500">{WELD_OPTIONS.find((o) => o.value === draft.weldLocation)?.hint}</p>
            )}
          </div>
        )}
        <label className="field-label">
          Description
          <textarea className="field-input min-h-24 resize-none" value={draft.description} onChange={(event) => updateDraft({ description: event.target.value })} placeholder="Add concise field notes" />
        </label>
      </section>
      <div className="action-stack">
        <button type="button" className="primary-button" disabled={!draft.defectType || !draft.severity} onClick={onNext}>Next: Measurements</button>
        <button type="button" className="secondary-button" onClick={onSkip}>Skip Measurements</button>
      </div>
    </div>
  );
}

function SeveritySelector({ value, onChange }: { value: Severity | ""; onChange: (severity: Severity) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">Severity</p>
      <div className="grid grid-cols-3 gap-2">
        {(["minor", "moderate", "severe"] as Severity[]).map((severity) => (
          <button
            type="button"
            key={severity}
            className={`min-h-12 rounded-md border px-2 text-sm font-semibold capitalize ${value === severity ? severityClass[severity] : "border-line bg-field text-slate-700"}`}
            onClick={() => onChange(severity)}
          >
            {severity}
          </button>
        ))}
      </div>
    </div>
  );
}

function MeasurementScreen({
  draft,
  updateDraft,
  onNext,
}: {
  draft: DraftDefect;
  updateDraft: (patch: Partial<DraftDefect>) => void;
  onNext: () => void;
}) {
  const warning = measurementWarning(draft);
  return (
    <div className="space-y-4">
      <ScreenTitle title="Measurements" subtitle={draft.defectType} />
      <MeasurementForm measurement={draft.measurements} updateMeasurement={(measurements) => updateDraft({ measurements })} defectType={draft.defectType} />
      {warning && <p className="rounded-md border border-caution bg-yellow-50 p-3 text-sm text-ink">{warning}</p>}
      <button type="button" className="primary-button" onClick={onNext}>Next: Evidence</button>
    </div>
  );
}

function MeasurementForm({
  measurement,
  updateMeasurement,
  defectType,
}: {
  measurement: DefectMeasurement;
  updateMeasurement: (measurement: DefectMeasurement) => void;
  defectType: string;
}) {
  const setNumber = (key: keyof DefectMeasurement, value: string) => {
    updateMeasurement({ ...measurement, [key]: value ? Number(value) : null });
  };
  return (
    <section className="panel space-y-3">
      <Field label="Measurement method" value={measurement.method ?? ""} onChange={(value) => updateMeasurement({ ...measurement, method: value })} />
      {defectType === "Crack" ? (
        <>
          <NumberField label="Crack length mm" value={measurement.crackLengthMm} onChange={(value) => setNumber("crackLengthMm", value)} />
          <NumberField label="Crack width mm" value={measurement.crackWidthMm} onChange={(value) => setNumber("crackWidthMm", value)} />
        </>
      ) : defectType === "Deformation" ? (
        <NumberField label="Deformation mm" value={measurement.deformationMm} onChange={(value) => setNumber("deformationMm", value)} />
      ) : (
        <>
          <NumberField label="UT thickness mm" value={measurement.utThicknessMm} onChange={(value) => setNumber("utThicknessMm", value)} />
          <NumberField label="Minimum thickness mm" value={measurement.minThicknessMm} onChange={(value) => setNumber("minThicknessMm", value)} />
          <NumberField label="Pit depth mm" value={measurement.pitDepthMm} onChange={(value) => setNumber("pitDepthMm", value)} />
        </>
      )}
    </section>
  );
}

function NumberField({ label, value, onChange }: { label: string; value?: number | null; onChange: (value: string) => void }) {
  return (
    <label className="field-label">
      {label}
      <input className="field-input" inputMode="decimal" type="number" value={value ?? ""} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function EvidenceScreen({
  draft,
  addEvidence,
  removeEvidence,
  onSave,
}: {
  draft: DraftDefect;
  addEvidence: () => void;
  removeEvidence: (id: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4">
      <ScreenTitle title="Evidence" subtitle={draft.location ? `${formatSurface(draft.location.surface)} ${draft.location.gridId}` : "No location selected"} />
      <EvidenceUploader evidence={draft.evidence} addEvidence={addEvidence} removeEvidence={removeEvidence} />
      {draft.evidence.length === 0 && <p className="rounded-md border border-danger bg-red-50 p-3 text-sm text-danger">At least one photo is required before saving.</p>}
      <button type="button" className="primary-button" disabled={!draft.location || !draft.defectType || !draft.severity || draft.evidence.length === 0} onClick={onSave}>Save Defect</button>
    </div>
  );
}

function EvidenceUploader({
  evidence,
  addEvidence,
  removeEvidence,
}: {
  evidence: EvidenceItem[];
  addEvidence: () => void;
  removeEvidence: (id: string) => void;
}) {
  return (
    <section className="panel space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="secondary-button" onClick={addEvidence}>Take Photo</button>
        <button type="button" className="secondary-button" onClick={addEvidence}>Upload Photo</button>
      </div>
      <div className="grid gap-2">
        {evidence.map((item) => (
          <div key={item.id} className="rounded-md border border-line bg-field p-3">
            <div className="h-24 rounded-md border border-line bg-[linear-gradient(135deg,#dde8e4,#ffffff_45%,#a7d6ce)]" />
            <div className="mt-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Photo evidence</p>
                <p className="text-xs text-slate-600">Linked to {formatSurface(item.linkedSurface)} {item.linkedX}-{item.linkedY}</p>
              </div>
              <button type="button" className="text-sm font-semibold text-danger" onClick={() => removeEvidence(item.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function DefectSavedScreen({
  draft,
  onAddAnother,
  onReturnMap,
  onFinishSurface,
}: {
  draft: DraftDefect;
  onAddAnother: () => void;
  onReturnMap: () => void;
  onFinishSurface: () => void;
}) {
  return (
    <div className="space-y-4">
      <ScreenTitle title="Defect Saved" subtitle="Record saved locally and queued for sync." />
      <DefectSummaryCard draft={draft} />
      <div className="action-stack">
        <button type="button" className="primary-button" onClick={onAddAnother}>Add Another Defect</button>
        <button type="button" className="secondary-button" onClick={onReturnMap}>Return to Surface Map</button>
        <button type="button" className="secondary-button" onClick={onFinishSurface}>Finish Surface</button>
      </div>
    </div>
  );
}

function DefectSummaryCard({ draft }: { draft: DraftDefect }) {
  return (
    <section className="panel">
      <div className="grid gap-2">
        <Metric label="Type" value={draft.defectType || "Required"} />
        <Metric label="Severity" value={draft.severity || "Required"} />
        <Metric label="Location" value={draft.location?.gridId ?? "Missing"} />
        <Metric label="Photos" value={String(draft.evidence.length)} />
      </div>
    </section>
  );
}

function SurfaceDefectMapScreen({
  session,
  surfaceInspection,
  shellGeometry,
  roofConfig,
  annularConfig,
  selectedNozzle,
  layers,
  setLayers,
  selected,
  onAdd,
  onFinish,
}: {
  session: InspectionSession;
  surfaceInspection: SurfaceInspection;
  shellGeometry?: ShellGeometry | null;
  roofConfig?: RoofConfig | null;
  annularConfig?: AnnularConfig | null;
  selectedNozzle?: NozzleDefinition | null;
  layers: LayerState;
  setLayers: React.Dispatch<React.SetStateAction<LayerState>>;
  selected: GridLocation | null;
  onAdd: () => void;
  onFinish: () => void;
}) {
  const surf = surfaceInspection.surface;
  const hasCustomMap = (surf === "shell" && shellGeometry) || (surf === "roof" && roofConfig) || (surf === "annular" && annularConfig) || (surf === "nozzle" && selectedNozzle);
  return (
    <div className="space-y-4">
      <InspectionHeader session={session} />
      <ScreenTitle title="Saved Defect Map" subtitle={`${surfaceInspection.defects.length} saved defects on ${formatSurface(surf)}`} />
      {surf === "bottom" && <MflStatusCard mflReport={surfaceInspection.mflReport ?? null} />}
      {!hasCustomMap && <MapToolbar layers={layers} setLayers={setLayers} />}
      <SurfaceMapRenderer
        surfaceInspection={surfaceInspection}
        shellGeometry={shellGeometry}
        roofConfig={roofConfig}
        annularConfig={annularConfig}
        selectedNozzle={selectedNozzle}
        selected={selected}
        layers={layers}
        defects={surfaceInspection.defects}
      />
      <div className="action-stack">
        <button type="button" className="primary-button" onClick={onAdd}>Add New Defect</button>
        <button type="button" className="secondary-button" onClick={onFinish}>Finish Surface</button>
      </div>
    </div>
  );
}

function SurfaceReviewScreen({
  surfaceInspection,
  onFix,
  onComplete,
}: {
  surfaceInspection: SurfaceInspection;
  onFix: () => void;
  onComplete: () => void;
}) {
  const warnings = surfaceWarnings(surfaceInspection);
  return (
    <div className="space-y-4">
      <ScreenTitle title="Surface Review" subtitle={formatSurface(surfaceInspection.surface)} />
      <section className="panel">
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Defects" value={String(surfaceInspection.defects.length)} />
          <Metric label="Photos" value={String(surfaceInspection.defects.reduce((sum, defect) => sum + defect.evidence.length, 0))} />
          <Metric label="Grid" value={`${surfaceInspection.gridCols} x ${surfaceInspection.gridRows}`} />
          <Metric label="Status" value={surfaceInspection.completed ? "Complete" : "In progress"} />
        </div>
      </section>
      {surfaceInspection.surface === "bottom" && (
        <MflStatusCard mflReport={surfaceInspection.mflReport ?? null} />
      )}
      <ValidationPanel warnings={warnings} />
      <div className="action-stack">
        <button type="button" className="secondary-button" onClick={onFix}>Go Back and Fix</button>
        <button type="button" className="primary-button" onClick={onComplete}>Mark Surface Complete</button>
      </div>
    </div>
  );
}

function InspectionValidationScreen({ session, onFix, onSubmit }: { session: InspectionSession; onFix: () => void; onSubmit: () => void }) {
  const warnings = inspectionWarnings(session);
  return (
    <div className="space-y-4">
      <ScreenTitle title="Inspection Validation" subtitle="Whole-inspection QA before submission." />
      <ValidationPanel warnings={warnings} />
      <section className="panel">
        <div className="grid gap-2">
          <Metric label="Required surfaces complete" value={warnings.some((item) => item.includes("surface")) ? "Needs review" : "Ready"} />
          <Metric label="Invalid coordinates" value={warnings.some((item) => item.includes("location")) ? "Found" : "None"} />
          <Metric label="Photo requirement" value={warnings.some((item) => item.includes("photo")) ? "Needs review" : "Ready"} />
        </div>
      </section>
      <div className="action-stack">
        <button type="button" className="secondary-button" onClick={onFix}>Fix Issues</button>
        <button type="button" className="primary-button" disabled={warnings.length > 0} onClick={onSubmit}>Submit Inspection</button>
      </div>
    </div>
  );
}

function ValidationPanel({ warnings }: { warnings: string[] }) {
  return (
    <section className="panel">
      <p className="eyebrow">Validation</p>
      {warnings.length === 0 ? (
        <p className="mt-2 rounded-md border border-teal bg-mint p-3 text-sm font-semibold text-tealDark">No blocking issues found.</p>
      ) : (
        <div className="mt-2 grid gap-2">
          {warnings.map((warning) => (
            <p key={warning} className="rounded-md border border-caution bg-yellow-50 p-3 text-sm text-ink">{warning}</p>
          ))}
        </div>
      )}
    </section>
  );
}

function SubmissionSuccessScreen({
  onMap,
  onNew,
  onHome,
}: {
  onMap: () => void;
  onNew: () => void;
  onHome: () => void;
}) {
  return (
    <div className="space-y-4">
      <section className="panel">
        <p className="eyebrow">Submitted</p>
        <h2 className="section-title">Inspection dataset generated</h2>
        <p className="body-copy">The report-ready defect dataset is synced and available for review.</p>
      </section>
      <div className="action-stack">
        <button type="button" className="primary-button" onClick={onMap}>View Defect Map</button>
        <button type="button" className="secondary-button" onClick={onNew}>Start Another Inspection</button>
        <button type="button" className="secondary-button" onClick={onHome}>Return Home</button>
      </div>
    </div>
  );
}

function ScreenTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="eyebrow">Workflow</p>
      <h2 className="section-title">{title}</h2>
      <p className="body-copy">{subtitle}</p>
    </div>
  );
}

function isCellValid(surface: SurfaceType, x: number, y: number, cols: number, rows: number) {
  if (x < 1 || x > cols || y < 1 || y > rows) return false;
  if (surface === "shell" || surface === "nozzle") return true;
  const cx = (cols + 1) / 2;
  const cy = (rows + 1) / 2;
  const rx = cols / 2;
  const ry = rows / 2;
  const normalized = ((x - cx) ** 2) / (rx ** 2) + ((y - cy) ** 2) / (ry ** 2);
  return normalized <= 1.05;
}

function formatSurface(surface: SurfaceType) {
  return surface.replace("_", " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function measurementWarning(draft: DraftDefect) {
  if (draft.defectType === "Corrosion" && !draft.measurements.utThicknessMm && !draft.measurements.minThicknessMm) {
    return "Warning: corrosion records should include UT or minimum thickness before final review.";
  }
  if (draft.defectType === "Crack" && !draft.measurements.crackLengthMm && !draft.measurements.crackWidthMm) {
    return "Warning: crack records should include size before final review.";
  }
  if (draft.defectType === "Deformation" && !draft.measurements.deformationMm) {
    return "Warning: deformation records should include dimension before final review.";
  }
  return "";
}

function surfaceWarnings(surfaceInspection: SurfaceInspection) {
  const warnings: string[] = [];
  if (surfaceInspection.defects.some((defect) => defect.evidence.length === 0)) warnings.push("A saved defect is missing a required photo.");
  if (surfaceInspection.surface === "bottom") {
    if (!surfaceInspection.mflReport && surfaceInspection.defects.length === 0) {
      warnings.push("Bottom surface has no MFL report and no manual observations.");
    }
    if (!surfaceInspection.mflReport) {
      warnings.push("No MFL report imported. Import the contractor report or confirm bottom was manually inspected.");
    }
  } else {
    if (surfaceInspection.defects.length === 0) warnings.push(`${formatSurface(surfaceInspection.surface)} has no saved defects or clear reviewed-cell record yet.`);
  }
  if (surfaceInspection.defects.some((defect) => !defect.defectSubtype)) warnings.push("One or more defects are missing subtype.");
  return warnings;
}

function inspectionWarnings(session: InspectionSession) {
  const warnings: string[] = [];
  if (!session.tankProfile) warnings.push("Tank profile (dimensions and design code) has not been filled in.");
  if (!session.orientation) warnings.push("Tank orientation (GPS and reference marker) has not been set.");
  const required = ["bottom", "shell"] as SurfaceType[];
  required.forEach((surface) => {
    const item = session.surfaces.find((surfaceInspection) => surfaceInspection.surface === surface);
    if (!item?.completed) warnings.push(`${formatSurface(surface)} surface is not complete.`);
  });
  session.surfaces.forEach((surfaceInspection) => {
    surfaceInspection.defects.forEach((defect) => {
      if (defect.evidence.length === 0) warnings.push(`${defect.defectType} at ${defect.location.gridId} has no photo.`);
      if (!isCellValid(defect.location.surface, defect.location.x, defect.location.y, surfaceInspection.gridCols, surfaceInspection.gridRows)) warnings.push(`${defect.defectType} has invalid location.`);
    });
  });
  return warnings;
}

// ── Tank Profile Screen ───────────────────────────────────────────────────────
function TankProfileScreen({
  session,
  setSession,
  onContinue,
  onSaveDraft,
}: {
  session: InspectionSession;
  setSession: React.Dispatch<React.SetStateAction<InspectionSession>>;
  onContinue: () => void;
  onSaveDraft: () => void;
}) {
  const p = session.tankProfile;
  const [designCode, setDesignCode] = useState<TankProfile["designCode"]>(p?.designCode ?? "API_653");
  const [diameterM, setDiameterM] = useState(String(p?.diameterM ?? ""));
  const [heightM, setHeightM] = useState(String(p?.heightM ?? ""));
  const [capacityM3, setCapacityM3] = useState(String(p?.capacityM3 ?? ""));
  const [roofType, setRoofType] = useState<TankProfile["roofType"]>(p?.roofType ?? "cone");
  const [foundationType, setFoundationType] = useState<TankProfile["foundationType"]>(p?.foundationType ?? "concrete_ring_wall");
  const valid = Number(diameterM) > 0 && Number(heightM) > 0;

  const save = () => {
    setSession((cur) => ({
      ...cur,
      syncStatus: "pending_sync",
      tankProfile: {
        designCode,
        diameterM: Number(diameterM),
        heightM: Number(heightM),
        capacityM3: capacityM3 ? Number(capacityM3) : null,
        roofType,
        foundationType,
      },
    }));
  };

  return (
    <div className="space-y-4">
      <ScreenTitle title="Tank Profile" subtitle="Physical dimensions and design standard — required for layout generation." />
      <section className="panel space-y-3">
        <p className="eyebrow">Design standard</p>
        <div className="grid grid-cols-3 gap-2">
          {(["API_650", "API_653", "other"] as const).map((code) => (
            <button
              key={code}
              type="button"
              className={`min-h-11 rounded-md border text-sm font-semibold ${designCode === code ? "border-teal bg-mint text-tealDark" : "border-line bg-field text-slate-700"}`}
              onClick={() => setDesignCode(code)}
            >
              {code === "API_650" ? "API 650" : code === "API_653" ? "API 653" : "Other"}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">API 650 = new construction · API 653 = in-service inspection</p>
      </section>
      <section className="panel space-y-3">
        <p className="eyebrow">Dimensions</p>
        <div className="grid grid-cols-2 gap-3">
          <NumberField label="Nominal diameter (m)" value={Number(diameterM) || null} onChange={(v) => setDiameterM(v)} />
          <NumberField label="Total height (m)" value={Number(heightM) || null} onChange={(v) => setHeightM(v)} />
        </div>
        <NumberField label="Nominal capacity (m³) — optional" value={Number(capacityM3) || null} onChange={(v) => setCapacityM3(v)} />
      </section>
      <section className="panel space-y-3">
        <p className="eyebrow">Construction type</p>
        <label className="field-label">
          Roof type
          <select className="field-input" value={roofType} onChange={(e) => setRoofType(e.target.value as TankProfile["roofType"])}>
            <option value="cone">Cone roof</option>
            <option value="dome">Dome roof</option>
            <option value="single_deck_floating">Single-deck floating roof</option>
            <option value="double_deck_floating">Double-deck floating roof</option>
            <option value="internal_floating">Internal floating roof</option>
          </select>
        </label>
        <label className="field-label">
          Foundation type
          <select className="field-input" value={foundationType} onChange={(e) => setFoundationType(e.target.value as TankProfile["foundationType"])}>
            <option value="earth">Earth (no ring wall)</option>
            <option value="gravel">Gravel pack</option>
            <option value="concrete_ring_wall">Concrete ring wall</option>
          </select>
        </label>
      </section>
      <div className="action-stack">
        <button type="button" className="primary-button" disabled={!valid} onClick={() => { save(); onContinue(); }}>Continue</button>
        <button type="button" className="secondary-button" onClick={() => { save(); onSaveDraft(); }}>Save Draft</button>
      </div>
    </div>
  );
}

// ── Orientation Screen ────────────────────────────────────────────────────────
function OrientationScreen({
  session,
  setSession,
  onContinue,
  onSaveDraft,
}: {
  session: InspectionSession;
  setSession: React.Dispatch<React.SetStateAction<InspectionSession>>;
  onContinue: () => void;
  onSaveDraft: () => void;
}) {
  const o = session.orientation;
  const [gpsLat, setGpsLat] = useState(String(o?.gpsLat ?? ""));
  const [gpsLng, setGpsLng] = useState(String(o?.gpsLng ?? ""));
  const [gpsStatus, setGpsStatus] = useState<"idle" | "fetching" | "done" | "error">("idle");
  const [referenceOrigin, setReferenceOrigin] = useState<ReferenceOriginType>(o?.referenceOrigin ?? "true_north");
  const [referenceMarker, setReferenceMarker] = useState<ReferenceMarkerType>(o?.referenceMarker ?? "painted_mark");
  const [referenceDescription, setReferenceDescription] = useState(o?.referenceDescription ?? "");
  const [markerBearing, setMarkerBearing] = useState(String(o?.referenceMarkerBearingDeg ?? "0"));

  const isPhysical = referenceOrigin === "physical_marker";
  const bearing = Math.max(0, Math.min(360, Number(markerBearing) || 0));

  const captureGps = () => {
    if (!navigator.geolocation) return;
    setGpsStatus("fetching");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLat(pos.coords.latitude.toFixed(6));
        setGpsLng(pos.coords.longitude.toFixed(6));
        setGpsStatus("done");
      },
      () => setGpsStatus("error"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const save = () => {
    setSession((cur) => ({
      ...cur,
      syncStatus: "pending_sync",
      orientation: {
        gpsLat: gpsLat ? Number(gpsLat) : null,
        gpsLng: gpsLng ? Number(gpsLng) : null,
        referenceOrigin,
        referenceMarker: isPhysical ? referenceMarker : null,
        referenceDescription: isPhysical && referenceDescription ? referenceDescription : null,
        referenceMarkerBearingDeg: isPhysical ? (Number(markerBearing) || 0) : null,
      },
    }));
  };

  return (
    <div className="space-y-4">
      <ScreenTitle title="Tank Orientation" subtitle="GPS location and azimuth reference — defines 0° for all shell defect locations." />

      <section className="panel space-y-3">
        <p className="eyebrow">GPS coordinates</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude (decimal °)" value={gpsLat} onChange={setGpsLat} />
          <Field label="Longitude (decimal °)" value={gpsLng} onChange={setGpsLng} />
        </div>
        <button type="button" className="secondary-button" onClick={captureGps}>
          {gpsStatus === "fetching" ? "Acquiring GPS…" : gpsStatus === "done" ? "GPS Captured ✓" : gpsStatus === "error" ? "GPS Error — Enter Manually" : "Use Device GPS"}
        </button>
      </section>

      <section className="panel space-y-3">
        <p className="eyebrow">Azimuth reference — defines 0°</p>
        <p className="text-xs text-slate-500 -mt-1">
          All defect azimuths on the shell are measured clockwise from this reference. Choose the method that matches the site drawing.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {(["true_north", "physical_marker"] as ReferenceOriginType[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`min-h-12 rounded-md border px-3 text-sm font-semibold ${referenceOrigin === mode ? "border-teal bg-mint text-tealDark" : "border-line bg-field text-slate-700"}`}
              onClick={() => setReferenceOrigin(mode)}
            >
              {mode === "true_north" ? "True North" : "Physical Marker"}
            </button>
          ))}
        </div>

        {!isPhysical && (
          <div className="rounded-md border border-line bg-field p-3 text-sm text-slate-600">
            0° = True North (geographic). Azimuths increase clockwise: 90° = East, 180° = South, 270° = West.
            No physical marker required.
          </div>
        )}

        {isPhysical && (
          <>
            <p className="text-xs text-slate-500">
              Identify a fixed feature on the tank shell as the 0° anchor. Record enough detail so a future inspector can locate the same point. Enter the bearing of this marker measured clockwise from True North — needed for site map alignment.
            </p>
            <label className="field-label">
              Marker type
              <select className="field-input" value={referenceMarker} onChange={(e) => setReferenceMarker(e.target.value as ReferenceMarkerType)}>
                <option value="painted_mark">Painted mark on shell</option>
                <option value="nozzle_n1">Nozzle N1</option>
                <option value="stairway">Access stairway</option>
                <option value="other">Other</option>
              </select>
            </label>
            <Field label="Description — how to find it on site" value={referenceDescription} onChange={setReferenceDescription} />
            <NumberField label="Marker bearing from True North (°)" value={bearing || null} onChange={setMarkerBearing} />
          </>
        )}
      </section>

      <section className="panel">
        <p className="eyebrow">Orientation preview</p>
        <div className="flex items-center justify-center py-2">
          <CompassRose referenceOrigin={referenceOrigin} markerBearing={bearing} />
        </div>
        <p className="mt-2 text-center text-xs text-slate-500">
          {isPhysical ? `Orange dot = physical marker at ${bearing}° from True North` : "0° fixed to True North — no marker required"}
        </p>
      </section>

      <div className="action-stack">
        <button type="button" className="primary-button" onClick={() => { save(); onContinue(); }}>Continue</button>
        <button type="button" className="secondary-button" onClick={() => { save(); onSaveDraft(); }}>Save Draft</button>
      </div>
    </div>
  );
}

function CompassRose({ referenceOrigin, markerBearing }: { referenceOrigin: ReferenceOriginType; markerBearing: number }) {
  const cx = 80, cy = 80, r = 58;
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  const isPhysical = referenceOrigin === "physical_marker";
  const mx = cx + (r - 10) * Math.cos(toRad(markerBearing));
  const my = cy + (r - 10) * Math.sin(toRad(markerBearing));
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" aria-label="Compass orientation preview">
      <circle cx={cx} cy={cy} r={r} fill="#DCEFE9" stroke="#CBD8D4" strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={r - 16} fill="none" stroke="#CBD8D4" strokeWidth="0.8" strokeDasharray="3,3" />
      {/* N arrow */}
      <line x1={cx} y1={cy} x2={cx} y2={cy - r + 6} stroke="#075F5C" strokeWidth="2.5" />
      <polygon points={`${cx},${cy - r + 6} ${cx - 5},${cy - r + 18} ${cx + 5},${cy - r + 18}`} fill="#075F5C" />
      <text x={cx} y={cy - r - 5} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#075F5C">N</text>
      {/* Cardinal labels */}
      <text x={cx + r + 8} y={cy + 5} textAnchor="middle" fontSize="10" fill="#52625E">E</text>
      <text x={cx - r - 8} y={cy + 5} textAnchor="middle" fontSize="10" fill="#52625E">W</text>
      <text x={cx} y={cy + r + 16} textAnchor="middle" fontSize="10" fill="#52625E">S</text>
      {/* True North mode: highlight the N anchor */}
      {!isPhysical && (
        <>
          <circle cx={cx} cy={cy - r + 10} r="9" fill="#075F5C" stroke="#CBD8D4" strokeWidth="1.5" />
          <text x={cx} y={cy - r + 14} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#FFFFFF">0°</text>
        </>
      )}
      {/* Physical marker mode: orange dot at bearing */}
      {isPhysical && (
        <>
          <circle cx={mx} cy={my} r="9" fill="#F2C078" stroke="#CBD8D4" strokeWidth="1.5" />
          <text x={mx} y={my + 4} textAnchor="middle" fontSize="7" fontWeight="bold" fill="#17201E">REF</text>
        </>
      )}
      {/* Center */}
      <circle cx={cx} cy={cy} r="3" fill="#17201E" />
    </svg>
  );
}

// ── MFL Import Screen ─────────────────────────────────────────────────────────
const mflSeverityLabel: Record<MflSeverity, string> = {
  clean: "Clean",
  minor: "Minor findings",
  significant: "Significant findings",
  critical: "Critical findings",
};
const mflSeverityClass: Record<MflSeverity, string> = {
  clean: "border-teal bg-mint text-tealDark",
  minor: "border-yellow-300 bg-yellow-50 text-ink",
  significant: "border-orange-300 bg-orange-50 text-ink",
  critical: "border-red-300 bg-red-100 text-danger",
};

function MflImportScreen({
  surfaceInspection,
  onSave,
  onManual,
  onSkip,
}: {
  surfaceInspection: SurfaceInspection;
  onSave: (report: MflReport) => void;
  onManual: () => void;
  onSkip: () => void;
}) {
  const existing = surfaceInspection.mflReport;
  const [contractor, setContractor] = useState(existing?.contractor ?? "TechnipFMC Inspection Services");
  const [reportRef, setReportRef] = useState(existing?.reportRef ?? "MFL-TK201-2026-001");
  const [reportDate, setReportDate] = useState(existing?.reportDate ?? "2026-04-10");
  const [scanCoverage, setScanCoverage] = useState<MflReport["scanCoverage"]>(existing?.scanCoverage ?? "full");
  const [coverageNote, setCoverageNote] = useState(existing?.scanCoverageNote ?? "");
  const [totalAnomalies, setTotalAnomalies] = useState(String(existing?.totalAnomalies ?? "3"));
  const [overallSeverity, setOverallSeverity] = useState<MflSeverity>(existing?.overallSeverity ?? "minor");
  const [notes, setNotes] = useState(existing?.notes ?? "Three minor pitting anomalies near annular ring at zones 2-1, 5-3 and 18-9. All within acceptable limits per API 653 §9.4.");

  const canSave = contractor && reportRef && reportDate;

  return (
    <div className="space-y-4">
      <ScreenTitle title="Bottom MFL Report" subtitle="Magnetic Flux Leakage scan data for tank bottom." />
      <section className="rounded-md border border-teal bg-mint p-3 text-sm text-tealDark">
        MFL scanning is the standard method for tank bottom inspection per API 653. Import the contractor's report to link it to this inspection record. You can still add manual topside observations via the Add Observations button below.
      </section>
      {existing && (
        <section className="rounded-md border border-teal bg-field p-3 text-sm font-semibold text-tealDark">
          MFL report already on file — editing will overwrite it.
        </section>
      )}
      <section className="panel space-y-3">
        <p className="eyebrow">Report details</p>
        <Field label="MFL contractor" value={contractor} onChange={setContractor} />
        <Field label="Report reference number" value={reportRef} onChange={setReportRef} />
        <Field label="Report date" value={reportDate} onChange={setReportDate} />
      </section>
      <section className="panel space-y-3">
        <p className="eyebrow">Scan results</p>
        <div>
          <p className="mb-2 text-sm font-semibold">Scan coverage</p>
          <div className="grid grid-cols-2 gap-2">
            {(["full", "partial"] as const).map((c) => (
              <button key={c} type="button" className={`min-h-11 rounded-md border text-sm font-semibold capitalize ${scanCoverage === c ? "border-teal bg-mint text-tealDark" : "border-line bg-field text-slate-700"}`} onClick={() => setScanCoverage(c)}>{c}</button>
            ))}
          </div>
        </div>
        {scanCoverage === "partial" && (
          <Field label="Coverage note (which area)" value={coverageNote} onChange={setCoverageNote} />
        )}
        <NumberField label="Total anomalies flagged" value={Number(totalAnomalies) || null} onChange={setTotalAnomalies} />
        <div>
          <p className="mb-2 text-sm font-semibold">Overall severity</p>
          <div className="grid grid-cols-2 gap-2">
            {(["clean", "minor", "significant", "critical"] as MflSeverity[]).map((sev) => (
              <button key={sev} type="button" className={`min-h-11 rounded-md border px-2 text-xs font-semibold ${overallSeverity === sev ? mflSeverityClass[sev] : "border-line bg-field text-slate-700"}`} onClick={() => setOverallSeverity(sev)}>
                {mflSeverityLabel[sev]}
              </button>
            ))}
          </div>
        </div>
        <label className="field-label">
          Notes
          <textarea className="field-input min-h-20 resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contractor observations, scan limitations, etc." />
        </label>
      </section>
      <div className="action-stack">
        <button type="button" className="primary-button" disabled={!canSave} onClick={() => onSave({ contractor, reportRef, reportDate, scanCoverage, scanCoverageNote: coverageNote || null, totalAnomalies: Number(totalAnomalies) || 0, overallSeverity, reportUri: null, notes: notes || null })}>
          Save MFL Report
        </button>
        <button type="button" className="secondary-button" onClick={onManual}>Add Manual Observations</button>
        <button type="button" className="secondary-button" onClick={onSkip}>Skip — No MFL Data Yet</button>
      </div>
    </div>
  );
}

// ── MFL Status Card (reused in map and review screens) ────────────────────────
function MflStatusCard({ mflReport }: { mflReport: MflReport | null }) {
  if (!mflReport) {
    return (
      <section className="rounded-md border border-caution bg-yellow-50 p-3">
        <p className="text-sm font-semibold text-ink">MFL Report: Not imported</p>
        <p className="mt-1 text-xs text-slate-600">No MFL report on file. Tap "Add New Defect" to add manual observations, or return to the bottom surface to import the MFL report.</p>
      </section>
    );
  }
  const cls = mflSeverityClass[mflReport.overallSeverity];
  return (
    <section className={`rounded-md border p-3 ${cls}`}>
      <p className="text-sm font-semibold">MFL Report: {mflSeverityLabel[mflReport.overallSeverity]}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Metric label="Contractor" value={mflReport.contractor} />
        <Metric label="Ref" value={mflReport.reportRef} />
        <Metric label="Coverage" value={mflReport.scanCoverage === "full" ? "Full scan" : `Partial — ${mflReport.scanCoverageNote ?? ""}`} />
        <Metric label="Anomalies" value={String(mflReport.totalAnomalies)} />
      </div>
    </section>
  );
}

// ── Export Screen ─────────────────────────────────────────────────────────────
function ExportScreen({ session, onSubmit }: { session: InspectionSession; onSubmit: () => void }) {
  const allDefects = session.surfaces.flatMap((s) => s.defects);
  const counts = { minor: 0, moderate: 0, severe: 0 };
  allDefects.forEach((d) => { counts[d.severity]++; });
  const totalPhotos = allDefects.reduce((sum, d) => sum + d.evidence.length, 0);
  const surfacesComplete = session.surfaces.filter((s) => s.completed).length;
  const mflSurface = session.surfaces.find((s) => s.surface === "bottom");
  const mflStatus = mflSurface?.mflReport ? `Imported — ${mflSeverityLabel[mflSurface.mflReport.overallSeverity]}` : "Not imported";

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.tankId}-${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const headers = ["ID","Surface","GridID","PlateID","WeldLocation","DefectType","Subtype","Severity","Extent","Description","UT_mm","MinThick_mm","PitDepth_mm","CrackLen_mm","CrackW_mm","Deform_mm","Photos","CreatedAt"];
    const rows = session.surfaces.flatMap((s) =>
      s.defects.map((d) => [
        d.id, d.location.surface, d.location.gridId, d.location.plateId ?? "",
        d.weldLocation ?? "field",
        d.defectType, d.defectSubtype ?? "", d.severity, d.extent ?? "", d.description ?? "",
        d.measurements.utThicknessMm ?? "", d.measurements.minThicknessMm ?? "",
        d.measurements.pitDepthMm ?? "", d.measurements.crackLengthMm ?? "",
        d.measurements.crackWidthMm ?? "", d.measurements.deformationMm ?? "",
        d.evidence.length, d.createdAt,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`)),
    );
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.tankId}-defects.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <ScreenTitle title="Export & Summary" subtitle="Download the inspection dataset for report generation." />
      <section className="panel">
        <p className="eyebrow">Executive summary</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Metric label="Inspection ID" value={session.id} />
          <Metric label="Tank" value={session.tankId} />
          <Metric label="Site" value={session.siteId} />
          <Metric label="Type" value={session.inspectionType} />
          <Metric label="Inspector" value={session.inspectorId} />
          <Metric label="Date" value={session.startedAt.slice(0, 10)} />
        </div>
      </section>
      {session.tankProfile && (
        <section className="panel">
          <p className="eyebrow">Tank profile</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric label="Design code" value={session.tankProfile.designCode.replace("_", " ")} />
            <Metric label="Diameter" value={`${session.tankProfile.diameterM} m`} />
            <Metric label="Height" value={`${session.tankProfile.heightM} m`} />
            <Metric label="Roof" value={session.tankProfile.roofType.replace(/_/g, " ")} />
            {session.shellConfig && <Metric label="Courses" value={String(session.shellConfig.numCourses)} />}
            {session.shellConfig && <Metric label="Plate width" value={`${session.shellConfig.plateWidthMm} mm`} />}
          </div>
        </section>
      )}
      {session.orientation && (
        <section className="panel">
          <p className="eyebrow">Orientation</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Metric label="GPS Lat" value={session.orientation.gpsLat ? String(session.orientation.gpsLat) : "—"} />
            <Metric label="GPS Lng" value={session.orientation.gpsLng ? String(session.orientation.gpsLng) : "—"} />
            <Metric label="Reference origin" value={session.orientation.referenceOrigin === "true_north" ? "True North" : "Physical marker"} />
            {session.orientation.referenceMarker && (
              <Metric label="Marker" value={session.orientation.referenceMarker.replace(/_/g, " ")} />
            )}
            {session.orientation.referenceMarkerBearingDeg != null && (
              <Metric label="Marker bearing" value={`${session.orientation.referenceMarkerBearingDeg}°`} />
            )}
          </div>
        </section>
      )}
      <section className="panel">
        <p className="eyebrow">Findings</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Metric label="Surfaces done" value={`${surfacesComplete} / ${session.surfaces.length}`} />
          <Metric label="Total photos" value={String(totalPhotos)} />
          <Metric label="Minor defects" value={String(counts.minor)} />
          <Metric label="Moderate defects" value={String(counts.moderate)} />
          <Metric label="Severe defects" value={String(counts.severe)} />
          <Metric label="Bottom MFL" value={mflStatus} />
        </div>
      </section>
      <section className="panel space-y-3">
        <p className="eyebrow">Export data</p>
        <button type="button" className="touch-row text-left font-semibold" onClick={exportJson}>
          Export JSON package
          <span className="text-sm font-normal text-slate-600">Full session data</span>
        </button>
        <button type="button" className="touch-row text-left font-semibold" onClick={exportCsv}>
          Export defect list (CSV)
          <span className="text-sm font-normal text-slate-600">Spreadsheet-ready</span>
        </button>
      </section>
      <button type="button" className="primary-button" onClick={onSubmit}>Confirm &amp; Submit Inspection</button>
    </div>
  );
}

// ── Surface Map Renderer — picks the right map component per surface ─────────
function SurfaceMapRenderer({
  surfaceInspection,
  shellGeometry,
  roofConfig,
  annularConfig,
  selectedNozzle,
  selected,
  layers,
  defects,
  onSelect,
}: {
  surfaceInspection: SurfaceInspection;
  shellGeometry?: ShellGeometry | null;
  roofConfig?: RoofConfig | null;
  annularConfig?: AnnularConfig | null;
  selectedNozzle?: NozzleDefinition | null;
  selected: GridLocation | null;
  layers: LayerState;
  defects: DefectRecord[];
  onSelect?: (x: number, y: number) => void;
}) {
  const surf = surfaceInspection.surface;
  if (surf === "shell" && shellGeometry)
    return <ShellSurfaceMap geometry={shellGeometry} selected={selected} defects={defects} onSelect={onSelect} />;
  if (surf === "roof" && roofConfig)
    return <RoofPolarMap config={roofConfig} selected={selected} defects={defects} onSelect={onSelect} />;
  if (surf === "annular" && annularConfig)
    return <AnnularTopView config={annularConfig} selected={selected} defects={defects} onSelect={onSelect} />;
  if (surf === "nozzle" && selectedNozzle)
    return <NozzleClockMap nozzle={selectedNozzle} selected={selected} defects={defects} onSelect={onSelect} />;
  return <GridMap surfaceInspection={surfaceInspection} selected={selected} layers={layers} defects={defects} onSelect={onSelect} />;
}

// ── Roof Polar Map ────────────────────────────────────────────────────────────
function RoofPolarMap({
  config,
  selected,
  defects,
  onSelect,
}: {
  config: RoofConfig;
  selected: GridLocation | null;
  defects: DefectRecord[];
  onSelect?: (x: number, y: number) => void;
}) {
  const { sectorCount, ringCount } = config;
  const cx = 140, cy = 150, maxR = 120;
  const ringR = (ri: number) => (maxR / ringCount) * ri;           // ri=1..ringCount
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);    // 0° = top
  const sectorSpanDeg = 360 / sectorCount;

  // Build SVG arc path for a sector-ring cell
  const cellPath = (si: number, ri: number) => {
    const a1 = toRad((si - 1) * sectorSpanDeg);
    const a2 = toRad(si * sectorSpanDeg);
    const r1 = ri === 1 ? 0 : ringR(ri - 1);
    const r2 = ringR(ri);
    const large = sectorSpanDeg > 180 ? 1 : 0;
    if (ri === 1) {
      // Pie wedge from center
      return [
        `M ${cx} ${cy}`,
        `L ${cx + r2 * Math.cos(a1)} ${cy + r2 * Math.sin(a1)}`,
        `A ${r2} ${r2} 0 ${large} 1 ${cx + r2 * Math.cos(a2)} ${cy + r2 * Math.sin(a2)}`,
        "Z",
      ].join(" ");
    }
    return [
      `M ${cx + r1 * Math.cos(a1)} ${cy + r1 * Math.sin(a1)}`,
      `A ${r1} ${r1} 0 ${large} 1 ${cx + r1 * Math.cos(a2)} ${cy + r1 * Math.sin(a2)}`,
      `L ${cx + r2 * Math.cos(a2)} ${cy + r2 * Math.sin(a2)}`,
      `A ${r2} ${r2} 0 ${large} 0 ${cx + r2 * Math.cos(a1)} ${cy + r2 * Math.sin(a1)}`,
      "Z",
    ].join(" ");
  };

  const handleClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelect) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = evt.clientX - rect.left - cx;
    const my = evt.clientY - rect.top - cy;
    const dist = Math.sqrt(mx * mx + my * my);
    if (dist > maxR || dist < 1) return;
    const angle = (Math.atan2(my, mx) * 180 / Math.PI + 90 + 360) % 360;
    const si = Math.floor(angle / sectorSpanDeg) + 1;
    const ri = Math.min(ringCount, Math.floor((dist / maxR) * ringCount) + 1);
    onSelect(si, ri);
  };

  const svgW = 280, svgH = 300;
  const defectSet = new Set(defects.map((d) => `${d.location.x}-${d.location.y}`));

  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <div className="overflow-auto rounded-md bg-field p-1">
        <svg width={svgW} height={svgH} onClick={handleClick} className="block cursor-crosshair" aria-label="Roof polar map">
          {/* Cell fills */}
          {Array.from({ length: sectorCount }, (_, si) =>
            Array.from({ length: ringCount }, (_, ri) => {
              const sIdx = si + 1, rIdx = ri + 1;
              const isSelected = selected?.surface === "roof" && selected.x === sIdx && selected.y === rIdx;
              const hasDefect = defectSet.has(`${sIdx}-${rIdx}`);
              return (
                <path key={`${sIdx}-${rIdx}`} d={cellPath(sIdx, rIdx)}
                  fill={isSelected ? "#00857A" : ri % 2 === 0 ? "#E8F2EE" : "#F0F7F4"}
                  fillOpacity={isSelected ? 0.4 : 1}
                  stroke="#9BB5AE" strokeWidth="1"
                />
              );
            })
          )}
          {/* Defect dots */}
          {defects.filter((d) => d.location.surface === "roof").map((d) => {
            const si = d.location.x, ri = d.location.y;
            const a = toRad(((si - 0.5) * sectorSpanDeg));
            const r = (ringR(ri - 1) + ringR(ri)) / 2 || ringR(ri) / 2;
            return <circle key={d.id} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r="5" fill="#DC2626" opacity="0.85" />;
          })}
          {/* Selected cell overlay */}
          {selected?.surface === "roof" && (() => {
            const a = toRad(((selected.x - 0.5) * sectorSpanDeg));
            const ri = selected.y;
            const r = ri === 1 ? ringR(ri) / 2 : (ringR(ri - 1) + ringR(ri)) / 2;
            return <circle cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r="7" fill="none" stroke="#00857A" strokeWidth="2.5" />;
          })()}
          {/* Ring labels (radius) */}
          {Array.from({ length: ringCount }, (_, ri) => {
            const r = ringR(ri + 1);
            return (
              <g key={ri}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke="#9BB5AE" strokeWidth={ri === ringCount - 1 ? 2 : 1} />
                <text x={cx + r - 4} y={cy - 4} textAnchor="end" fontSize="8" fill="#52625E">R{ri + 1}</text>
              </g>
            );
          })}
          {/* Sector lines + azimuth labels */}
          {Array.from({ length: sectorCount }, (_, si) => {
            const deg = si * sectorSpanDeg;
            const rad = toRad(deg);
            const lx = cx + (maxR + 14) * Math.cos(rad);
            const ly = cy + (maxR + 14) * Math.sin(rad);
            return (
              <g key={si}>
                <line x1={cx} y1={cy} x2={cx + maxR * Math.cos(rad)} y2={cy + maxR * Math.sin(rad)} stroke="#9BB5AE" strokeWidth="1" />
                <text x={lx} y={ly + 3} textAnchor="middle" fontSize="8" fill="#52625E">{deg}°</text>
              </g>
            );
          })}
          {/* 0° reference line (bold) */}
          <line x1={cx} y1={cy} x2={cx} y2={cy - maxR} stroke="#075F5C" strokeWidth="2" />
          <text x={cx} y={cy - maxR - 6} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#075F5C">0°</text>
          {/* Center dot (apex) */}
          <circle cx={cx} cy={cy} r="4" fill="#075F5C" />
          <text x={cx} y={cy + 14} textAnchor="middle" fontSize="8" fill="#52625E">apex</text>
        </svg>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-danger" /> Defect</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 border-2 border-teal rounded-full" /> Selected</span>
        <span className="text-slate-400">R1=apex · R{ringCount}=outer edge</span>
      </div>
    </section>
  );
}

// ── Annular Top View ──────────────────────────────────────────────────────────
function AnnularTopView({
  config,
  selected,
  defects,
  onSelect,
}: {
  config: AnnularConfig;
  selected: GridLocation | null;
  defects: DefectRecord[];
  onSelect?: (x: number, y: number) => void;
}) {
  const ZONES = 36;          // 10° per zone
  const cx = 140, cy = 140;
  const outerR = 110, innerR = 76;
  const zoneSpanDeg = 360 / ZONES;
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);

  const zonePath = (zi: number) => {
    const a1 = toRad((zi - 1) * zoneSpanDeg);
    const a2 = toRad(zi * zoneSpanDeg);
    return [
      `M ${cx + innerR * Math.cos(a1)} ${cy + innerR * Math.sin(a1)}`,
      `A ${innerR} ${innerR} 0 0 1 ${cx + innerR * Math.cos(a2)} ${cy + innerR * Math.sin(a2)}`,
      `L ${cx + outerR * Math.cos(a2)} ${cy + outerR * Math.sin(a2)}`,
      `A ${outerR} ${outerR} 0 0 0 ${cx + outerR * Math.cos(a1)} ${cy + outerR * Math.sin(a1)}`,
      "Z",
    ].join(" ");
  };

  const handleClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelect) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = evt.clientX - rect.left - cx;
    const my = evt.clientY - rect.top - cy;
    const dist = Math.sqrt(mx * mx + my * my);
    if (dist < innerR || dist > outerR) return;
    const angle = (Math.atan2(my, mx) * 180 / Math.PI + 90 + 360) % 360;
    const zi = Math.floor(angle / zoneSpanDeg) + 1;
    onSelect(zi, 1);
  };

  const defectSet = new Set(defects.filter((d) => d.location.surface === "annular").map((d) => d.location.x));
  const midR = (innerR + outerR) / 2;

  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <p className="text-xs text-slate-500 mb-2">Top view — tap the annular band to select a 10° zone</p>
      <div className="overflow-auto rounded-md bg-field p-1 flex justify-center">
        <svg width="280" height="280" onClick={handleClick} className="block cursor-crosshair" aria-label="Annular ring top view">
          {/* Zone fills */}
          {Array.from({ length: ZONES }, (_, zi) => {
            const zIdx = zi + 1;
            const isSelected = selected?.surface === "annular" && selected.x === zIdx;
            const hasDefect = defectSet.has(zIdx);
            return (
              <path key={zIdx} d={zonePath(zIdx)}
                fill={isSelected ? "#00857A" : hasDefect ? "#FEE2E2" : zi % 2 === 0 ? "#DCF3EE" : "#E8F2EE"}
                fillOpacity={isSelected ? 0.5 : 1}
                stroke="#9BB5AE" strokeWidth="0.8"
              />
            );
          })}
          {/* Defect dots */}
          {defects.filter((d) => d.location.surface === "annular").map((d) => {
            const rad = toRad((d.location.x - 0.5) * zoneSpanDeg);
            return <circle key={d.id} cx={cx + midR * Math.cos(rad)} cy={cy + midR * Math.sin(rad)} r="5" fill="#DC2626" opacity="0.85" />;
          })}
          {/* Tank floor (inner) */}
          <circle cx={cx} cy={cy} r={innerR} fill="#EAF3EF" stroke="#9BB5AE" strokeWidth="1.5" />
          <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fill="#52625E">floor</text>
          {/* Shell wall (outer) */}
          <circle cx={cx} cy={cy} r={outerR + 6} fill="none" stroke="#CBD8D4" strokeWidth="5" />
          {/* Azimuth labels at 0°/90°/180°/270° */}
          {[0, 90, 180, 270].map((deg) => {
            const rad = toRad(deg);
            const lx = cx + (outerR + 20) * Math.cos(rad);
            const ly = cy + (outerR + 20) * Math.sin(rad);
            return <text key={deg} x={lx} y={ly + 4} textAnchor="middle" fontSize="9" fontWeight="bold" fill="#075F5C">{deg}°</text>;
          })}
          {/* 0° reference tick */}
          <line x1={cx} y1={cy - innerR} x2={cx} y2={cy - outerR - 8} stroke="#075F5C" strokeWidth="2" />
          {/* Annular width label */}
          <text x={cx + outerR + 10} y={cy - 3} textAnchor="start" fontSize="8" fill="#52625E">{config.widthMm}mm</text>
        </svg>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-danger" /> Defect</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 bg-teal opacity-50 rounded" /> Selected zone</span>
        <span className="text-slate-400">36 zones × 10°</span>
      </div>
    </section>
  );
}

// ── Nozzle Clock Map ──────────────────────────────────────────────────────────
function NozzleClockMap({
  nozzle,
  selected,
  defects,
  onSelect,
}: {
  nozzle: NozzleDefinition;
  selected: GridLocation | null;
  defects: DefectRecord[];
  onSelect?: (x: number, y: number) => void;
}) {
  const CLOCK_COUNT = 12;
  const RINGS = 3;
  const RING_MM = [50, 100, 150];      // outer radius in mm per ring
  const CLOCK_LABELS = ["12","1","2","3","4","5","6","7","8","9","10","11"];
  const cx = 140, cy = 145;
  const ringPx = [40, 76, 112];        // pixel radii for the 3 rings
  const toRad = (deg: number) => (deg - 90) * (Math.PI / 180);
  const clockSpanDeg = 360 / CLOCK_COUNT;  // 30°

  const cellPath = (ci: number, ri: number) => {
    const a1 = toRad((ci - 1) * clockSpanDeg);
    const a2 = toRad(ci * clockSpanDeg);
    const r1 = ri === 1 ? 0 : ringPx[ri - 2];
    const r2 = ringPx[ri - 1];
    if (ri === 1) {
      return [
        `M ${cx} ${cy}`,
        `L ${cx + r2 * Math.cos(a1)} ${cy + r2 * Math.sin(a1)}`,
        `A ${r2} ${r2} 0 0 1 ${cx + r2 * Math.cos(a2)} ${cy + r2 * Math.sin(a2)}`,
        "Z",
      ].join(" ");
    }
    return [
      `M ${cx + r1 * Math.cos(a1)} ${cy + r1 * Math.sin(a1)}`,
      `A ${r1} ${r1} 0 0 1 ${cx + r1 * Math.cos(a2)} ${cy + r1 * Math.sin(a2)}`,
      `L ${cx + r2 * Math.cos(a2)} ${cy + r2 * Math.sin(a2)}`,
      `A ${r2} ${r2} 0 0 0 ${cx + r2 * Math.cos(a1)} ${cy + r2 * Math.sin(a1)}`,
      "Z",
    ].join(" ");
  };

  const handleClick = (evt: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelect) return;
    const rect = evt.currentTarget.getBoundingClientRect();
    const mx = evt.clientX - rect.left - cx;
    const my = evt.clientY - rect.top - cy;
    const dist = Math.sqrt(mx * mx + my * my);
    if (dist > ringPx[RINGS - 1] || dist < 2) return;
    const angle = (Math.atan2(my, mx) * 180 / Math.PI + 90 + 360) % 360;
    const ci = Math.floor(angle / clockSpanDeg) + 1;
    const ri = ringPx.findIndex((r) => dist <= r) + 1;
    if (ri < 1) return;
    onSelect(ci, ri);
  };

  const defectKey = (d: DefectRecord) => `${d.location.x}-${d.location.y}`;
  const defectSet = new Set(defects.filter((d) => d.location.surface === "nozzle" && d.location.plateId === nozzle.id).map(defectKey));

  return (
    <section className="rounded-md border border-line bg-panel p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-600">{nozzle.id} — {nozzle.nozzleType} · {nozzle.azimuthDeg}° · Ø{nozzle.diameterMm} mm</span>
        <span className="text-xs text-slate-400">12 pos × 3 rings</span>
      </div>
      <div className="overflow-auto rounded-md bg-field p-1 flex justify-center">
        <svg width="280" height="290" onClick={handleClick} className="block cursor-crosshair" aria-label="Nozzle clock map">
          {/* Cell fills */}
          {Array.from({ length: CLOCK_COUNT }, (_, ci) =>
            Array.from({ length: RINGS }, (_, ri) => {
              const cIdx = ci + 1, rIdx = ri + 1;
              const isSelected = selected?.surface === "nozzle" && selected.x === cIdx && selected.y === rIdx;
              const hasDefect = defectSet.has(`${cIdx}-${rIdx}`);
              return (
                <path key={`${cIdx}-${rIdx}`} d={cellPath(cIdx, rIdx)}
                  fill={isSelected ? "#00857A" : hasDefect ? "#FEE2E2" : ri % 2 === 0 ? "#E8F2EE" : "#F0F7F4"}
                  fillOpacity={isSelected ? 0.45 : 1}
                  stroke="#9BB5AE" strokeWidth="1"
                />
              );
            })
          )}
          {/* Defect dots */}
          {defects.filter((d) => d.location.surface === "nozzle" && d.location.plateId === nozzle.id).map((d) => {
            const ci = d.location.x, ri = d.location.y;
            const a = toRad((ci - 0.5) * clockSpanDeg);
            const r = ri === 1 ? ringPx[0] / 2 : (ringPx[ri - 2] + ringPx[ri - 1]) / 2;
            return <circle key={d.id} cx={cx + r * Math.cos(a)} cy={cy + r * Math.sin(a)} r="5" fill="#DC2626" opacity="0.85" />;
          })}
          {/* Ring circles */}
          {ringPx.map((r, ri) => (
            <g key={ri}>
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#9BB5AE" strokeWidth={ri === RINGS - 1 ? 2 : 1} />
              <text x={cx + r - 2} y={cy - 3} textAnchor="end" fontSize="8" fill="#52625E">{RING_MM[ri]}mm</text>
            </g>
          ))}
          {/* Clock position lines + labels */}
          {Array.from({ length: CLOCK_COUNT }, (_, ci) => {
            const deg = ci * clockSpanDeg;
            const rad = toRad(deg);
            const lx = cx + (ringPx[RINGS - 1] + 16) * Math.cos(rad);
            const ly = cy + (ringPx[RINGS - 1] + 16) * Math.sin(rad);
            return (
              <g key={ci}>
                <line x1={cx} y1={cy} x2={cx + ringPx[RINGS - 1] * Math.cos(rad)} y2={cy + ringPx[RINGS - 1] * Math.sin(rad)} stroke="#9BB5AE" strokeWidth="1" />
                <text x={lx} y={ly + 4} textAnchor="middle" fontSize="9" fontWeight={ci === 0 ? "bold" : "normal"} fill={ci === 0 ? "#075F5C" : "#52625E"}>{CLOCK_LABELS[ci]}</text>
              </g>
            );
          })}
          {/* 12 o'clock reference bold */}
          <line x1={cx} y1={cy} x2={cx} y2={cy - ringPx[RINGS - 1]} stroke="#075F5C" strokeWidth="2" />
          {/* Nozzle CL */}
          <circle cx={cx} cy={cy} r="5" fill="#075F5C" />
          <text x={cx} y={cy + 18} textAnchor="middle" fontSize="8" fill="#52625E">nozzle CL</text>
          {/* Nozzle bore circle (visual) */}
          <circle cx={cx} cy={cy} r={Math.min(28, nozzle.diameterMm / 8)} fill="none" stroke="#9BB5AE" strokeWidth="1.5" strokeDasharray="3,2" />
        </svg>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-danger" /> Defect</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 bg-teal opacity-50 rounded" /> Selected</span>
        <span className="text-slate-400">12 = top · clockwise · R1 innermost</span>
      </div>
    </section>
  );
}

// ── Shell Setup Screen ────────────────────────────────────────────────────────
function ShellSetupScreen({
  session,
  setSession,
  onContinue,
  onBack,
}: {
  session: InspectionSession;
  setSession: React.Dispatch<React.SetStateAction<InspectionSession>>;
  onContinue: () => void;
  onBack: () => void;
}) {
  const sc = session.shellConfig;
  const p = session.tankProfile;
  const [numCourses, setNumCourses] = useState(String(sc?.numCourses ?? "8"));
  const [plateWidthMm, setPlateWidthMm] = useState(String(sc?.plateWidthMm ?? "1800"));
  const [seamOriginC1Deg, setSeamOriginC1Deg] = useState(String(sc?.seamOriginC1Deg ?? "0"));
  const [seamOffsetRule, setSeamOffsetRule] = useState<SeamOffsetRule>(sc?.seamOffsetRule ?? "half_plate");
  const [customOffsetDeg, setCustomOffsetDeg] = useState(String(sc?.customOffsetDeg ?? ""));

  const courseCount = Number(numCourses) || 0;
  const plateW = Number(plateWidthMm) || 1800;
  const diameterM = p?.diameterM ?? 0;
  const heightM = p?.heightM ?? 0;
  const totalHeightMm = Math.round(heightM * 1000);
  const stdCourseHeightMm = courseCount > 0 ? Math.floor(totalHeightMm / courseCount) : 0;
  const topCourseHeightMm = courseCount > 0 ? totalHeightMm - stdCourseHeightMm * (courseCount - 1) : 0;
  const circumferenceMm = diameterM * Math.PI * 1000;
  const platesPerCourse = circumferenceMm > 0 ? Math.floor(circumferenceMm / plateW) : 0;
  const closurePlateWidthMm = platesPerCourse > 0 ? Math.round(circumferenceMm - platesPerCourse * plateW) : 0;
  const plateSpanDeg = platesPerCourse > 0 ? 360 / platesPerCourse : 0;
  const stepDeg =
    seamOffsetRule === "half_plate" ? plateSpanDeg / 2
    : seamOffsetRule === "third_plate" ? plateSpanDeg / 3
    : Number(customOffsetDeg) || 0;
  const c1 = Number(seamOriginC1Deg) || 0;
  const courseSeamOrigins = Array.from({ length: Math.min(courseCount, 12) }, (_, i) =>
    courseSeamOrigin(i, c1, stepDeg, seamOffsetRule).toFixed(1)
  );
  const valid = courseCount > 0 && platesPerCourse > 0;

  const save = () => {
    setSession((cur) => ({
      ...cur,
      syncStatus: "pending_sync",
      shellConfig: {
        numCourses: courseCount,
        plateWidthMm: plateW,
        plateLengthMm: stdCourseHeightMm,
        seamOriginC1Deg: c1,
        seamOffsetRule,
        customOffsetDeg: seamOffsetRule === "custom" ? (Number(customOffsetDeg) || null) : null,
      },
    }));
  };

  const isEdit = Boolean(sc);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Shell Setup" subtitle={isEdit ? "Review or update shell geometry — changes apply immediately to the map." : "Define course and plate geometry before inspection."} />
      {isEdit && (
        <section className="rounded-md border border-teal bg-mint p-3 text-sm text-tealDark">
          Shell already configured — review values below and tap Continue to proceed to the map.
        </section>
      )}
      {p && (
        <section className="rounded-md border border-line bg-field p-3 text-sm">
          <p className="font-semibold">Tank: {diameterM} m dia · {heightM} m high</p>
          <p className="text-xs text-slate-500 mt-1">Circumference: {(circumferenceMm / 1000).toFixed(2)} m</p>
        </section>
      )}
      <section className="panel space-y-3">
        <p className="eyebrow">Course geometry</p>
        <NumberField label="Number of shell courses" value={courseCount || null} onChange={setNumCourses} />
        <NumberField label="Standard plate width — circumferential (mm)" value={plateW || null} onChange={setPlateWidthMm} />
        <p className="text-xs text-slate-500">API 650 minimum: 1 800 mm. Enter the mill width from the drawing.</p>
        {courseCount > 0 && (
          <div className="rounded-md border border-line bg-field p-3 space-y-2 text-sm">
            <p className="font-semibold text-xs uppercase tracking-wide text-slate-500">Derived layout</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-slate-500">Standard course height</p>
                <p className="font-semibold text-tealDark">{stdCourseHeightMm} mm</p>
                <p className="text-xs text-slate-400">{totalHeightMm} ÷ {courseCount}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Top course height</p>
                <p className={`font-semibold ${topCourseHeightMm !== stdCourseHeightMm ? "text-caution" : "text-tealDark"}`}>{topCourseHeightMm} mm</p>
                <p className="text-xs text-slate-400">{topCourseHeightMm !== stdCourseHeightMm ? "remainder" : "same as others"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Plates per course</p>
                <p className="font-semibold text-tealDark">{platesPerCourse > 0 ? `${platesPerCourse} + 1 closure` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Closure plate width</p>
                <p className="font-semibold text-tealDark">{closurePlateWidthMm > 0 ? `${closurePlateWidthMm} mm` : "—"}</p>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="panel space-y-3">
        <p className="eyebrow">Seam layout</p>
        <p className="text-xs text-slate-500">Vertical seams stagger between adjacent courses. Enter C1 seam azimuth from drawing.</p>
        <NumberField label="Course 1 — first vertical seam azimuth (°)" value={c1 || null} onChange={setSeamOriginC1Deg} />
        <div>
          <p className="mb-2 text-sm font-semibold">Seam offset rule</p>
          <div className="grid grid-cols-3 gap-2">
            {(["half_plate", "third_plate", "custom"] as SeamOffsetRule[]).map((rule) => (
              <button key={rule} type="button"
                className={`min-h-11 rounded-md border px-2 text-xs font-semibold ${seamOffsetRule === rule ? "border-teal bg-mint text-tealDark" : "border-line bg-field text-slate-700"}`}
                onClick={() => setSeamOffsetRule(rule)}
              >
                {rule === "half_plate" ? "½ plate" : rule === "third_plate" ? "⅓ plate" : "Custom"}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {seamOffsetRule === "half_plate"
              ? `2-course repeat: C1/C3/C5 at origin, C2/C4/C6 shifted +${stepDeg.toFixed(1)}°. C1 and C3 align.`
              : seamOffsetRule === "third_plate"
              ? `3-course repeat: C1=0°, C2=+${stepDeg.toFixed(1)}°, C3=+${(stepDeg * 2).toFixed(1)}°, C4=0° again.`
              : "Cumulative: each course adds a fixed step to the one below."}
          </p>
        </div>
        {seamOffsetRule === "custom" && (
          <NumberField label="Custom offset per course (°)" value={Number(customOffsetDeg) || null} onChange={setCustomOffsetDeg} />
        )}
        {courseCount > 0 && platesPerCourse > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">Course table</p>
            <div className="grid gap-1">
              {courseSeamOrigins.map((deg, i) => {
                const isTop = i === courseCount - 1;
                const courseH = isTop ? topCourseHeightMm : stdCourseHeightMm;
                const zStartActual = i === 0 ? 0 : stdCourseHeightMm * i;
                return (
                  <div key={i} className="flex items-center justify-between rounded-md bg-field px-3 py-2 text-sm">
                    <div>
                      <span className="font-semibold">C{i + 1}</span>
                      <span className="ml-2 text-xs text-slate-500">{zStartActual}–{zStartActual + courseH} mm</span>
                      {isTop && topCourseHeightMm !== stdCourseHeightMm && <span className="ml-1 text-xs text-caution">top</span>}
                    </div>
                    <span className="font-mono text-tealDark">seam {deg}°</span>
                  </div>
                );
              })}
              {courseCount > 12 && <p className="text-xs text-slate-500 pl-1">…{courseCount - 12} more courses follow the same pattern</p>}
            </div>
          </div>
        )}
      </section>

      <div className="action-stack">
        <button type="button" className="primary-button" disabled={!valid} onClick={() => { save(); onContinue(); }}>{isEdit ? "Save & Continue" : "Start Shell Inspection"}</button>
        <button type="button" className="secondary-button" onClick={() => { save(); onBack(); }}>Save & Back</button>
      </div>
    </div>
  );
}

// ── Roof Setup Screen ─────────────────────────────────────────────────────────
function RoofSetupScreen({
  session,
  setSession,
  onContinue,
  onBack,
}: {
  session: InspectionSession;
  setSession: React.Dispatch<React.SetStateAction<InspectionSession>>;
  onContinue: () => void;
  onBack: () => void;
}) {
  const rc = session.roofConfig;
  const roofType = session.tankProfile?.roofType ?? "cone";
  const isFloating = roofType.includes("floating");
  const [sectorCount, setSectorCount] = useState(String(rc?.sectorCount ?? "12"));
  const [ringCount, setRingCount] = useState(String(rc?.ringCount ?? "5"));
  const [apexHeightM, setApexHeightM] = useState(String(rc?.apexHeightM ?? ""));
  const valid = Number(sectorCount) >= 4 && Number(ringCount) >= 2;

  const save = () => {
    setSession((cur) => ({
      ...cur,
      syncStatus: "pending_sync",
      roofConfig: {
        sectorCount: Number(sectorCount),
        ringCount: Number(ringCount),
        apexHeightM: apexHeightM ? Number(apexHeightM) : null,
      },
    }));
  };

  const sc = Number(sectorCount) || 12;
  const rc2 = Number(ringCount) || 5;
  const cx = 80, cy = 80, maxR = 68;

  const isEditRoof = Boolean(rc);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Roof Setup" subtitle={`${roofType.replace(/_/g, " ")} — polar sector grid`} />
      {isEditRoof && (
        <section className="rounded-md border border-teal bg-mint p-3 text-sm text-tealDark">
          Roof already configured — review values below and tap Continue to proceed to the map.
        </section>
      )}
      <section className="panel space-y-3">
        <p className="eyebrow">Grid divisions</p>
        <NumberField label="Radial sectors (angular divisions)" value={Number(sectorCount) || null} onChange={setSectorCount} />
        <p className="text-xs text-slate-500">Typical: 8 sectors for small tanks, 12–16 for large. Each sector = {sc > 0 ? (360 / sc).toFixed(1) : "—"}°</p>
        <NumberField label="Concentric rings (radial zones)" value={Number(ringCount) || null} onChange={setRingCount} />
        <p className="text-xs text-slate-500">Typical: 4–6 rings. Ring 1 = near apex, Ring {rc2} = outer edge.</p>
        {!isFloating && (
          <NumberField label="Apex height above shell top (m) — optional" value={apexHeightM ? Number(apexHeightM) : null} onChange={setApexHeightM} />
        )}
      </section>
      <section className="panel">
        <p className="eyebrow">Roof map preview</p>
        <div className="flex justify-center py-2">
          <svg width="160" height="160" viewBox="0 0 160 160" aria-label="Roof polar grid preview">
            {Array.from({ length: rc2 }, (_, ri) => (
              <circle key={ri} cx={cx} cy={cy} r={(maxR / rc2) * (ri + 1)} fill="none" stroke="#9BB5AE" strokeWidth="1" strokeDasharray={ri === rc2 - 1 ? "none" : "3,2"} />
            ))}
            {Array.from({ length: sc }, (_, si) => {
              const angle = (si / sc) * Math.PI * 2 - Math.PI / 2;
              return <line key={si} x1={cx} y1={cy} x2={cx + maxR * Math.cos(angle)} y2={cy + maxR * Math.sin(angle)} stroke="#9BB5AE" strokeWidth="1" />;
            })}
            <circle cx={cx} cy={cy} r="4" fill="#075F5C" />
            <line x1={cx} y1={cy - maxR - 4} x2={cx} y2={cy - maxR + 4} stroke="#075F5C" strokeWidth="2" />
            <text x={cx} y={cy - maxR - 7} textAnchor="middle" fontSize="9" fill="#075F5C">0°</text>
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="7" fill="#52625E">apex</text>
          </svg>
        </div>
        <p className="mt-1 text-center text-xs text-slate-500">{sc} sectors × {rc2} rings = {sc * rc2} zones</p>
      </section>
      <div className="action-stack">
        <button type="button" className="primary-button" disabled={!valid} onClick={() => { save(); onContinue(); }}>{isEditRoof ? "Save & Continue" : "Start Roof Inspection"}</button>
        <button type="button" className="secondary-button" onClick={() => { save(); onBack(); }}>Save & Back</button>
      </div>
    </div>
  );
}

// ── Annular Setup Screen ──────────────────────────────────────────────────────
function AnnularSetupScreen({
  session,
  setSession,
  onContinue,
  onBack,
}: {
  session: InspectionSession;
  setSession: React.Dispatch<React.SetStateAction<InspectionSession>>;
  onContinue: () => void;
  onBack: () => void;
}) {
  const ac = session.annularConfig;
  const p = session.tankProfile;
  const [widthMm, setWidthMm] = useState(String(ac?.widthMm ?? "700"));
  const valid = Number(widthMm) >= 100;
  const tankR = 75;
  const annularW = Math.max(8, Math.min(28, (Number(widthMm) || 700) / 50));
  const cx = 85, cy = 85;

  const save = () => {
    setSession((cur) => ({
      ...cur,
      syncStatus: "pending_sync",
      annularConfig: { widthMm: Number(widthMm) },
    }));
  };

  const isEditAnnular = Boolean(ac);

  return (
    <div className="space-y-4">
      <ScreenTitle title="Annular Ring Setup" subtitle="Circumferential band at the shell-to-bottom junction." />
      {isEditAnnular && (
        <section className="rounded-md border border-teal bg-mint p-3 text-sm text-tealDark">
          Annular ring already configured — review and tap Continue to proceed to the map.
        </section>
      )}
      <section className="panel space-y-3">
        <p className="eyebrow">Ring geometry</p>
        <NumberField label="Annular ring width (mm) — inward from shell" value={Number(widthMm) || null} onChange={setWidthMm} />
        <p className="text-xs text-slate-500">API 650 §5.5: minimum 600 mm for tanks ≥ 30 m diameter. Typically 600–900 mm.</p>
        {p && <p className="text-xs text-tealDark">Tank diameter: {p.diameterM} m → outer circumference: {(p.diameterM * Math.PI).toFixed(1)} m</p>}
      </section>
      <section className="panel">
        <p className="eyebrow">Top view preview</p>
        <p className="text-xs text-slate-500 mb-2">Teal band = annular inspection zone. Defects are located by azimuth (0°–360°).</p>
        <div className="flex justify-center py-2">
          <svg width="170" height="170" viewBox="0 0 170 170" aria-label="Annular ring top view">
            {/* Tank floor (inner) */}
            <circle cx={cx} cy={cy} r={tankR - annularW} fill="#DCF3EE" stroke="#9BB5AE" strokeWidth="1" />
            {/* Annular band */}
            <circle cx={cx} cy={cy} r={tankR} fill="none" stroke="#00857A" strokeWidth={annularW * 2} strokeOpacity="0.25" />
            <circle cx={cx} cy={cy} r={tankR} fill="none" stroke="#00857A" strokeWidth="2" />
            <circle cx={cx} cy={cy} r={tankR - annularW * 2} fill="none" stroke="#00857A" strokeWidth="1.5" strokeDasharray="4,3" />
            {/* Shell (outer circle) */}
            <circle cx={cx} cy={cy} r={tankR + 6} fill="none" stroke="#CBD8D4" strokeWidth="4" />
            {/* 0° reference */}
            <line x1={cx} y1={cy - tankR - 10} x2={cx} y2={cy - tankR + annularW} stroke="#075F5C" strokeWidth="1.5" strokeDasharray="3,2" />
            <text x={cx + 4} y={cy - tankR - 12} fontSize="9" fill="#075F5C">0°</text>
            {/* Azimuth ticks */}
            {[90, 180, 270].map((deg) => {
              const rad = (deg - 90) * Math.PI / 180;
              const r1 = tankR + 6, r2 = tankR + 14;
              return (
                <g key={deg}>
                  <line x1={cx + r1 * Math.cos(rad)} y1={cy + r1 * Math.sin(rad)} x2={cx + r2 * Math.cos(rad)} y2={cy + r2 * Math.sin(rad)} stroke="#94A3A0" strokeWidth="1" />
                  <text x={cx + (r2 + 6) * Math.cos(rad)} y={cy + (r2 + 6) * Math.sin(rad)} textAnchor="middle" fontSize="8" fill="#52625E">{deg}°</text>
                </g>
              );
            })}
            <text x={cx} y={cy + 4} textAnchor="middle" fontSize="8" fill="#52625E">floor</text>
          </svg>
        </div>
        <p className="mt-1 text-center text-xs text-slate-500">Width shown: {widthMm} mm</p>
      </section>
      <div className="action-stack">
        <button type="button" className="primary-button" disabled={!valid} onClick={() => { save(); onContinue(); }}>{isEditAnnular ? "Save & Continue" : "Start Annular Inspection"}</button>
        <button type="button" className="secondary-button" onClick={() => { save(); onBack(); }}>Save & Back</button>
      </div>
    </div>
  );
}

// ── Nozzle Setup Screen ───────────────────────────────────────────────────────
function NozzleSetupScreen({
  session,
  setSession,
  onContinue,
  onBack,
}: {
  session: InspectionSession;
  setSession: React.Dispatch<React.SetStateAction<InspectionSession>>;
  onContinue: () => void;
  onBack: () => void;
}) {
  const existing = session.nozzleConfig?.nozzles ?? [];
  const [nozzles, setNozzles] = useState<NozzleDefinition[]>(existing);
  const [editId, setEditId] = useState("");
  const [editType, setEditType] = useState<NozzleType>("inlet");
  const [editAzimuth, setEditAzimuth] = useState("");
  const [editElevMm, setEditElevMm] = useState("");
  const [editDiaMm, setEditDiaMm] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [adding, setAdding] = useState(false);

  const resetForm = () => { setEditId(""); setEditType("inlet"); setEditAzimuth(""); setEditElevMm(""); setEditDiaMm(""); setEditDesc(""); };

  const addNozzle = () => {
    if (!editId || !editAzimuth || !editElevMm || !editDiaMm) return;
    const nozzle: NozzleDefinition = {
      id: editId.toUpperCase(),
      nozzleType: editType,
      azimuthDeg: Number(editAzimuth),
      elevationMm: Number(editElevMm),
      diameterMm: Number(editDiaMm),
      description: editDesc || null,
    };
    setNozzles((cur) => [...cur.filter((n) => n.id !== nozzle.id), nozzle].sort((a, b) => a.id.localeCompare(b.id)));
    resetForm();
    setAdding(false);
  };

  const save = () => {
    setSession((cur) => ({
      ...cur,
      syncStatus: "pending_sync",
      nozzleConfig: { nozzles },
    }));
  };

  return (
    <div className="space-y-4">
      <ScreenTitle title="Nozzle Registry" subtitle="Register all nozzles and manways before inspection." />
      <section className="panel space-y-2">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Nozzles ({nozzles.length})</p>
          <button type="button" className="rounded-md border border-teal bg-mint px-3 py-1 text-xs font-semibold text-tealDark" onClick={() => { resetForm(); setAdding(true); }}>+ Add</button>
        </div>
        {nozzles.length === 0 && !adding && (
          <p className="text-sm text-slate-500">No nozzles registered. Tap + Add to begin.</p>
        )}
        {nozzles.map((n) => (
          <div key={n.id} className="flex items-center justify-between rounded-md bg-field px-3 py-2 text-sm">
            <div>
              <span className="font-semibold">{n.id}</span>
              <span className="ml-2 text-xs text-slate-500">{n.nozzleType} · {n.azimuthDeg}° · {n.elevationMm} mm · Ø{n.diameterMm} mm</span>
            </div>
            <button type="button" className="text-xs text-danger font-semibold" onClick={() => setNozzles((cur) => cur.filter((x) => x.id !== n.id))}>Remove</button>
          </div>
        ))}
        {adding && (
          <div className="rounded-md border border-teal bg-mint p-3 space-y-2">
            <p className="text-sm font-semibold text-tealDark">New nozzle</p>
            <div className="grid grid-cols-2 gap-2">
              <Field label="ID (e.g. N1, M1)" value={editId} onChange={setEditId} />
              <label className="field-label">
                Type
                <select className="field-input" value={editType} onChange={(e) => setEditType(e.target.value as NozzleType)}>
                  {(["inlet","outlet","vent","drain","manway","instrument","other"] as NozzleType[]).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <NumberField label="Azimuth (°)" value={editAzimuth ? Number(editAzimuth) : null} onChange={setEditAzimuth} />
              <NumberField label="Elevation from datum (mm)" value={editElevMm ? Number(editElevMm) : null} onChange={setEditElevMm} />
            </div>
            <NumberField label="Nominal bore diameter (mm)" value={editDiaMm ? Number(editDiaMm) : null} onChange={setEditDiaMm} />
            <Field label="Description (optional)" value={editDesc} onChange={setEditDesc} />
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="secondary-button" onClick={() => { resetForm(); setAdding(false); }}>Cancel</button>
              <button type="button" className="primary-button" disabled={!editId || !editAzimuth || !editElevMm || !editDiaMm} onClick={addNozzle}>Add</button>
            </div>
          </div>
        )}
      </section>
      <div className="action-stack">
        <button type="button" className="primary-button" disabled={nozzles.length === 0} onClick={() => { save(); onContinue(); }}>Continue to Nozzle List</button>
        <button type="button" className="secondary-button" onClick={() => { save(); onBack(); }}>Save & Back</button>
      </div>
    </div>
  );
}

// ── Nozzle List Screen ────────────────────────────────────────────────────────
function NozzleListScreen({
  session,
  onSetup,
  onBack,
  onSelectNozzle,
}: {
  session: InspectionSession;
  onSetup: () => void;
  onBack: () => void;
  onSelectNozzle: (nozzle: NozzleDefinition) => void;
}) {
  const nozzles = session.nozzleConfig?.nozzles ?? [];
  const allDefects = session.surfaces.find((s) => s.surface === "nozzle")?.defects ?? [];

  return (
    <div className="space-y-4">
      <InspectionHeader session={session} />
      <ScreenTitle title="Nozzle Inspection" subtitle="Select a nozzle to inspect. Location will be recorded as azimuth around nozzle CL." />
      {nozzles.length === 0 ? (
        <section className="panel">
          <p className="text-sm text-slate-500">No nozzles registered. Set up the nozzle registry first.</p>
          <button type="button" className="mt-3 primary-button" onClick={onSetup}>Go to Nozzle Setup</button>
        </section>
      ) : (
        <div className="grid gap-3">
          {nozzles.map((n) => {
            const defectCount = allDefects.filter((d) => d.location.plateId === n.id).length;
            return (
              <button key={n.id} type="button" className="touch-row text-left" onClick={() => onSelectNozzle(n)}>
                <div>
                  <p className="font-semibold">{n.id} — {n.nozzleType}</p>
                  <p className="mt-1 text-xs text-slate-500">{n.azimuthDeg}° · {n.elevationMm} mm · Ø{n.diameterMm} mm{n.description ? ` · ${n.description}` : ""}</p>
                </div>
                <span className={`rounded-md px-2 py-1 text-xs font-semibold ${defectCount ? "bg-red-100 text-danger" : "bg-field text-slate-700"}`}>
                  {defectCount ? `${defectCount} defect${defectCount > 1 ? "s" : ""}` : "Not started"}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <div className="action-stack">
        <button type="button" className="secondary-button" onClick={onSetup}>Edit Nozzle Registry</button>
        <button type="button" className="secondary-button" onClick={onBack}>Back to Overview</button>
      </div>
    </div>
  );
}

export default App;
