import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const appRoot = join(__dirname, "..", "..");
const strict = process.env.STRICT_SAMPLE_LEAK === "1";

const scannedFiles = [
  "src/fixtures/v2-product-export-shell-internal.json",
  "src/fixtures/v3-product-export-shell-internal.json",
  "src/domain/reportToc.ts",
  "src/domain/mockReport.ts",
  "src/app/App.tsx",
  "server/report-toc.mjs",
  "server/generation.mjs",
  "server/docx-export.mjs",
].map((relativePath) => join(appRoot, relativePath));

const restrictedIdentifiers = [
  joinText("22", "PE1-4"),
  joinText("18", "PE1-5"),
  joinText("23", "PE1-3"),
  joinText("Pacific ", "Energy SWP Ltd"),
  joinText("Pacific ", "Energy SWP"),
  joinText("Pacific ", "Energy"),
  joinText("Vu", "da Terminal"),
  joinText("Vu", "da, Fiji"),
];

const restrictedLongPhrases = [
  joinText("TK V10 Internal", " & External Inspection Report"),
  joinText("Internal & External Inspection Report", " (Post Blast)"),
  joinText("Pacific ", "Energy Fieldsheet (Fullscope)"),
];

const findings = [];

for (const filePath of scannedFiles) {
  const text = readFileSync(filePath, "utf8");
  const relativePath = filePath.slice(appRoot.length + 1);

  for (const restrictedText of [...restrictedIdentifiers, ...restrictedLongPhrases]) {
    let index = text.indexOf(restrictedText);

    while (index !== -1) {
      findings.push({
        file: relativePath,
        restrictedText,
        line: lineNumberAt(text, index),
      });
      index = text.indexOf(restrictedText, index + restrictedText.length);
    }
  }
}

if (findings.length > 0) {
  console.error(`Sample-report leak audit found ${findings.length} restricted hit${findings.length === 1 ? "" : "s"}.`);

  for (const finding of findings.slice(0, 80)) {
    console.error(`- ${finding.file}:${finding.line} contains "${finding.restrictedText}"`);
  }

  if (strict) {
    process.exit(1);
  }

  console.warn("STRICT_SAMPLE_LEAK is not enabled, so this run is advisory only.");
} else {
  console.log("Sample-report leak audit passed: no restricted sample identifiers found in report-generation surfaces.");
}

function lineNumberAt(text, offset) {
  return text.slice(0, offset).split("\n").length;
}

function joinText(...parts) {
  return parts.join("");
}
