#!/usr/bin/env python3
"""Reconstruct app-shaped General Information inputs from private historical reports.

Development and held-out source sections remain evaluator-only. The executable
agent receives only the reconstructed app package and confirmed field records.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = PROJECT / "docs/reviews/data/general-tank-information-v1"
DEFAULT_OUTPUT = PROJECT / "docs/reviews/data/general-tank-information-v2-historical"
LEGACY_EXTRACTOR = Path(__file__).with_name("prepare-general-information-mocks.py")
EVALUATOR = Path(__file__).with_name("run-general-information-v2-historical-evaluation.mjs")
V2_MANIFEST = PROJECT / "server/section-agents/releases/general-tank-information/generator/v2/manifest.json"


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_extractor():
    spec = importlib.util.spec_from_file_location("general_information_source_extractor", LEGACY_EXTRACTOR)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def verify_development_freeze(output_root, source_root):
    freeze = json.loads((output_root / "development-freeze.json").read_text())
    assert freeze["releaseManifestSha256"] == digest(V2_MANIFEST), "V2 release changed after development freeze"
    assert freeze["cohortSha256"] == digest(source_root / "cohort.json"), "Historical cohort changed after development freeze"
    assert freeze["developmentResultsSha256"] == digest(output_root / "development-results.json"), "Development results changed"
    assert freeze["preparationScriptSha256"] == digest(Path(__file__)), "Preparation code changed after development freeze"
    assert freeze["evaluationScriptSha256"] == digest(EVALUATOR), "Evaluation code changed after development freeze"
    assert freeze["heldOutContentOpened"] is False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--split", choices=["development", "held_out"], required=True)
    parser.add_argument("--source-root", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--output-root", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    source_root = args.source_root.resolve()
    output_root = args.output_root.resolve()
    output_root.mkdir(parents=True, exist_ok=True)
    if args.split == "held_out":
        verify_development_freeze(output_root, source_root)

    cohort = json.loads((source_root / "cohort.json").read_text())
    assert cohort["contractVersion"] == "general_information_cohort_v1"
    selected = [row for row in cohort["cases"] if row["split"] == args.split]
    assert len(selected) == (10 if args.split == "development" else 1)
    assert len({row["registryLineage"] for row in selected}) == len(selected)

    extractor = load_extractor()
    extractor.ROOT = output_root
    rows = [extractor.prepare(row) for row in selected]
    preparation = {
        "contractVersion": "general_information_v2_historical_preparation_v1",
        "split": args.split,
        "cases": rows,
        "sourceDerived": True,
        "actualDeviceExport": False,
        "originalSectionAvailableToGenerator": False,
        "paidAiCalls": 0,
        "notes": (
            "Historical labelled fields were reconstructed as app-style current evidence. "
            "The original page and expected ledger remain evaluator-only and are opened after generation."
        ),
    }
    extractor.write_once(output_root / f"{args.split}-preparation.json", preparation)
    print(json.dumps({
        "split": args.split,
        "historicalReports": len(rows),
        "fields": sum(row["fieldCount"] for row in rows),
        "nativeFields": sum(row["nativeFieldCount"] for row in rows),
        "confirmedReportSideFields": sum(row["supplementFieldCount"] for row in rows),
        "originalSectionAvailableToGenerator": False,
        "paidAiCalls": 0,
    }, indent=2))


if __name__ == "__main__":
    main()
