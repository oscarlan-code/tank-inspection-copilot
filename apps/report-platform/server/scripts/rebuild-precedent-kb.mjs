import { rebuildPrecedentKbIndex } from "../precedent-kb.mjs";

const index = rebuildPrecedentKbIndex({
  onDocument(event) {
    if (event.status === "completed") {
      console.error(`indexed: ${event.fileName} (${event.pageCount} pages, ${event.chunkCount} chunks)`);
    }
    if (event.status === "failed") {
      console.error(`failed: ${event.fileName} (${event.message})`);
    }
    if (event.status === "writing_index") {
      console.error(`writing index: ${event.fileName} (${event.pageCount} pages, ${event.chunkCount} chunks)`);
    }
    if (event.status === "completed_index") {
      console.error(`completed index: ${event.fileName}`);
    }
  },
});

console.log(JSON.stringify({
  builtAtIso: index.builtAtIso,
  sampleReportsDir: index.sampleReportsDir,
  standardsCodesDir: index.standardsCodesDir,
  documentCount: index.documents.length,
  sampleReportCount: index.documents.filter((document) => document.sourceType === "sample_pdf").length,
  standardsDocumentCount: index.documents.filter((document) => document.sourceType === "code_pdf").length,
  pageCount: index.pageCount,
  chunkCount: index.chunks.length,
  errorCount: index.errors.length,
}, null, 2));

process.exit(index.errors.length > 0 ? 1 : 0);
