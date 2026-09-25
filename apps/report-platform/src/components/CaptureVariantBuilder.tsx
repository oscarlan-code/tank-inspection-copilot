import { useEffect, useMemo, useState } from "react";
import {
  generateCaptureVariants,
  loadCaptureVariant,
  loadCaptureVariantBuilder,
  runPendingCaptureVariantRoundTrips,
  type CaptureVariantBuilderState,
  type CaptureVariantDetail,
  type CaptureVariantFactLink,
  type CaptureVariantSummary,
} from "../lib/captureVariantApi";

export function CaptureVariantBuilder({
  initialTruthCaseId = "",
  onBack,
  onContinue,
}: {
  initialTruthCaseId?: string;
  onBack?: () => void;
  onContinue?: () => void;
}) {
  const [state, setState] = useState<CaptureVariantBuilderState | null>(null);
  const [detail, setDetail] = useState<CaptureVariantDetail | null>(null);
  const [truthCaseId, setTruthCaseId] = useState(initialTruthCaseId);
  const [selectedProfiles, setSelectedProfiles] = useState<string[]>([]);
  const [variantCount, setVariantCount] = useState(2);
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedTruthCase = state?.truthCases.find((item) => item.truthCaseId === truthCaseId) ?? null;
  const variants = useMemo(
    () => (state?.variants ?? []).filter((item) => (
      (!truthCaseId || item.truthCaseId === truthCaseId)
      && selectedProfiles.includes(item.profileCode)
      && item.deterministicSeed <= variantCount
    )),
    [selectedProfiles, state, truthCaseId, variantCount],
  );
  const generatedCount = selectedProfiles.reduce(
    (total, code) => total + variants.filter((variant) => variant.profileCode === code).length,
    0,
  );
  const passedCount = variants.filter((variant) => ["approved", "round_trip_ready", "materialized"].includes(variant.status)).length;
  const attentionCount = variants.filter((variant) => ["review_required", "failed", "rejected", "quarantined"].includes(variant.status)).length;
  const materializedCount = variants.filter((variant) => variant.appRoundTripStatus === "materialized").length;
  const roundTripComplete = variants.length > 0 && materializedCount === variants.length;

  useEffect(() => {
    void (async () => {
      const initial = await refresh();
      const pendingTruthCaseId = initial?.truthCaseId ?? initialTruthCaseId;
      if (!pendingTruthCaseId) return;
      setBusy(true);
      setMessage("Completing automatic app-format validation…");
      try {
        const next = await runPendingCaptureVariantRoundTrips(pendingTruthCaseId);
        setState(next);
        if (next.variants.some((variant) => variant.appRoundTripStatus === "materialized")) {
          setMessage("Automatic app-format validation completed. Valid datasets are ready for baseline evaluation.");
        }
      } catch (roundTripError) {
        setError(roundTripError instanceof Error ? roundTripError.message : "Automatic app-format validation failed.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  async function refresh(preferredTruthCaseId = truthCaseId, preferredVariantId = selectedVariantId) {
    setLoading(true);
    setError("");
    try {
      const next = await loadCaptureVariantBuilder();
      setState(next);
      const nextTruthCaseId = next.truthCases.some((item) => item.truthCaseId === preferredTruthCaseId)
        ? preferredTruthCaseId
        : next.truthCases[0]?.truthCaseId ?? "";
      setTruthCaseId(nextTruthCaseId);
      setSelectedProfiles((current) => current.length > 0
        ? current.filter((code) => next.profiles.some((profile) => profile.profileCode === code))
        : next.profiles.map((profile) => profile.profileCode));
      const eligibleVariants = next.variants.filter((item) => !nextTruthCaseId || item.truthCaseId === nextTruthCaseId);
      const nextVariantId = eligibleVariants.some((item) => item.variantId === preferredVariantId)
        ? preferredVariantId
        : eligibleVariants[0]?.variantId ?? "";
      setSelectedVariantId(nextVariantId);
      if (nextVariantId) setDetail(await loadCaptureVariant(nextVariantId));
      else setDetail(null);
      return { state: next, truthCaseId: nextTruthCaseId };
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Capture Variant Builder.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function selectVariant(variantId: string) {
    setSelectedVariantId(variantId);
    setError("");
    try {
      setDetail(await loadCaptureVariant(variantId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Capture Variant.");
    }
  }

  async function generate() {
    if (!truthCaseId) return;
    const seeds = Array.from({ length: variantCount }, (_, index) => index + 1);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const next = await generateCaptureVariants(truthCaseId, { profileCodes: selectedProfiles, seeds });
      setState(next);
      const nextVariant = next.variants.find((item) => item.truthCaseId === truthCaseId) ?? null;
      if (nextVariant) await selectVariant(nextVariant.variantId);
      setMessage("Mock datasets generated and truth-validated. App-format validation will complete automatically when the round-trip service is connected.");
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Unable to generate Capture Variants.");
    } finally {
      setBusy(false);
    }
  }

  if (loading && !state) {
    return <div className="capture-variant-empty"><strong>Loading Capture Variant Builder</strong><span>Reading approved Truth Cases and profiles from PostgreSQL.</span></div>;
  }

  return (
    <section className="capture-variant-builder">
      <header className="capture-variant-heading">
        <div><p className="eyebrow">Create Test Dataset</p><h2>Choose the capture conditions to test</h2><p>The system creates different field, voice, and photo captures from the same protected inspection truth.</p></div>
        <div className="capture-variant-heading-actions">{onBack ? <button className="toolbar-button" onClick={onBack} type="button">Back to source truth</button> : null}<button className="toolbar-button" disabled={loading || busy} onClick={() => void refresh()} type="button">Refresh</button></div>
      </header>
      {error ? <div className="eval-live-feedback error">{error}</div> : null}
      {message ? <div className="eval-live-feedback success">{message}</div> : null}
      {(state?.truthCases.length ?? 0) === 0 ? (
        <div className="capture-variant-empty"><strong>No approved Truth Cases</strong><span>Approve a Truth Case with observable facts before generating Capture Variants.</span></div>
      ) : (
        <div className="capture-dataset-flow">
          <section className="capture-source-ready">
            <div><span className="capture-step-number">1</span><div><p className="eyebrow">Source ready</p><h3>{selectedTruthCase?.displayName ?? "Approved source"}</h3></div></div>
            <label>Source
              <select onChange={(event) => { setTruthCaseId(event.target.value); setDetail(null); setSelectedVariantId(""); }} value={truthCaseId}>
                {(state?.truthCases ?? []).map((item) => <option key={item.truthCaseId} value={item.truthCaseId}>{item.displayName}</option>)}
              </select>
            </label>
            {selectedTruthCase ? <div className="capture-ready-status"><strong>Ready</strong><span>{selectedTruthCase.materializableFactCount} usable inspection facts normalized and protected</span></div> : null}
          </section>

          <section className="capture-condition-section">
            <header><span className="capture-step-number">2</span><div><p className="eyebrow">Capture conditions</p><h3>What conditions do you want to test?</h3><p>Select one or more. Each condition keeps the same inspection truth.</p></div></header>
            <fieldset className="capture-condition-grid"><legend className="sr-only">Choose capture conditions</legend>
              {(state?.profiles ?? []).map((profile) => (
                <label className="capture-condition-card" key={profile.profileCode}>
                  <input checked={selectedProfiles.includes(profile.profileCode)} onChange={() => setSelectedProfiles(toggle(selectedProfiles, profile.profileCode))} type="checkbox" />
                  <span className="capture-condition-check" aria-hidden="true">✓</span>
                  <span><strong>{conditionName(profile.profileCode, profile.displayName)}</strong><small>{conditionDescription(profile.profileCode, profile.description)}</small></span>
                </label>
              ))}
            </fieldset>
            <div className="capture-generation-controls">
              <label>Versions per condition<select onChange={(event) => setVariantCount(Number(event.target.value))} value={variantCount}><option value={1}>1 version</option><option value={2}>2 versions</option><option value={3}>3 versions</option><option value={4}>4 versions</option></select></label>
              <div className="capture-generation-equation"><strong>{selectedProfiles.length} conditions × {variantCount} versions = {selectedProfiles.length * variantCount} datasets</strong><span>Variation is generated automatically and can be reproduced later.</span></div>
              <button className="toolbar-button toolbar-button-primary" disabled={busy || selectedProfiles.length === 0} onClick={() => void generate()} type="button">{busy ? "Generating and validating…" : `Generate and validate ${selectedProfiles.length * variantCount} datasets`}</button>
            </div>
          </section>

          <section className="capture-result-section">
            <header><span className="capture-step-number">3</span><div><p className="eyebrow">Results</p><h3>{variants.length > 0 ? `${variants.length} test datasets created` : "Generate datasets to continue"}</h3><p>Truth validation is automatic. App-format validation runs through the LAIQ app round trip.</p></div></header>
            <div className="capture-result-stats"><VariantStat label="Generated" value={generatedCount || variants.length} /><VariantStat label="Truth checks passed" value={passedCount} /><VariantStat label="Need attention" value={attentionCount} /><VariantStat label="App round trips" value={`${materializedCount}/${variants.length}`} /></div>
            <div className={`capture-roundtrip-status ${roundTripComplete ? "complete" : "pending"}`}><strong>{roundTripComplete ? "Ready for baseline evaluation" : "Waiting for automatic app-format validation"}</strong><span>{roundTripComplete ? "All datasets returned as valid V3 app exports." : "You do not need to review or transfer files. Evaluation becomes available after the app round-trip service returns valid exports."}</span></div>
            <div className="capture-result-actions"><button className="toolbar-button toolbar-button-primary" disabled={!roundTripComplete} onClick={onContinue} type="button">Run baseline evaluation</button><button className="toolbar-button" disabled={variants.length === 0} onClick={() => setShowAdvanced((current) => !current)} type="button">{showAdvanced ? "Hide dataset details" : "View generated datasets"}</button></div>
          </section>

          <details className="capture-advanced" open={showAdvanced} onToggle={(event) => setShowAdvanced(event.currentTarget.open)}>
            <summary>Advanced diagnostics</summary>
            <p>Technical manifests, sampled conditions, fact dispositions, and internal reproducibility values are shown here for debugging only.</p>
            <div className="capture-advanced-grid"><section className="capture-variant-list" aria-label="Generated test datasets"><header><strong>Generated datasets</strong><span>{variants.length} total</span></header>{variants.map((variant) => <button className={variant.variantId === selectedVariantId ? "selected" : ""} key={variant.variantId} onClick={() => void selectVariant(variant.variantId)} type="button"><span><strong>{conditionName(variant.profileCode, variant.profileDisplayName)}</strong><small>Version {variant.deterministicSeed}</small></span><span><StatusPill status={variant.status} /><small>{variant.includedFactCount} captured · {variant.withheldFactCount} withheld</small></span></button>)}</section><VariantDetail detail={detail} /></div>
          </details>
        </div>
      )}
    </section>
  );
}

function VariantDetail({ detail }: { detail: CaptureVariantDetail | null }) {
  const [filter, setFilter] = useState<"all" | CaptureVariantFactLink["disposition"]>("all");
  if (!detail) return <aside className="capture-variant-detail empty"><strong>Select a generated mock dataset</strong><span>Preview how much context was captured, transformed, repeated, or intentionally omitted.</span></aside>;
  const { variant, manifest } = detail;
  const links = detail.links.filter((link) => filter === "all" || link.disposition === filter);
  return (
    <aside className="capture-variant-detail">
      <header><div><p className="eyebrow">Scenario review</p><h3>{variant.profileDisplayName}</h3></div><StatusPill status={variant.status} /></header>
      <dl>
        <Detail label="Mock version" value={String(variant.deterministicSeed)} />
        <Detail label="Package" value={`${manifest.packageType} v${manifest.schemaVersion}`} />
        <Detail label="App contract" value={`${manifest.appContractTarget.packageType} v${manifest.appContractTarget.schemaVersion}`} />
        <Detail label="App Round Trip" value={humanize(variant.appRoundTripStatus)} />
        <Detail label="Missing required inputs" value={String(variant.expectedMissingInputs.length)} />
      </dl>
      <div className="capture-invariants"><strong>Protected invariants</strong><span>{manifest.protectedInvariants.map(humanize).join(" · ")}</span></div>
      {manifest.variationModel ? <SampledConditions conditions={manifest.variationModel.sampledConditions} /> : null}
      <label className="capture-fact-filter">Fact disposition
        <select onChange={(event) => setFilter(event.target.value as typeof filter)} value={filter}>
          <option value="all">All facts</option><option value="included">Included</option><option value="transformed">Transformed</option><option value="repeated">Repeated</option><option value="withheld">Withheld</option>
        </select>
      </label>
      <div className="capture-fact-list">
        {links.map((link) => <article key={link.factId}><span><strong>{humanize(link.factType)}</strong><small>{humanize(link.sectionKey)} · {humanize(link.captureChannel)}</small></span><span><DispositionPill value={link.disposition} /><small>{link.requiredFact ? "Required" : "Optional"}</small></span></article>)}
      </div>
      {variant.status === "review_required" ? <div className="capture-locked"><strong>Validation pending</strong><span>The backend is validating and storing this faithful mock dataset.</span></div> : <div className="capture-locked"><strong>Validated mock dataset</strong><span>{variant.scenarioObjectKey ?? "Stored object identity unavailable"}</span></div>}
    </aside>
  );
}

function SampledConditions({ conditions }: { conditions: NonNullable<CaptureVariantDetail["manifest"]["variationModel"]>["sampledConditions"] }) {
  return (
    <details className="capture-sampled-conditions">
      <summary>Generated capture conditions</summary>
      <dl>
        <Detail label="Context included" value={percent(conditions.contextCompleteness)} />
        <Detail label="Structured completion" value={percent(conditions.structuredCompleteness)} />
        <Detail label="Voice dependence" value={percent(conditions.voiceDependence)} />
        <Detail label="Voice noise" value={percent(conditions.noiseSeverity)} />
        <Detail label="Photo availability" value={percent(conditions.photoAvailability)} />
        <Detail label="Capture order" value={humanize(conditions.observationOrder)} />
      </dl>
      <small>These values were sampled reproducibly for this mock version; they are not manual inputs.</small>
    </details>
  );
}

function VariantStat({ label, value }: { label: string; value: number | string }) { return <article><span>{label}</span><strong>{value}</strong></article>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function StatusPill({ status }: { status: CaptureVariantSummary["status"] }) { return <small className={`capture-status ${status}`}>{status === "approved" ? "Validated" : humanize(status)}</small>; }
function DispositionPill({ value }: { value: CaptureVariantFactLink["disposition"] }) { return <small className={`capture-disposition ${value}`}>{humanize(value)}</small>; }
function toggle(values: string[], value: string) { return values.includes(value) ? values.filter((item) => item !== value) : [...values, value]; }
function humanize(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function percent(value: number) { return `${Math.round(value * 100)}%`; }
function conditionName(code: string, fallback: string) { return ({ structured_complete: "Complete capture", evidence_rich: "Rich context", voice_heavy: "Voice-heavy capture", terse_expert: "Free-style expert notes", noisy_transcript: "Noisy voice recording", minimal_compliant: "Limited optional context", interrupted_partial: "Interrupted workflow", disordered_capture: "Out-of-order capture" } as Record<string, string>)[code] ?? fallback; }
function conditionDescription(code: string, fallback: string) { return ({ structured_complete: "All required fields with concise supporting evidence.", evidence_rich: "More observable context, photos, and corroborating notes.", voice_heavy: "Most observations are captured naturally through voice.", terse_expert: "Compact technical shorthand from an experienced inspector.", noisy_transcript: "Background noise, fillers, and safe transcription uncertainty.", minimal_compliant: "Required data remains complete while optional context is reduced.", interrupted_partial: "Capture is split across pauses and resumed events.", disordered_capture: "Correct observations arrive in a different sequence." } as Record<string, string>)[code] ?? fallback; }
