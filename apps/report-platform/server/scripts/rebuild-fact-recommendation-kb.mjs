import { rebuildFactRecommendationKbIndex } from "../fact-recommendation-kb.mjs";

const index = rebuildFactRecommendationKbIndex();

console.log("Fact-to-recommendation KB rebuilt.");
console.log(`Built at: ${index.builtAtIso}`);
console.log(`Source chunks scanned: ${index.sourceChunkCount}`);
console.log(`Source documents scanned: ${index.sourceDocumentCount}`);
console.log(`Structured pairs: ${index.pairCount}`);
console.log(`Extraction errors: ${index.errors.length}`);

if (index.errors.length > 0) {
  for (const error of index.errors.slice(0, 12)) {
    console.warn(`- ${error.sourceReportName} / ${error.chunkId}: ${error.message}`);
  }
}
