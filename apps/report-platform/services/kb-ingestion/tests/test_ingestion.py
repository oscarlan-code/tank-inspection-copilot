from __future__ import annotations

from pathlib import Path

import pytest

from laiq_kb_ingestion.ai_escalation import run_command_provider
from laiq_kb_ingestion.extractor import build_source_identity
from laiq_kb_ingestion.llama_pipeline import build_chunks
from laiq_kb_ingestion.models import (
    BlockType,
    EscalationRequest,
    IngestionManifest,
    ParsedBlock,
    ParsedDocument,
    SourceIdentity,
    SourceSpan,
)
from laiq_kb_ingestion.quality import build_escalation_requests, evaluate_extraction


def identity() -> SourceIdentity:
    return SourceIdentity(
        case_id="case-test",
        document_id="doc-test",
        rendition_id="rendition-test",
        source_path="/tmp/test-report.pdf",
        source_sha256="a" * 64,
        source_size_bytes=42,
        media_type="application/pdf",
        report_family="internal_external_api653",
        dataset_split="training",
    )


def document() -> ParsedDocument:
    return ParsedDocument(
        identity=identity(),
        title="Test report",
        parser_name="fixture",
        parser_version="1",
        page_count=2,
        blocks=(
            ParsedBlock(
                block_id="heading-1",
                block_type=BlockType.HEADING,
                text="5 Repair Recommendations",
                heading_path=("5 Repair Recommendations",),
                heading_level=1,
                source_spans=(
                    SourceSpan(
                        page_number=1,
                        bbox=(10.0, 10.0, 90.0, 24.0),
                        normalized_bbox=(0.10, 0.10, 0.90, 0.24),
                    ),
                ),
                extraction_confidence=0.98,
            ),
            ParsedBlock(
                block_id="finding-1",
                block_type=BlockType.PARAGRAPH,
                text="Localized shell thinning was recorded at Area 1.",
                heading_path=("5 Repair Recommendations",),
                source_spans=(
                    SourceSpan(
                        page_number=1,
                        bbox=(10.0, 28.0, 90.0, 42.0),
                        normalized_bbox=(0.10, 0.28, 0.90, 0.42),
                    ),
                ),
                extraction_confidence=0.98,
            ),
            ParsedBlock(
                block_id="recommendation-1",
                block_type=BlockType.LIST_ITEM,
                text="Submit the area for API 653 engineering assessment.",
                heading_path=("5 Repair Recommendations",),
                source_spans=(
                    SourceSpan(
                        page_number=2,
                        bbox=(10.0, 10.0, 90.0, 24.0),
                        normalized_bbox=(0.10, 0.10, 0.90, 0.24),
                    ),
                ),
                extraction_confidence=0.98,
            ),
        ),
    )


def test_ingestion_assigns_safe_defaults_without_user_settings(tmp_path: Path) -> None:
    source = tmp_path / "22PE3-1 TK V10 Profile Assessment (3D Scan).pdf"
    source.write_bytes(b"test source")

    assigned = build_source_identity(
        source,
        case_id=None,
        document_id=None,
        rendition_id=None,
        report_family="auto",
        dataset_split="auto",
        dataset_group_key=None,
        source_object_key="kb-review/test.pdf",
        tenant_id=None,
        workspace_id=None,
        visibility_code="platform_private",
    )
    repeated = build_source_identity(
        source,
        case_id=None,
        document_id=None,
        rendition_id=None,
        report_family="auto",
        dataset_split="auto",
        dataset_group_key=None,
        source_object_key="kb-review/test.pdf",
        tenant_id=None,
        workspace_id=None,
        visibility_code="platform_private",
    )

    assert assigned.report_family == "profile_3d_scan"
    assert assigned.dataset_assignment.value == "automatic"
    assert assigned.dataset_group_key == "22pe3-1"
    assert assigned.dataset_split.value in {"training", "validation", "hidden_test"}
    assert repeated.dataset_split == assigned.dataset_split


def test_report_aware_chunks_keep_section_and_provenance() -> None:
    chunks = build_chunks(document(), max_characters=2_000)
    assert len(chunks) == 1
    assert chunks[0].section_key == "repair-recommendations"
    assert chunks[0].source_block_ids == ("heading-1", "finding-1", "recommendation-1")
    assert chunks[0].page_numbers == (1, 2)
    assert len(chunks[0].source_spans) == 3
    assert chunks[0].source_spans[1].source_block_id == "finding-1"
    assert chunks[0].source_spans[1].bbox == (0.10, 0.28, 0.90, 0.42)
    assert "Localized shell thinning" in chunks[0].content


def test_quality_gate_creates_review_request_for_low_confidence_block() -> None:
    low_confidence = document().model_copy(
        update={
            "blocks": document().blocks
            + (
                ParsedBlock(
                    block_id="table-1",
                    block_type=BlockType.TABLE,
                    text="",
                    heading_path=("5 Repair Recommendations",),
                    source_spans=(SourceSpan(page_number=2),),
                    extraction_confidence=0.35,
                ),
            )
        }
    )
    quality = evaluate_extraction(low_confidence)
    requests = build_escalation_requests(low_confidence, quality)
    assert quality.status == "needs_review"
    assert {request.task_code for request in requests} == {
        "propose_block_classification",
        "propose_table_classification",
    }
    assert all(request.requires_human_review for request in requests)


def test_ai_provider_rejects_annotation_for_unrequested_block(tmp_path: Path) -> None:
    provider = tmp_path / "provider.py"
    provider.write_text(
        """
import json, sys
request = json.load(sys.stdin)
print(json.dumps({
  "request_id": request["request_id"],
  "source_block_ids": ["outside-block"],
  "explanation": "proposal",
  "confidence": 0.8,
  "model_id": "test-model",
  "prompt_version": "test-v1"
}))
""".strip(),
        encoding="utf-8",
    )
    request = EscalationRequest(
        request_id="request-1",
        document_id="doc-test",
        task_code="propose_block_classification",
        reason="Low confidence",
        source_block_ids=("block-1",),
        source_excerpt="Evidence",
        allowed_output_fields=("proposed_section_key",),
    )
    with pytest.raises(ValueError, match="outside the controlled escalation request"):
        run_command_provider(
            (request,),
            command=f"python3 {provider}",
            timeout_seconds=5,
        )


def test_ai_provider_accepts_source_scoped_annotation(tmp_path: Path) -> None:
    provider = tmp_path / "provider.py"
    provider.write_text(
        """
import json, sys
request = json.load(sys.stdin)
print(json.dumps({
  "request_id": request["request_id"],
  "source_block_ids": request["source_block_ids"],
  "proposed_section_key": "repair-recommendations",
  "explanation": "Classified from the supplied heading and excerpt only.",
  "confidence": 0.91,
  "model_id": "test-model",
  "prompt_version": "test-v1"
}))
""".strip(),
        encoding="utf-8",
    )
    request = EscalationRequest(
        request_id="request-2",
        document_id="doc-test",
        task_code="propose_block_classification",
        reason="Low confidence",
        source_block_ids=("block-1",),
        source_excerpt="5 Repair Recommendations",
        allowed_output_fields=("proposed_section_key",),
    )

    annotations = run_command_provider(
        (request,),
        command=f"python3 {provider}",
        timeout_seconds=5,
    )

    assert len(annotations) == 1
    assert annotations[0].source_block_ids == ("block-1",)
    assert annotations[0].proposed_section_key == "repair-recommendations"
    assert request.source_excerpt == "5 Repair Recommendations"


def test_ai_provider_rejects_annotation_field_not_allowed_by_request(
    tmp_path: Path,
) -> None:
    provider = tmp_path / "provider.py"
    provider.write_text(
        """
import json, sys
request = json.load(sys.stdin)
print(json.dumps({
  "request_id": request["request_id"],
  "source_block_ids": request["source_block_ids"],
  "proposed_block_type": "table",
  "explanation": "proposal",
  "confidence": 0.8,
  "model_id": "test-model",
  "prompt_version": "test-v1"
}))
""".strip(),
        encoding="utf-8",
    )
    request = EscalationRequest(
        request_id="request-3",
        document_id="doc-test",
        task_code="propose_section_mapping",
        reason="Missing section",
        source_block_ids=("block-1",),
        source_excerpt="Evidence",
        allowed_output_fields=("proposed_section_key",),
    )

    with pytest.raises(ValueError, match="fields not allowed"):
        run_command_provider(
            (request,),
            command=f"python3 {provider}",
            timeout_seconds=5,
        )


def test_manifest_can_never_auto_publish() -> None:
    quality = evaluate_extraction(document())
    with pytest.raises(ValueError, match="cannot auto-publish"):
        IngestionManifest(
            ingestion_run_id="run-test",
            pipeline_version="test",
            identity=identity(),
            quality=quality,
            parsed_document_path="parsed.json",
            chunks_path="chunks.jsonl",
            escalation_requests_path="escalations.json",
            chunk_count=1,
            escalation_count=0,
            retrieval_eligible=True,
        )
