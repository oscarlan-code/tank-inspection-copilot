import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildKbCorpusInventory,
  formatKbCorpusInventoryMarkdown,
} from "../kb-corpus-inventory.mjs";

const appRoot = fileURLToPath(new URL("../../", import.meta.url));
const sampleReportsDir = process.env.PRECEDENT_SAMPLE_REPORTS_DIR
  ?? "/Users/oscar/Public/irs/Sample Reports";
const outputPath = process.env.KB_CORPUS_INVENTORY_PATH
  ?? join(appRoot, ".data", "kb-corpus-inventory", "kb-corpus-inventory.json");
const markdownPath = outputPath.replace(/\.json$/i, ".md");

// Training-report discovery is intentionally scoped to Sample Reports only.
// Standards are governed and indexed through their separate guidance corpus.
const inventory = buildKbCorpusInventory({ sampleReportsDir });
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(inventory, null, 2));
writeFileSync(markdownPath, formatKbCorpusInventoryMarkdown(inventory));

console.log(JSON.stringify({
  outputPath,
  markdownPath,
  ...inventory.summary,
}, null, 2));
