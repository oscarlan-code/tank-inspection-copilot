from laiq_kb_ingestion.llama_pipeline import build_chunks
from laiq_kb_ingestion.models import BlockType, ParsedBlock, ParsedDocument, SourceIdentity
from laiq_kb_ingestion.source_fidelity import repair_source_fidelity, restore_unit_symbols


def test_quote_repair_requires_unique_native_context():
    text = "The buggy needs at least 3 ' of width to run properly."
    source = "The buggy needs at least 3” of width to run properly."
    repaired, changes = restore_unit_symbols(text, source)
    assert "3 ”" in repaired
    assert changes[0]["replacement"] == "”"
    assert restore_unit_symbols(text, "")[0] == text
    assert restore_unit_symbols(text, source + source)[0] == text
    assert restore_unit_symbols(text, text)[0] == text
    # A nearby but different measurement must not authorize changing the unit.
    assert restore_unit_symbols(text, source.replace("3”", "4”"))[0] == text


def test_numbered_parent_survives_unnumbered_calculation_headings():
    texts = ["4 INSPECTION REPORT", "Calculated corrosion rate:", "SHELL INTERNAL",
             "A captured shell observation.", "Roof Plate Thickness Measurements",
             "A roof observation.", "5 REPAIR RECOMMENDATIONS", "OFF-LINE"]
    blocks = tuple(ParsedBlock(
        block_id=str(i), block_type=BlockType.PARAGRAPH if i in {3, 5} else BlockType.HEADING,
        text=text, heading_path=(text,), extraction_confidence=0.99,
    ) for i, text in enumerate(texts))
    document = ParsedDocument(identity=SourceIdentity(
        case_id="test", document_id="test", rendition_id="test", source_path="/tmp/test.pdf",
        source_sha256="a" * 64, source_size_bytes=1, media_type="application/pdf",
        report_family="inspection", dataset_split="training",
    ), title="Test", parser_name="fixture", parser_version="1", page_count=2, blocks=blocks)
    repaired = repair_source_fidelity(document)
    chunks = build_chunks(repaired)
    assert len(chunks) == 2
    assert chunks[0].section_key == "inspection-report"
    assert "A roof observation." in chunks[0].content
    assert chunks[1].section_key == "repair-recommendations"
    assert document.blocks[1].heading_path == ("Calculated corrosion rate:",)
