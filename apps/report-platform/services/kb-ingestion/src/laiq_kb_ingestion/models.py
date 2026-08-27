from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator


def utc_now_iso() -> str:
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class DatasetSplit(StrEnum):
    TRAINING = "training"
    VALIDATION = "validation"
    HIDDEN_TEST = "hidden_test"
    UNASSIGNED = "unassigned"


class DatasetAssignment(StrEnum):
    AUTOMATIC = "automatic"
    EXPLICIT = "explicit"


class BlockType(StrEnum):
    HEADING = "heading"
    PARAGRAPH = "paragraph"
    LIST_ITEM = "list_item"
    TABLE = "table"
    FIGURE = "figure"
    CAPTION = "caption"
    FORMULA = "formula"
    OTHER = "other"


class Severity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"


class SourceIdentity(StrictModel):
    case_id: str
    document_id: str
    rendition_id: str
    source_path: str
    source_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_size_bytes: int = Field(ge=0)
    media_type: str
    source_object_key: str | None = None
    report_family: str
    dataset_split: DatasetSplit = DatasetSplit.UNASSIGNED
    dataset_assignment: DatasetAssignment = DatasetAssignment.EXPLICIT
    dataset_group_key: str | None = None
    tenant_id: str | None = None
    workspace_id: str | None = None
    visibility_code: str = "platform_private"


class SourceSpan(StrictModel):
    page_number: int | None = Field(default=None, ge=1)
    bbox: tuple[float, float, float, float] | None = None
    normalized_bbox: tuple[float, float, float, float] | None = None


class ParsedBlock(StrictModel):
    block_id: str
    block_type: BlockType
    text: str
    heading_path: tuple[str, ...] = ()
    heading_level: int | None = Field(default=None, ge=1, le=12)
    source_spans: tuple[SourceSpan, ...] = ()
    extraction_confidence: float = Field(ge=0, le=1)
    metadata: dict[str, Any] = Field(default_factory=dict)


class ParsedDocument(StrictModel):
    schema_version: int = 1
    identity: SourceIdentity
    title: str
    parser_name: str
    parser_version: str
    page_count: int = Field(ge=0)
    blocks: tuple[ParsedBlock, ...]
    diagnostics: dict[str, Any] = Field(default_factory=dict)
    extracted_at_iso: str = Field(default_factory=utc_now_iso)


class QualityIssue(StrictModel):
    issue_code: str
    severity: Severity
    message: str
    block_ids: tuple[str, ...] = ()
    page_numbers: tuple[int, ...] = ()


class QualityReport(StrictModel):
    status: str = Field(pattern=r"^(passed|needs_review|failed)$")
    score: float = Field(ge=0, le=1)
    text_page_coverage: float = Field(ge=0, le=1)
    provenance_coverage: float = Field(ge=0, le=1)
    heading_count: int = Field(ge=0)
    table_count: int = Field(ge=0)
    issues: tuple[QualityIssue, ...] = ()


class EscalationRequest(StrictModel):
    request_id: str
    document_id: str
    task_code: str
    reason: str
    source_block_ids: tuple[str, ...]
    source_excerpt: str
    allowed_output_fields: tuple[str, ...]
    requires_human_review: bool = True
    created_at_iso: str = Field(default_factory=utc_now_iso)


class RelationshipCandidate(StrictModel):
    source_block_id: str
    target_block_id: str
    relationship_type: str


class DerivedAnnotation(StrictModel):
    request_id: str
    source_block_ids: tuple[str, ...]
    proposed_section_key: str | None = None
    proposed_block_type: BlockType | None = None
    relationship_candidates: tuple[RelationshipCandidate, ...] = ()
    explanation: str
    confidence: float = Field(ge=0, le=1)
    model_id: str
    prompt_version: str
    requires_human_review: bool = True


class ChunkSourceSpan(StrictModel):
    source_block_id: str
    page_number: int = Field(ge=1)
    bbox: tuple[float, float, float, float]


class ChunkRecord(StrictModel):
    chunk_id: str
    document_id: str
    section_key: str
    block_type: BlockType
    content: str
    content_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_block_ids: tuple[str, ...]
    page_numbers: tuple[int, ...] = ()
    source_spans: tuple[ChunkSourceSpan, ...] = ()
    metadata: dict[str, Any] = Field(default_factory=dict)


class IngestionManifest(StrictModel):
    schema_version: int = 1
    ingestion_run_id: str
    pipeline_version: str
    identity: SourceIdentity
    quality: QualityReport
    parsed_document_path: str
    chunks_path: str
    escalation_requests_path: str
    derived_annotations_path: str | None = None
    chunk_count: int = Field(ge=0)
    escalation_count: int = Field(ge=0)
    retrieval_eligible: bool = False
    created_at_iso: str = Field(default_factory=utc_now_iso)

    @model_validator(mode="after")
    def enforce_review_boundary(self) -> IngestionManifest:
        if self.retrieval_eligible:
            raise ValueError("Ingestion output cannot auto-publish itself to retrieval.")
        return self

    def resolve_artifact(self, manifest_path: Path, value: str) -> Path:
        path = Path(value)
        return path if path.is_absolute() else manifest_path.parent / path
