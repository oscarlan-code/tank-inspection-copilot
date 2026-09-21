"""Deterministic source repairs, never inference from historical report conventions."""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

from .models import BlockType, ParsedDocument

SOURCE_FIDELITY_VERSION = "numbered-sections-native-units-v1"
_NUMBERED_HEADING = re.compile(r"^\s*(\d+)(?:\.0)?[.)]?\s+[A-Za-z]")
_TOKENS = re.compile(r"\d+(?:\.\d+)?|[^\W\d_]+|[\"'“”‘’′″]", re.UNICODE)
_QUOTES = set('\"\'“”‘’′″')


def native_pdf_pages(source: Path) -> dict[int, str]:
    """Read the PDF text layer independently; absent text never authorizes repair."""
    if source.suffix.lower() != ".pdf" or not shutil.which("pdftotext"):
        return {}
    result = subprocess.run(
        ["pdftotext", "-layout", str(source), "-"], capture_output=True, text=True,
        timeout=120, check=False,
    )
    if result.returncode:
        return {}
    return dict(enumerate(result.stdout.split("\f"), 1))


def restore_unit_symbols(text: str, native_text: str) -> tuple[str, list[dict]]:
    """Change only numeric quote symbols with unique matching local source context."""
    tokens = list(_TOKENS.finditer(text))
    native = list(_TOKENS.finditer(native_text))
    normalized = ["QUOTE" if t.group() in _QUOTES else t.group().lower() for t in tokens]
    native_normalized = [
        "QUOTE" if t.group() in _QUOTES else t.group().lower() for t in native
    ]
    repairs = []
    for index, token in enumerate(tokens):
        if token.group() not in _QUOTES or index == 0:
            continue
        if not re.fullmatch(r"\d+(?:\.\d+)?", tokens[index - 1].group()):
            continue
        start, end = max(0, index - 4), min(len(tokens), index + 5)
        context = normalized[start:end]
        if len(context) < 5:
            continue
        matches = [
            offset for offset in range(len(native) - len(context) + 1)
            if native_normalized[offset:offset + len(context)] == context
        ]
        if len(matches) != 1:
            continue
        replacement = native[matches[0] + index - start].group()
        if replacement != token.group():
            repairs.append({"start": token.start(), "end": token.end(),
                            "original": token.group(), "replacement": replacement})
    for repair in reversed(repairs):
        text = text[:repair["start"]] + repair["replacement"] + text[repair["end"]:]
    return text, repairs


def repair_source_fidelity(
    document: ParsedDocument, native_pages: dict[int, str] | None = None,
) -> ParsedDocument:
    """Return a new parsed rendition, preserving source IDs and repair provenance."""
    native_pages = native_pages or {}
    blocks = []
    anchor = None
    for block in document.blocks:
        text = block.text
        path = list(block.heading_path)
        metadata = dict(block.metadata)
        if block.block_type == BlockType.HEADING:
            numbered = _NUMBERED_HEADING.match(text)
            if numbered:
                anchor = text.strip()
            if anchor:
                path = [anchor] + [part for part in path if part != anchor]
        elif anchor:
            path = [anchor] + [part for part in path if part != anchor]
        pages = sorted({s.page_number for s in block.source_spans if s.page_number})
        native_text = "\n".join(native_pages.get(page, "") for page in pages)
        text, repairs = restore_unit_symbols(text, native_text)
        if repairs:
            metadata["native_unit_symbol_repairs"] = repairs
        if path != list(block.heading_path):
            metadata["original_heading_path"] = list(block.heading_path)
        if anchor:
            metadata["numbered_section_anchor"] = anchor
        blocks.append(block.model_copy(update={"text": text, "heading_path": tuple(path),
                                              "metadata": metadata}))
    return document.model_copy(update={"blocks": tuple(blocks), "diagnostics": {
        **document.diagnostics, "source_fidelity_version": SOURCE_FIDELITY_VERSION,
        "native_unit_verification_available": bool(native_pages),
    }})
