from __future__ import annotations

import hashlib
import importlib.metadata
import mimetypes
import re
import subprocess
import tempfile
from pathlib import Path
from typing import Any

from .models import (
    BlockType,
    DatasetAssignment,
    DatasetSplit,
    ParsedBlock,
    ParsedDocument,
    SourceIdentity,
    SourceSpan,
)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for block in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def build_source_identity(
    source: Path,
    *,
    case_id: str | None,
    document_id: str | None,
    rendition_id: str | None,
    report_family: str,
    dataset_split: str,
    dataset_group_key: str | None,
    source_object_key: str | None,
    tenant_id: str | None,
    workspace_id: str | None,
    visibility_code: str,
) -> SourceIdentity:
    source = source.resolve()
    source_hash = sha256_file(source)
    short_hash = source_hash[:20]
    resolved_case_id = case_id or f"case_{short_hash}"
    resolved_group_key = dataset_group_key or _default_dataset_group_key(source, resolved_case_id)
    automatic_assignment = dataset_split == "auto"
    return SourceIdentity(
        case_id=resolved_case_id,
        document_id=document_id or f"doc_{short_hash}",
        rendition_id=rendition_id or f"rendition_{short_hash}",
        source_path=str(source),
        source_sha256=source_hash,
        source_size_bytes=source.stat().st_size,
        media_type=mimetypes.guess_type(source.name)[0] or "application/octet-stream",
        source_object_key=source_object_key,
        report_family=_resolve_report_family(source, report_family),
        dataset_split=(
            automatic_dataset_split(resolved_group_key)
            if automatic_assignment
            else DatasetSplit(dataset_split)
        ),
        dataset_assignment=(
            DatasetAssignment.AUTOMATIC if automatic_assignment else DatasetAssignment.EXPLICIT
        ),
        dataset_group_key=resolved_group_key,
        tenant_id=tenant_id,
        workspace_id=workspace_id,
        visibility_code=visibility_code,
    )


def automatic_dataset_split(group_key: str) -> DatasetSplit:
    material = f"laiq-dataset-split-v1:{group_key.strip().lower()}"
    bucket = int(hashlib.sha256(material.encode()).hexdigest()[:8], 16) % 100
    if bucket < 70:
        return DatasetSplit.TRAINING
    if bucket < 85:
        return DatasetSplit.VALIDATION
    return DatasetSplit.HIDDEN_TEST


def _default_dataset_group_key(source: Path, case_id: str) -> str:
    report_reference = re.match(r"^\s*([0-9]{2}[a-z]{2,5}[0-9]+-[0-9]+)", source.stem.lower())
    return report_reference.group(1) if report_reference else case_id


def _resolve_report_family(source: Path, requested_family: str) -> str:
    if requested_family.strip().lower() not in {"", "auto", "unclassified"}:
        return requested_family.strip()
    name = source.stem.lower()
    if "profile assessment" in name or "3d scan" in name:
        return "profile_3d_scan"
    if "magnetic flux" in name or re.search(r"\bmfl\b", name):
        return "mfl_floor_assessment"
    if "internal" in name and "external" in name:
        return "api653_internal_external"
    if "internal" in name:
        return "api653_internal"
    if "external" in name:
        return "api653_external"
    return "historical_inspection_report"


class DoclingExtractor:
    parser_name = "docling"

    def __init__(self, *, enable_ocr: bool = True, enable_tables: bool = True) -> None:
        self.enable_ocr = enable_ocr
        self.enable_tables = enable_tables

    def extract(self, source: Path, identity: SourceIdentity) -> ParsedDocument:
        from docling.datamodel.base_models import InputFormat
        from docling.datamodel.pipeline_options import HeadingHierarchyOptions, PdfPipelineOptions
        from docling.document_converter import DocumentConverter, PdfFormatOption

        conversion_source = source
        temporary_directory: tempfile.TemporaryDirectory[str] | None = None
        try:
            if source.suffix.lower() == ".rtf":
                temporary_directory = tempfile.TemporaryDirectory(prefix="laiq-kb-rtf-")
                conversion_source = Path(temporary_directory.name) / f"{source.stem}.docx"
                subprocess.run(
                    [
                        "/usr/bin/textutil",
                        "-convert",
                        "docx",
                        "-output",
                        str(conversion_source),
                        str(source),
                    ],
                    check=True,
                    capture_output=True,
                    text=True,
                )

            if conversion_source.suffix.lower() == ".pdf":
                pdf_options = PdfPipelineOptions(
                    do_ocr=self.enable_ocr,
                    do_table_structure=self.enable_tables,
                    heading_hierarchy_options=HeadingHierarchyOptions(enabled=True),
                )
                converter = DocumentConverter(
                    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pdf_options)}
                )
            else:
                converter = DocumentConverter()
            result = converter.convert(conversion_source)
        finally:
            temporary_directory and temporary_directory.cleanup()
        document = result.document
        pages = getattr(document, "pages", {}) or {}
        blocks: list[ParsedBlock] = []
        heading_path: list[str] = []

        for index, (item, tree_level) in enumerate(document.iterate_items()):
            label = _label_value(getattr(item, "label", "other"))
            block_type = _block_type(label)
            text = _item_text(item, document, block_type)
            if not text and block_type not in {BlockType.FIGURE, BlockType.TABLE}:
                continue

            heading_level = None
            if block_type == BlockType.HEADING:
                heading_level = _heading_level(item, tree_level)
                heading_path = heading_path[: max(0, heading_level - 1)]
                heading_path.append(text.strip())

            spans = tuple(_source_spans(getattr(item, "prov", ()) or (), pages))
            block_id = _stable_block_id(identity.source_sha256, index, text, block_type)
            blocks.append(
                ParsedBlock(
                    block_id=block_id,
                    block_type=block_type,
                    text=text.strip(),
                    heading_path=tuple(heading_path),
                    heading_level=heading_level,
                    source_spans=spans,
                    extraction_confidence=_estimate_confidence(block_type, text, spans),
                    metadata={"docling_label": label, "tree_level": tree_level},
                )
            )

        status = getattr(result, "status", None)
        return ParsedDocument(
            identity=identity,
            title=getattr(document, "name", None) or source.stem,
            parser_name=self.parser_name,
            parser_version=importlib.metadata.version("docling"),
            page_count=len(pages),
            blocks=tuple(blocks),
            diagnostics={
                "conversion_status": _label_value(status) if status is not None else "unknown",
                "ocr_enabled": self.enable_ocr,
                "table_structure_enabled": self.enable_tables,
            },
        )


def _label_value(label: Any) -> str:
    return str(getattr(label, "value", label)).lower().replace("-", "_")


def _block_type(label: str) -> BlockType:
    if "section_header" in label or label in {"title", "heading"}:
        return BlockType.HEADING
    if "list_item" in label:
        return BlockType.LIST_ITEM
    if "table" in label:
        return BlockType.TABLE
    if "picture" in label or "figure" in label:
        return BlockType.FIGURE
    if "caption" in label:
        return BlockType.CAPTION
    if "formula" in label:
        return BlockType.FORMULA
    if label in {"text", "paragraph"}:
        return BlockType.PARAGRAPH
    return BlockType.OTHER


def _item_text(item: Any, document: Any, block_type: BlockType) -> str:
    text = getattr(item, "text", None)
    if isinstance(text, str) and text.strip():
        return text
    if block_type == BlockType.TABLE:
        for exporter in ("export_to_markdown", "export_to_html"):
            method = getattr(item, exporter, None)
            if callable(method):
                try:
                    return str(method(document))
                except (TypeError, ValueError):
                    continue
    return ""


def _heading_level(item: Any, tree_level: int) -> int:
    value = getattr(item, "level", None)
    if isinstance(value, int) and value > 0:
        return min(value, 12)
    return min(max(int(tree_level or 1), 1), 12)


def _source_spans(provenance: Any, pages: Any) -> list[SourceSpan]:
    spans: list[SourceSpan] = []
    for entry in provenance:
        page_number = getattr(entry, "page_no", None)
        bbox_value = getattr(entry, "bbox", None)
        bbox = None
        normalized_bbox = None
        if bbox_value is not None:
            values = [getattr(bbox_value, key, None) for key in ("l", "t", "r", "b")]
            if all(isinstance(value, (int, float)) for value in values):
                bbox = tuple(float(value) for value in values)
                page = pages.get(page_number) if hasattr(pages, "get") else None
                size = getattr(page, "size", None)
                width = getattr(size, "width", None)
                height = getattr(size, "height", None)
                has_page_size = (
                    isinstance(width, (int, float))
                    and width > 0
                    and isinstance(height, (int, float))
                    and height > 0
                )
                if has_page_size:
                    left, top, right, bottom = bbox
                    origin = str(
                        getattr(
                            getattr(bbox_value, "coord_origin", None),
                            "value",
                            "TOPLEFT",
                        )
                    )
                    if origin.upper() == "BOTTOMLEFT":
                        top, bottom = height - top, height - bottom
                    normalized_bbox = (
                        _clamp(left / width),
                        _clamp(min(top, bottom) / height),
                        _clamp(right / width),
                        _clamp(max(top, bottom) / height),
                    )
        spans.append(
            SourceSpan(
                page_number=page_number,
                bbox=bbox,
                normalized_bbox=normalized_bbox,
            )
        )
    return spans


def _clamp(value: float) -> float:
    return min(max(float(value), 0.0), 1.0)


def _estimate_confidence(
    block_type: BlockType,
    text: str,
    spans: tuple[SourceSpan, ...],
) -> float:
    if block_type == BlockType.TABLE and not text:
        return 0.35
    if block_type == BlockType.FIGURE:
        return 0.90
    if not text.strip():
        return 0.25
    confidence = 0.94
    if len(text.strip()) < 3:
        confidence -= 0.18
    if spans:
        confidence += 0.04
    return min(max(confidence, 0), 0.99)


def _stable_block_id(
    source_sha256: str,
    index: int,
    text: str,
    block_type: BlockType,
) -> str:
    material = f"{source_sha256}:{index}:{block_type.value}:{text}".encode()
    return f"block_{hashlib.sha256(material).hexdigest()[:24]}"
