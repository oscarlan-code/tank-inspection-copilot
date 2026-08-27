from __future__ import annotations

import hashlib
import json
import re
from collections.abc import Sequence
from typing import Any

from llama_index.core.ingestion import IngestionPipeline
from llama_index.core.schema import BaseNode, TextNode, TransformComponent

from .models import BlockType, ChunkRecord, ChunkSourceSpan, ParsedDocument

SECTION_ALIASES = {
    "scope": "scope-of-inspection",
    "inspection and maintenance": "inspection-maintenance-regime",
    "general tank information": "general-tank-information",
    "inspection report": "inspection-report",
    "repair recommendation": "repair-recommendations",
    "test information": "test-information",
    "checklist": "tank-inspection-checklist",
    "photograph": "photographs",
    "roof plate thickness": "roof-plate-thickness-measurements",
    "shell plate thickness": "shell-plate-thickness-measurements",
    "floor plate thickness": "floor-plate-thickness-measurements",
    "roof plate layout": "roof-plate-layout",
    "shell plate layout": "shell-plate-layout",
    "floor plate layout": "floor-plate-layout-platemaps-numbering-system",
    "magnetic flux leakage": "magnetic-flux-leakage-platemaps",
}


class CanonicalSectionTransform(TransformComponent):
    section_aliases: dict[str, str] = SECTION_ALIASES

    def __call__(self, nodes: Sequence[BaseNode], **_: Any) -> list[BaseNode]:
        for node in nodes:
            heading_path = json.loads(str(node.metadata.get("heading_path_json", "[]")))
            heading = " ".join(str(value) for value in heading_path).lower()
            node.metadata["section_key"] = _canonical_section(heading, self.section_aliases)
        return list(nodes)


class ReportAwareChunkTransform(TransformComponent):
    max_characters: int = 4_800

    def __call__(self, nodes: Sequence[BaseNode], **_: Any) -> list[BaseNode]:
        chunks: list[TextNode] = []
        pending: list[BaseNode] = []
        pending_length = 0
        pending_section = "unclassified"

        def flush() -> None:
            nonlocal pending, pending_length, pending_section
            if not pending:
                return
            content = "\n\n".join(
                node.get_content().strip() for node in pending if node.get_content()
            )
            if content:
                chunks.append(_chunk_node(pending, content, pending_section))
            pending = []
            pending_length = 0
            pending_section = "unclassified"

        for node in nodes:
            content = node.get_content().strip()
            block_type = str(node.metadata.get("block_type", BlockType.OTHER.value))
            section = str(node.metadata.get("section_key", "unclassified"))
            isolate = block_type in {
                BlockType.TABLE.value,
                BlockType.FIGURE.value,
                BlockType.FORMULA.value,
            }
            section_changed = bool(pending) and section != pending_section
            would_overflow = bool(pending) and pending_length + len(content) > self.max_characters
            if isolate or section_changed or would_overflow:
                flush()
            if isolate:
                if content:
                    chunks.append(_chunk_node([node], content, section))
                continue
            if not pending:
                pending_section = section
            pending.append(node)
            pending_length += len(content)
        flush()
        return chunks


def build_chunks(
    document: ParsedDocument,
    *,
    max_characters: int = 4_800,
) -> tuple[ChunkRecord, ...]:
    source_nodes = [
        TextNode(
            id_=block.block_id,
            text=block.text,
            metadata={
                "document_id": document.identity.document_id,
                "case_id": document.identity.case_id,
                "source_sha256": document.identity.source_sha256,
                "report_family": document.identity.report_family,
                "dataset_split": document.identity.dataset_split.value,
                "block_type": block.block_type.value,
                "heading_path_json": json.dumps(block.heading_path),
                "page_numbers_json": json.dumps(
                    sorted(
                        {
                            span.page_number
                            for span in block.source_spans
                            if span.page_number is not None
                        }
                    )
                ),
                "source_spans_json": json.dumps(
                    [
                        {
                            "source_block_id": block.block_id,
                            "page_number": span.page_number,
                            "bbox": span.normalized_bbox,
                        }
                        for span in block.source_spans
                        if span.page_number is not None and span.normalized_bbox is not None
                    ]
                ),
            },
            excluded_embed_metadata_keys=[
                "heading_path_json",
                "page_numbers_json",
                "source_spans_json",
            ],
            excluded_llm_metadata_keys=["source_sha256", "dataset_split"],
        )
        for block in document.blocks
        if block.text.strip()
    ]
    pipeline = IngestionPipeline(
        transformations=[
            CanonicalSectionTransform(),
            ReportAwareChunkTransform(max_characters=max_characters),
        ]
    )
    chunk_nodes = pipeline.run(nodes=source_nodes, show_progress=False)
    records: list[ChunkRecord] = []
    for node in chunk_nodes:
        content = node.get_content().strip()
        metadata = dict(node.metadata)
        source_block_ids = tuple(json.loads(str(metadata.pop("source_block_ids_json"))))
        page_numbers = tuple(json.loads(str(metadata.pop("page_numbers_json", "[]"))))
        source_spans = tuple(
            ChunkSourceSpan.model_validate(value)
            for value in json.loads(str(metadata.pop("source_spans_json", "[]")))
        )
        records.append(
            ChunkRecord(
                chunk_id=node.node_id,
                document_id=document.identity.document_id,
                section_key=str(metadata.pop("section_key")),
                block_type=BlockType(str(metadata.pop("block_type"))),
                content=content,
                content_sha256=hashlib.sha256(content.encode()).hexdigest(),
                source_block_ids=source_block_ids,
                page_numbers=page_numbers,
                source_spans=source_spans,
                metadata=metadata,
            )
        )
    return tuple(records)


def _canonical_section(heading: str, aliases: dict[str, str]) -> str:
    for alias, section_key in sorted(aliases.items(), key=lambda item: len(item[0]), reverse=True):
        if alias in heading:
            return section_key
    normalized = re.sub(r"[^a-z0-9]+", "-", heading).strip("-")
    return normalized[:120] or "unclassified"


def _chunk_node(nodes: Sequence[BaseNode], content: str, section: str) -> TextNode:
    first = nodes[0]
    source_ids = [node.node_id for node in nodes]
    page_numbers = sorted(
        {
            page
            for node in nodes
            for page in json.loads(str(node.metadata.get("page_numbers_json", "[]")))
        }
    )
    source_spans = []
    seen_spans: set[str] = set()
    for node in nodes:
        for span in json.loads(str(node.metadata.get("source_spans_json", "[]"))):
            span_key = json.dumps(span, sort_keys=True)
            if span_key in seen_spans:
                continue
            seen_spans.add(span_key)
            source_spans.append(span)
    block_types = {str(node.metadata.get("block_type", BlockType.OTHER.value)) for node in nodes}
    block_type = next(iter(block_types)) if len(block_types) == 1 else BlockType.PARAGRAPH.value
    material = f"{first.metadata['document_id']}:{section}:{','.join(source_ids)}:{content}"
    return TextNode(
        id_=f"chunk_{hashlib.sha256(material.encode()).hexdigest()[:24]}",
        text=content,
        metadata={
            "document_id": first.metadata["document_id"],
            "case_id": first.metadata["case_id"],
            "source_sha256": first.metadata["source_sha256"],
            "report_family": first.metadata["report_family"],
            "dataset_split": first.metadata["dataset_split"],
            "section_key": section,
            "block_type": block_type,
            "source_block_ids_json": json.dumps(source_ids),
            "page_numbers_json": json.dumps(page_numbers),
            "source_spans_json": json.dumps(source_spans),
        },
        excluded_embed_metadata_keys=[
            "source_block_ids_json",
            "page_numbers_json",
            "source_spans_json",
        ],
        excluded_llm_metadata_keys=["source_sha256", "source_block_ids_json"],
    )
