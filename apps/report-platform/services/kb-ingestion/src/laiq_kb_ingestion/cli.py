from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .extractor import build_source_identity
from .publisher import publish_review_package
from .service import ingest_source, validate_manifest


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="kb-ingest")
    commands = parser.add_subparsers(dest="command", required=True)

    ingest = commands.add_parser("ingest", help="Build a reviewable ingestion package.")
    ingest.add_argument("source", type=Path)
    ingest.add_argument("--output", type=Path, required=True)
    ingest.add_argument("--case-id")
    ingest.add_argument("--document-id")
    ingest.add_argument("--rendition-id")
    ingest.add_argument("--report-family", default="auto")
    ingest.add_argument("--source-object-key")
    ingest.add_argument(
        "--dataset-split",
        choices=("auto", "training", "validation", "hidden_test", "unassigned"),
        default="auto",
    )
    ingest.add_argument("--dataset-group-key")
    ingest.add_argument("--tenant-id")
    ingest.add_argument("--workspace-id")
    ingest.add_argument("--visibility-code", default="platform_private")
    ingest.add_argument("--no-ocr", action="store_true")
    ingest.add_argument("--no-tables", action="store_true")
    ingest.add_argument("--max-chunk-characters", type=int, default=4_800)
    ingest.add_argument("--allow-ai-escalation", action="store_true")
    ingest.add_argument("--ai-command")
    ingest.add_argument("--ai-timeout-seconds", type=int, default=90)

    validate = commands.add_parser("validate", help="Validate an ingestion manifest.")
    validate.add_argument("manifest", type=Path)

    publish = commands.add_parser(
        "publish-review",
        help="Store a validated package in the PostgreSQL review queue.",
    )
    publish.add_argument("manifest", type=Path)
    publish.add_argument("--database-url", default=os.environ.get("DATABASE_URL"))
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        if args.command == "validate":
            manifest = validate_manifest(args.manifest.resolve())
        elif args.command == "publish-review":
            manifest = publish_review_package(
                args.manifest.resolve(),
                database_url=args.database_url,
            )
        else:
            source = args.source.resolve()
            if not source.is_file():
                raise ValueError(f"Source file does not exist: {source}")
            if args.max_chunk_characters < 500:
                raise ValueError("--max-chunk-characters must be at least 500.")
            identity = build_source_identity(
                source,
                case_id=args.case_id,
                document_id=args.document_id,
                rendition_id=args.rendition_id,
                report_family=args.report_family,
                dataset_split=args.dataset_split,
                dataset_group_key=args.dataset_group_key,
                source_object_key=args.source_object_key,
                tenant_id=args.tenant_id,
                workspace_id=args.workspace_id,
                visibility_code=args.visibility_code,
            )
            manifest = ingest_source(
                source,
                args.output.resolve(),
                identity,
                enable_ocr=not args.no_ocr,
                enable_tables=not args.no_tables,
                max_chunk_characters=args.max_chunk_characters,
                allow_ai_escalation=args.allow_ai_escalation,
                ai_command=args.ai_command,
                ai_timeout_seconds=args.ai_timeout_seconds,
            )
        print(json.dumps(manifest.model_dump(mode="json"), indent=2))
        return 0
    except (OSError, RuntimeError, ValueError) as error:
        print(f"kb-ingest failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
