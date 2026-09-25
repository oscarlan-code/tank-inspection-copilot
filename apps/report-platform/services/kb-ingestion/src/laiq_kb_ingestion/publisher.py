from __future__ import annotations

import json
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from .models import ChunkRecord, EscalationRequest, IngestionManifest, utc_now_iso
from .service import validate_manifest


def publish_review_package(
    manifest_path: Path,
    *,
    database_url: str | None,
) -> IngestionManifest:
    if not database_url:
        raise ValueError("DATABASE_URL is required to publish an ingestion review package.")
    manifest = validate_manifest(manifest_path)
    identity = manifest.identity
    if not identity.source_object_key:
        raise ValueError(
            "The immutable source must be in S3-compatible object storage before review publish. "
            "Re-ingest with --source-object-key."
        )
    if manifest.quality.status == "failed":
        raise ValueError("A failed extraction cannot enter the PostgreSQL review queue.")

    chunks = _read_chunks(manifest, manifest_path)
    escalations = _read_escalations(manifest, manifest_path)
    now = utc_now_iso()
    with (
        psycopg.connect(database_url) as connection,
        connection.transaction(),
        connection.cursor() as cursor,
    ):
        _assert_schema(cursor)
        _upsert_case(cursor, manifest, now)
        _upsert_document(cursor, manifest, now)
        _insert_run(cursor, manifest, now)
        cursor.execute("DELETE FROM kb_chunks WHERE document_id = %s", (identity.document_id,))
        cursor.execute(
            "DELETE FROM kb_sections WHERE document_id = %s", (identity.document_id,)
        )
        _insert_sections(cursor, manifest, chunks, now)
        _insert_chunks(cursor, manifest, chunks, now)
        _insert_escalations(cursor, manifest, escalations, now)
    return manifest


def _assert_schema(cursor: psycopg.Cursor) -> None:
    cursor.execute("SELECT to_regclass('public.kb_ingestion_runs') AS table_name")
    if cursor.fetchone()[0] is None:
        raise ValueError(
            "KB ingestion schema is unavailable. Start the report API to apply migration 010."
        )


def _upsert_case(cursor: psycopg.Cursor, manifest: IngestionManifest, now: str) -> None:
    identity = manifest.identity
    classification_metadata = {
        "datasetAssignment": identity.dataset_assignment.value,
        "datasetGroupKey": identity.dataset_group_key,
        "ingestionPipeline": manifest.pipeline_version,
    }
    cursor.execute(
        """
        INSERT INTO kb_cases (
          case_id, tenant_id, workspace_id, report_family, dataset_split,
          status_code, metadata_json, created_at_iso, updated_at_iso
        ) VALUES (%s, %s, %s, %s, %s, 'discovered', %s, %s, %s)
        ON CONFLICT (case_id) DO UPDATE SET
          report_family = EXCLUDED.report_family,
          dataset_split = EXCLUDED.dataset_split,
          metadata_json = EXCLUDED.metadata_json,
          updated_at_iso = EXCLUDED.updated_at_iso
        """,
        (
            identity.case_id,
            identity.tenant_id,
            identity.workspace_id,
            identity.report_family,
            identity.dataset_split.value,
            Jsonb(classification_metadata),
            now,
            now,
        ),
    )


def _upsert_document(cursor: psycopg.Cursor, manifest: IngestionManifest, now: str) -> None:
    identity = manifest.identity
    classification_metadata = {
        "classificationSource": identity.dataset_assignment.value,
        "datasetAssignment": identity.dataset_assignment.value,
        "datasetGroupKey": identity.dataset_group_key,
        "localSourceName": Path(identity.source_path).name,
    }
    cursor.execute(
        "SELECT approval_status, retrieval_eligible FROM kb_documents WHERE document_id = %s",
        (identity.document_id,),
    )
    existing = cursor.fetchone()
    if existing and (existing[0] == "approved" or existing[1]):
        raise ValueError("Review publish cannot overwrite an approved or retrievable KB document.")
    cursor.execute(
        """
        INSERT INTO kb_documents (
          document_id, tenant_id, workspace_id, visibility_code, document_type,
          source_uri, source_sha256, metadata_json, created_at_iso, updated_at_iso,
          case_id, rendition_id, document_role, dataset_split, approval_status,
          retrieval_eligible, source_object_key, parser_name, parser_version,
          extraction_quality_json
        ) VALUES (
          %s, %s, %s, %s, 'historical_report', %s, %s, %s, %s, %s,
          %s, %s, 'historical_source', %s, 'pending_review', FALSE, %s,
          'docling', %s, %s
        )
        ON CONFLICT (document_id) DO UPDATE SET
          source_uri = EXCLUDED.source_uri,
          source_sha256 = EXCLUDED.source_sha256,
          updated_at_iso = EXCLUDED.updated_at_iso,
          metadata_json = EXCLUDED.metadata_json,
          document_role = EXCLUDED.document_role,
          dataset_split = EXCLUDED.dataset_split,
          source_object_key = EXCLUDED.source_object_key,
          parser_name = EXCLUDED.parser_name,
          parser_version = EXCLUDED.parser_version,
          extraction_quality_json = EXCLUDED.extraction_quality_json,
          retrieval_eligible = FALSE,
          approval_status = 'pending_review'
        """,
        (
            identity.document_id,
            identity.tenant_id,
            identity.workspace_id,
            identity.visibility_code,
            f"s3://{identity.source_object_key}",
            identity.source_sha256,
            Jsonb(classification_metadata),
            now,
            now,
            identity.case_id,
            identity.rendition_id,
            identity.dataset_split.value,
            identity.source_object_key,
            manifest.pipeline_version,
            Jsonb(manifest.quality.model_dump(mode="json")),
        ),
    )


def _insert_run(cursor: psycopg.Cursor, manifest: IngestionManifest, now: str) -> None:
    database_manifest = manifest.model_dump(mode="json")
    database_manifest["identity"]["source_path"] = Path(
        manifest.identity.source_path
    ).name
    cursor.execute(
        """
        INSERT INTO kb_ingestion_runs (
          ingestion_run_id, case_id, document_id, source_sha256, pipeline_version,
          status_code, quality_json, manifest_json, started_at_iso, completed_at_iso
        ) VALUES (%s, %s, %s, %s, %s, 'awaiting_review', %s, %s, %s, %s)
        ON CONFLICT (ingestion_run_id) DO NOTHING
        """,
        (
            manifest.ingestion_run_id,
            manifest.identity.case_id,
            manifest.identity.document_id,
            manifest.identity.source_sha256,
            manifest.pipeline_version,
            Jsonb(manifest.quality.model_dump(mode="json")),
            Jsonb(database_manifest),
            manifest.created_at_iso,
            now,
        ),
    )


def _insert_sections(
    cursor: psycopg.Cursor,
    manifest: IngestionManifest,
    chunks: tuple[ChunkRecord, ...],
    now: str,
) -> None:
    warning_issues = tuple(
        issue for issue in manifest.quality.issues if issue.severity.value in {"warning", "error"}
    )
    sections = dict.fromkeys(chunk.section_key for chunk in chunks)
    for order, section_key in enumerate(sections, 1):
        section_chunks = tuple(chunk for chunk in chunks if chunk.section_key == section_key)
        source_block_ids = {
            block_id for chunk in section_chunks for block_id in chunk.source_block_ids
        }
        page_numbers = {page for chunk in section_chunks for page in chunk.page_numbers}
        section_issues = tuple(
            issue
            for issue in warning_issues
            if set(issue.block_ids).intersection(source_block_ids)
            or (not issue.block_ids and set(issue.page_numbers).intersection(page_numbers))
        )
        quality_warning = bool(section_issues)
        training_candidate = (
            manifest.identity.dataset_split.value == "training" and not quality_warning
        )
        lane_code = (
            "quarantine"
            if quality_warning
            else "wording_precedent"
            if training_candidate
            else "evaluation_gold"
        )
        metadata = {
            "automaticRetrievalCandidate": training_candidate,
            "classificationSource": "automatic",
            "qualityWarning": quality_warning,
            "warningIssueCodes": sorted({issue.issue_code for issue in section_issues}),
        }
        cursor.execute(
            """
            INSERT INTO kb_sections (
              section_id, document_id, ingestion_run_id, section_key,
              original_heading, stable_order, review_status, metadata_json, lane_code,
              include_in_retrieval,
              created_at_iso, updated_at_iso
            ) VALUES (
              %s, %s, %s, %s, %s, %s, 'pending_review', %s, %s, FALSE, %s, %s
            )
            """,
            (
                f"{manifest.identity.document_id}:{section_key}",
                manifest.identity.document_id,
                manifest.ingestion_run_id,
                section_key,
                section_key.replace("-", " ").title(),
                order,
                Jsonb(metadata),
                lane_code,
                now,
                now,
            ),
        )


def _insert_chunks(
    cursor: psycopg.Cursor,
    manifest: IngestionManifest,
    chunks: tuple[ChunkRecord, ...],
    now: str,
) -> None:
    identity = manifest.identity
    for stable_order, chunk in enumerate(chunks, 1):
        cursor.execute(
            """
            INSERT INTO kb_chunks (
              chunk_id, document_id, tenant_id, workspace_id, section_type,
              content, metadata_json, embedding, created_at_iso,
              ingestion_run_id, block_type, content_sha256,
              source_block_ids_json, page_numbers_json, source_spans_json,
              stable_order
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, NULL, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                chunk.chunk_id,
                identity.document_id,
                identity.tenant_id,
                identity.workspace_id,
                chunk.section_key,
                chunk.content,
                Jsonb(chunk.metadata),
                now,
                manifest.ingestion_run_id,
                chunk.block_type.value,
                chunk.content_sha256,
                Jsonb(list(chunk.source_block_ids)),
                Jsonb(list(chunk.page_numbers)),
                Jsonb([span.model_dump(mode="json") for span in chunk.source_spans]),
                stable_order,
            ),
        )


def _insert_escalations(
    cursor: psycopg.Cursor,
    manifest: IngestionManifest,
    escalations: tuple[EscalationRequest, ...],
    now: str,
) -> None:
    for request in escalations:
        cursor.execute(
            """
            INSERT INTO kb_ingestion_escalations (
              request_id, ingestion_run_id, document_id, task_code, status_code,
              request_json, created_at_iso, updated_at_iso
            ) VALUES (%s, %s, %s, %s, 'pending', %s, %s, %s)
            ON CONFLICT (request_id) DO NOTHING
            """,
            (
                request.request_id,
                manifest.ingestion_run_id,
                manifest.identity.document_id,
                request.task_code,
                Jsonb(request.model_dump(mode="json")),
                now,
                now,
            ),
        )


def _read_chunks(
    manifest: IngestionManifest,
    manifest_path: Path,
) -> tuple[ChunkRecord, ...]:
    path = manifest.resolve_artifact(manifest_path, manifest.chunks_path)
    return tuple(
        ChunkRecord.model_validate_json(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    )


def _read_escalations(
    manifest: IngestionManifest,
    manifest_path: Path,
) -> tuple[EscalationRequest, ...]:
    path = manifest.resolve_artifact(manifest_path, manifest.escalation_requests_path)
    payload = json.loads(path.read_text(encoding="utf-8"))
    return tuple(EscalationRequest.model_validate(value) for value in payload)
