from __future__ import annotations

import hashlib
import json
from pathlib import Path

from .ai_escalation import run_command_provider
from .extractor import DoclingExtractor
from .llama_pipeline import build_chunks
from .models import ChunkRecord, EscalationRequest, IngestionManifest, SourceIdentity, utc_now_iso
from .quality import build_escalation_requests, evaluate_extraction

PIPELINE_VERSION = "laiq-kb-ingestion-v2"


def ingest_source(
    source: Path,
    output: Path,
    identity: SourceIdentity,
    *,
    enable_ocr: bool,
    enable_tables: bool,
    max_chunk_characters: int,
    allow_ai_escalation: bool,
    ai_command: str | None,
    ai_timeout_seconds: int,
) -> IngestionManifest:
    if allow_ai_escalation != bool(ai_command):
        raise ValueError(
            "AI escalation requires both --allow-ai-escalation and --ai-command."
        )

    output.mkdir(parents=True, exist_ok=True)
    document = DoclingExtractor(
        enable_ocr=enable_ocr,
        enable_tables=enable_tables,
    ).extract(source, identity)
    quality = evaluate_extraction(document)
    chunks = build_chunks(document, max_characters=max_chunk_characters)
    escalations = build_escalation_requests(document, quality)
    annotations = (
        run_command_provider(
            escalations,
            command=ai_command,
            timeout_seconds=ai_timeout_seconds,
        )
        if allow_ai_escalation and ai_command and escalations
        else ()
    )

    parsed_path = output / "parsed-document.json"
    quality_path = output / "quality-report.json"
    chunks_path = output / "chunks.jsonl"
    escalation_path = output / "escalation-requests.json"
    annotation_path = output / "derived-annotations.json"
    parsed_path.write_text(document.model_dump_json(indent=2), encoding="utf-8")
    quality_path.write_text(quality.model_dump_json(indent=2), encoding="utf-8")
    chunks_path.write_text(
        "".join(f"{chunk.model_dump_json()}\n" for chunk in chunks),
        encoding="utf-8",
    )
    escalation_path.write_text(
        json.dumps([request.model_dump(mode="json") for request in escalations], indent=2),
        encoding="utf-8",
    )
    if annotations:
        annotation_path.write_text(
            json.dumps(
                [annotation.model_dump(mode="json") for annotation in annotations], indent=2
            ),
            encoding="utf-8",
        )

    run_material = f"{identity.source_sha256}:{PIPELINE_VERSION}:{utc_now_iso()}"
    manifest = IngestionManifest(
        ingestion_run_id=f"ingestion_{hashlib.sha256(run_material.encode()).hexdigest()[:24]}",
        pipeline_version=PIPELINE_VERSION,
        identity=identity,
        quality=quality,
        parsed_document_path=parsed_path.name,
        chunks_path=chunks_path.name,
        escalation_requests_path=escalation_path.name,
        derived_annotations_path=annotation_path.name if annotations else None,
        chunk_count=len(chunks),
        escalation_count=len(escalations),
    )
    (output / "manifest.json").write_text(manifest.model_dump_json(indent=2), encoding="utf-8")
    return manifest


def validate_manifest(manifest_path: Path) -> IngestionManifest:
    manifest = IngestionManifest.model_validate_json(manifest_path.read_text(encoding="utf-8"))
    required = {
        "parsed document": manifest.parsed_document_path,
        "chunks": manifest.chunks_path,
        "escalation requests": manifest.escalation_requests_path,
    }
    if manifest.derived_annotations_path:
        required["derived annotations"] = manifest.derived_annotations_path
    for label, value in required.items():
        path = manifest.resolve_artifact(manifest_path, value)
        if not path.is_file():
            raise ValueError(f"Manifest {label} artifact does not exist: {path}")
    chunk_lines = [
        line
        for line in manifest.resolve_artifact(manifest_path, manifest.chunks_path)
        .read_text(encoding="utf-8")
        .splitlines()
        if line.strip()
    ]
    chunks = tuple(ChunkRecord.model_validate_json(line) for line in chunk_lines)
    if len(chunks) != manifest.chunk_count:
        raise ValueError(
            f"Manifest chunk count is {manifest.chunk_count}, but artifact contains {len(chunks)}."
        )
    for chunk in chunks:
        if chunk.document_id != manifest.identity.document_id:
            raise ValueError(f"Chunk {chunk.chunk_id} belongs to a different document.")
        content_hash = hashlib.sha256(chunk.content.encode()).hexdigest()
        if content_hash != chunk.content_sha256:
            raise ValueError(f"Chunk {chunk.chunk_id} content hash does not match its record.")

    escalation_payload = json.loads(
        manifest.resolve_artifact(manifest_path, manifest.escalation_requests_path).read_text(
            encoding="utf-8"
        )
    )
    escalations = tuple(EscalationRequest.model_validate(value) for value in escalation_payload)
    if len(escalations) != manifest.escalation_count:
        raise ValueError(
            "Manifest escalation count is "
            f"{manifest.escalation_count}, but artifact contains {len(escalations)}."
        )
    if any(request.document_id != manifest.identity.document_id for request in escalations):
        raise ValueError("An escalation request belongs to a different document.")
    return manifest
