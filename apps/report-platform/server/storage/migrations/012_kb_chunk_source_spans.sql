ALTER TABLE kb_chunks
  ADD COLUMN source_spans_json JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX idx_kb_chunks_source_pages
  ON kb_chunks USING GIN (source_spans_json jsonb_path_ops);
