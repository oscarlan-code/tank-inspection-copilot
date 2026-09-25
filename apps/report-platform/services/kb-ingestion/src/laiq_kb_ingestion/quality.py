from __future__ import annotations

import hashlib

from .models import (
    BlockType,
    EscalationRequest,
    ParsedBlock,
    ParsedDocument,
    QualityIssue,
    QualityReport,
    Severity,
)


def evaluate_extraction(document: ParsedDocument) -> QualityReport:
    issues: list[QualityIssue] = []
    text_blocks = [block for block in document.blocks if block.text.strip()]
    heading_count = sum(block.block_type == BlockType.HEADING for block in document.blocks)
    table_blocks = [block for block in document.blocks if block.block_type == BlockType.TABLE]
    page_numbers = {
        span.page_number
        for block in text_blocks
        for span in block.source_spans
        if span.page_number is not None
    }

    if document.page_count > 0:
        text_page_coverage = min(len(page_numbers) / document.page_count, 1)
        provenance_coverage = (
            sum(bool(block.source_spans) for block in text_blocks) / len(text_blocks)
            if text_blocks
            else 0
        )
    else:
        text_page_coverage = 1 if text_blocks else 0
        provenance_coverage = 1

    character_count = sum(len(block.text) for block in text_blocks)
    if not text_blocks:
        issues.append(
            QualityIssue(
                issue_code="no_text_blocks",
                severity=Severity.ERROR,
                message="No searchable text blocks were extracted.",
            )
        )
    elif character_count < 200:
        issues.append(
            QualityIssue(
                issue_code="very_low_text_volume",
                severity=Severity.WARNING,
                message=f"Only {character_count} text characters were extracted.",
            )
        )

    if document.page_count > 0 and text_page_coverage < 0.8:
        issues.append(
            QualityIssue(
                issue_code="low_page_coverage",
                severity=Severity.ERROR if text_page_coverage < 0.5 else Severity.WARNING,
                message=f"Text was found on {text_page_coverage:.1%} of document pages.",
            )
        )
    if document.page_count > 0 and provenance_coverage < 0.75:
        issues.append(
            QualityIssue(
                issue_code="low_provenance_coverage",
                severity=Severity.WARNING,
                message=f"Only {provenance_coverage:.1%} of text blocks have page provenance.",
            )
        )
    if character_count >= 1_000 and heading_count == 0:
        issues.append(
            QualityIssue(
                issue_code="missing_heading_hierarchy",
                severity=Severity.WARNING,
                message="No section headings were detected in a substantial document.",
            )
        )

    empty_tables = [block.block_id for block in table_blocks if not block.text.strip()]
    if empty_tables:
        issues.append(
            QualityIssue(
                issue_code="empty_table_extraction",
                severity=Severity.WARNING,
                message="One or more detected tables have no structured text.",
                block_ids=tuple(empty_tables),
            )
        )

    low_confidence = [
        block.block_id for block in document.blocks if block.extraction_confidence < 0.75
    ]
    if low_confidence:
        low_confidence_pages = sorted(
            {
                span.page_number
                for block in document.blocks
                if block.block_id in low_confidence
                for span in block.source_spans
                if span.page_number is not None
            }
        )
        issues.append(
            QualityIssue(
                issue_code="low_confidence_blocks",
                severity=Severity.WARNING,
                message=f"{len(low_confidence)} blocks require extraction review.",
                block_ids=tuple(low_confidence),
                page_numbers=tuple(low_confidence_pages),
            )
        )

    score = (
        0.40 * text_page_coverage
        + 0.30 * provenance_coverage
        + 0.15 * min(heading_count / 3, 1)
        + 0.15 * (1 if text_blocks else 0)
    )
    if any(issue.severity == Severity.ERROR for issue in issues):
        status = "failed"
    elif issues:
        status = "needs_review"
    else:
        status = "passed"

    return QualityReport(
        status=status,
        score=round(score, 6),
        text_page_coverage=round(text_page_coverage, 6),
        provenance_coverage=round(provenance_coverage, 6),
        heading_count=heading_count,
        table_count=len(table_blocks),
        issues=tuple(issues),
    )


def build_escalation_requests(
    document: ParsedDocument,
    quality: QualityReport,
) -> tuple[EscalationRequest, ...]:
    requests: list[EscalationRequest] = []
    blocks_by_id = {block.block_id: block for block in document.blocks}

    for issue in quality.issues:
        if issue.issue_code not in {
            "missing_heading_hierarchy",
            "empty_table_extraction",
            "low_confidence_blocks",
        }:
            continue
        source_ids = issue.block_ids or tuple(blocks_by_id)[:8]
        source_blocks = [
            blocks_by_id[block_id] for block_id in source_ids if block_id in blocks_by_id
        ]
        excerpt = "\n\n".join(block.text for block in source_blocks if block.text)[:8_000]
        if not excerpt:
            excerpt = "\n".join(
                _block_descriptor(block) for block in source_blocks
            )
        material = f"{document.identity.document_id}:{issue.issue_code}:{','.join(source_ids)}"
        request_id = f"escalation_{hashlib.sha256(material.encode()).hexdigest()[:24]}"
        requests.append(
            EscalationRequest(
                request_id=request_id,
                document_id=document.identity.document_id,
                task_code=_task_for_issue(issue.issue_code),
                reason=issue.message,
                source_block_ids=tuple(source_ids),
                source_excerpt=excerpt,
                allowed_output_fields=(
                    "proposed_section_key",
                    "proposed_block_type",
                    "relationship_candidates",
                    "explanation",
                    "confidence",
                    "model_id",
                    "prompt_version",
                ),
            )
        )
    return tuple(requests)


def _task_for_issue(issue_code: str) -> str:
    return {
        "missing_heading_hierarchy": "propose_section_mapping",
        "empty_table_extraction": "propose_table_classification",
        "low_confidence_blocks": "propose_block_classification",
    }[issue_code]


def _block_descriptor(block: ParsedBlock) -> str:
    heading_path = " > ".join(block.heading_path) or "none"
    pages = sorted(
        {
            span.page_number
            for span in block.source_spans
            if span.page_number is not None
        }
    )
    return (
        f"Block {block.block_id}; type={block.block_type.value}; "
        f"heading={heading_path}; pages={pages}"
    )
