ALTER TABLE kb_chunks
  ADD COLUMN stable_order INTEGER;

WITH ordered_chunks AS (
  SELECT
    chunk_id,
    ROW_NUMBER() OVER (
      PARTITION BY document_id
      ORDER BY created_at_iso, chunk_id
    ) AS assigned_order
  FROM kb_chunks
)
UPDATE kb_chunks AS chunk
SET stable_order = ordered.assigned_order
FROM ordered_chunks AS ordered
WHERE chunk.chunk_id = ordered.chunk_id;

ALTER TABLE kb_chunks
  ALTER COLUMN stable_order SET NOT NULL,
  ADD CONSTRAINT kb_chunks_stable_order_positive CHECK (stable_order > 0),
  ADD CONSTRAINT kb_chunks_document_stable_order_unique UNIQUE (document_id, stable_order);

CREATE INDEX idx_kb_chunks_document_order
  ON kb_chunks (document_id, stable_order);
