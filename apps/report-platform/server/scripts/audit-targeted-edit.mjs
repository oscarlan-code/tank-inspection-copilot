import { createHash } from "node:crypto";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";

const reportPlatformRoot = fileURLToPath(new URL("../../", import.meta.url));
const fixturePath = join(reportPlatformRoot, "src", "fixtures", "v3-product-export-shell-internal.json");
const exportPackage = JSON.parse(readFileSync(fixturePath, "utf8"));
const fakeCliDirectory = mkdtempSync(join(tmpdir(), "laiq-targeted-edit-audit-"));
const fakeCliPath = join(fakeCliDirectory, "codex");
const fakeCliArgsPath = join(fakeCliDirectory, "codex-args.txt");

writeFileSync(
  fakeCliPath,
  `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "codex-cli 0.144.0"
  exit 0
fi
if [ -n "$TARGETED_EDIT_FAKE_DELAY_SECONDS" ]; then
  exec sleep "$TARGETED_EDIT_FAKE_DELAY_SECONDS"
fi
output=""
printf '%s' "$*" > "$TARGETED_EDIT_FAKE_ARGS_PATH"
while [ "$#" -gt 0 ]; do
  if [ "$1" = "-o" ]; then
    shift
    output="$1"
  fi
  shift
done
cat >/dev/null
printf '%s' "$TARGETED_EDIT_FAKE_RESPONSE" > "$output"
`,
  "utf8",
);
chmodSync(fakeCliPath, 0o755);
process.env.PATH = `${fakeCliDirectory}:/usr/bin:/bin`;
process.env.REPORT_PLATFORM_CODEX_MODEL = "gpt-5.6-sol";
process.env.REPORT_PLATFORM_TARGETED_EDIT_TIMEOUT_MS = "200";
process.env.REPORT_PLATFORM_CODEX_TEST_MODE = "1";
process.env.TARGETED_EDIT_FAKE_ARGS_PATH = fakeCliArgsPath;

const { generateTargetedSectionEdit } = await import("../generation.mjs");
const failures = [];
const sectionId = "inspection-report";
const sectionContent =
  '<p><span data-laiq-provenance="app_field_data">Tank V10</span> was inspected and the recorded thickness was 8.00 mm.</p><p>This paragraph must remain outside the targeted edit.</p>';
const sectionVersion = 4;
const baseSelection = {
  from: 0,
  to: 95,
  selectedText: "Tank V10 was inspected and the recorded thickness was 8.00 mm.",
  selectedHtml:
    '<p><span data-laiq-provenance="app_field_data">Tank V10</span> was inspected and the recorded thickness was 8.00 mm.</p>',
  documentHash: sha256(sectionContent),
  documentTextHash: sha256(normalizeComparableText(stripHtml(sectionContent))),
  selectionKind: "block",
  contextBefore: "",
  contextAfter: "This paragraph must remain outside the targeted edit.",
};
baseSelection.selectionHash = sha256([
  baseSelection.from,
  baseSelection.to,
  baseSelection.selectedText,
  baseSelection.selectedHtml,
].join("\n"));

function buildReportState() {
  return {
    exportPackage,
    manualSupplement: {},
    sectionDrafts: [
      {
        sectionId,
        content: sectionContent,
        generated: true,
        edited: true,
        approved: false,
        reviewRequired: true,
        version: sectionVersion,
      },
    ],
    layoutOverrides: [],
  };
}

function setWorkerResponse(value) {
  process.env.TARGETED_EDIT_FAKE_RESPONSE = JSON.stringify(value);
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function expectCode(operation, code, message) {
  try {
    await operation();
    failures.push(message);
  } catch (error) {
    assert(error?.code === code, `${message} Received ${error?.code ?? "no error code"}.`);
  }
}

await auditBrowserHashing();
await auditBrowserIds();
auditTargetedChatWiring();

try {
  setWorkerResponse({
    replacementHtml:
      '<p class="model-paragraph" style="margin: 0"><span class="model-wording" data-laiq-provenance="llm_prediction">Inspection of</span> <span class="model-fact" data-laiq-provenance="app_field_data">Tank V10</span> <span class="model-wording" data-laiq-provenance="llm_prediction">recorded a thickness of</span> <span class="model-wording" data-laiq-provenance="llm_prediction">8.00 mm</span>.</p>',
    explanation: "Rephrased only the selected report paragraph.",
    factsChanged: false,
    instructionSatisfied: true,
    warnings: [],
  });
  const proposal = await generateTargetedSectionEdit({
    reportState: buildReportState(),
    sectionId,
    request: {
      action: "rephrase",
      instruction: "",
      expectedVersion: sectionVersion,
      selection: baseSelection,
    },
  });
  assert(proposal.sectionId === sectionId, "Targeted edit proposal must stay scoped to its section.");
  assert(
    proposal.replacementHtml.includes("Tank V10") && proposal.replacementHtml.includes("8.00 mm"),
    "Targeted edit proposal must preserve selected app facts.",
  );
  assert(
    !proposal.replacementHtml.includes("outside the targeted edit"),
    "Targeted edit proposal must not include or replace unselected section content.",
  );
  assert(
    !proposal.replacementHtml.includes("class=") && !proposal.replacementHtml.includes("style="),
    "Harmless model formatting attributes must be removed from targeted edit proposals.",
  );
  assert(
    proposal.documentHash === baseSelection.documentHash &&
      proposal.selectionHash === baseSelection.selectionHash,
    "Targeted edit proposal must bind to the original document and selection hashes.",
  );
  assert(
    /model_reasoning_effort=.*low/.test(readFileSync(fakeCliArgsPath, "utf8")),
    "Targeted edits must use the low-reasoning interactive worker profile.",
  );

  setWorkerResponse({
    replacementHtml:
      '<p><span data-laiq-provenance="app_field_data">Tank V10</span> was inspected and the recorded thickness was <span data-laiq-provenance="llm_prediction">8.00 mm</span>.</p>',
    explanation: "Made only a cosmetic change.",
    factsChanged: false,
    instructionSatisfied: true,
    warnings: [],
  });
  await expectCode(
    () => generateTargetedSectionEdit({
      reportState: buildReportState(),
      sectionId,
      request: {
        action: "rephrase",
        instruction: "",
        expectedVersion: sectionVersion,
        selection: baseSelection,
      },
    }),
    "targeted_edit_rephrase_too_weak",
    "Rephrase must reject near-identical wording after its corrective retry.",
  );

  setWorkerResponse({
    replacementHtml:
      '<p><span data-laiq-provenance="app_field_data">Tank V10</span> was inspected; <span data-laiq-provenance="llm_prediction">the measured thickness remained</span> <span data-laiq-provenance="llm_prediction">8.00 mm</span>.</p>',
    explanation: "Applied the custom instruction only to the selected report paragraph.",
    factsChanged: false,
    instructionSatisfied: true,
    warnings: [],
  });
  const customProposal = await generateTargetedSectionEdit({
    reportState: buildReportState(),
    sectionId,
    request: {
      action: "custom",
      instruction: "Make this sentence more direct.",
      expectedVersion: sectionVersion,
      selection: baseSelection,
    },
  });
  assert(
    customProposal.action === "custom" && customProposal.replacementHtml.includes("Tank V10"),
    "Typed targeted-edit instructions must return a protected, selection-scoped proposal.",
  );

  const normalizedDocumentHash = sha256(`<div class="editor-normalized">${sectionContent}</div>`);
  const normalizedMarkupProposal = await generateTargetedSectionEdit({
    reportState: buildReportState(),
    sectionId,
    request: {
      action: "custom",
      instruction: "Make this sentence more direct.",
      expectedVersion: sectionVersion,
      selection: {
        ...baseSelection,
        documentHash: normalizedDocumentHash,
      },
    },
  });
  assert(
    normalizedMarkupProposal.replacementHtml.includes("Tank V10")
      && normalizedMarkupProposal.documentHash === normalizedDocumentHash,
    "Equivalent editor HTML must be accepted and remain bound to the exact client document used for Apply.",
  );

  await expectCode(
    () =>
      generateTargetedSectionEdit({
        reportState: buildReportState(),
        sectionId,
        request: {
          action: "rephrase",
          instruction: "",
          expectedVersion: sectionVersion + 1,
          selection: baseSelection,
        },
      }),
    "targeted_edit_version_conflict",
    "Stale section versions must be rejected.",
  );

  await expectCode(
    () =>
      generateTargetedSectionEdit({
        reportState: buildReportState(),
        sectionId,
        request: {
          action: "rephrase",
          instruction: "",
          expectedVersion: sectionVersion,
          selection: {
            ...baseSelection,
            documentHash: sha256("stale document"),
            documentTextHash: sha256("stale document"),
          },
        },
      }),
    "targeted_edit_document_conflict",
    "Stale document hashes must be rejected.",
  );

  const tableSelection = {
    ...baseSelection,
    selectedText: "Inspection Item",
    selectedHtml: "<table><tr><td>Inspection Item</td></tr></table>",
  };
  tableSelection.selectionHash = sha256([
    tableSelection.from,
    tableSelection.to,
    tableSelection.selectedText,
    tableSelection.selectedHtml,
  ].join("\n"));
  await expectCode(
    () =>
      generateTargetedSectionEdit({
        reportState: {
          ...buildReportState(),
          sectionDrafts: [
            {
              ...buildReportState().sectionDrafts[0],
              content: "<table><tr><td>Inspection Item</td></tr></table>",
            },
          ],
        },
        sectionId,
        request: {
          action: "rephrase",
          instruction: "",
          expectedVersion: sectionVersion,
          selection: {
            ...tableSelection,
            documentHash: sha256("<table><tr><td>Inspection Item</td></tr></table>"),
          },
        },
      }),
    "targeted_edit_table_not_supported",
    "Narrative targeted editing must reject table selections.",
  );

  setWorkerResponse({
    replacementHtml: "<p>The tank was inspected.</p>",
    explanation: "Removed details.",
    factsChanged: false,
    instructionSatisfied: true,
    warnings: [],
  });
  await expectCode(
    () =>
      generateTargetedSectionEdit({
        reportState: buildReportState(),
        sectionId,
        request: {
          action: "shorten",
          instruction: "",
          expectedVersion: sectionVersion,
          selection: baseSelection,
        },
      }),
    "targeted_edit_protected_fact_changed",
    "Targeted edits must reject removal of protected app facts.",
  );

  setWorkerResponse({
    replacementHtml: "<script>alert('unsafe')</script>",
    explanation: "Unsafe output.",
    factsChanged: false,
    instructionSatisfied: true,
    warnings: [],
  });
  await expectCode(
    () =>
      generateTargetedSectionEdit({
        reportState: buildReportState(),
        sectionId,
        request: {
          action: "rephrase",
          instruction: "",
          expectedVersion: sectionVersion,
          selection: baseSelection,
        },
      }),
    "targeted_edit_replacement_invalid",
    "Targeted edits must reject unsafe markup.",
  );

  process.env.TARGETED_EDIT_FAKE_DELAY_SECONDS = "5";
  try {
    await generateTargetedSectionEdit({
      reportState: buildReportState(),
      sectionId,
      request: {
        action: "rephrase",
        instruction: "",
        expectedVersion: sectionVersion,
        selection: baseSelection,
      },
    });
    failures.push("A stalled targeted-edit worker must not leave the request running indefinitely.");
  } catch (error) {
    assert(
      /timed out after 200ms/.test(String(error?.message ?? "")),
      "A stalled targeted-edit worker must return the configured timeout error.",
    );
  } finally {
    delete process.env.TARGETED_EDIT_FAKE_DELAY_SECONDS;
  }
} finally {
  rmSync(fakeCliDirectory, { force: true, recursive: true });
}

if (failures.length > 0) {
  console.error("Targeted editing audit failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Targeted editing audit passed.");
console.log("Checked insecure-origin browser compatibility, shared selection-chat wiring, section/selection binding, protected facts, table exclusion, worker timeout, and markup safety.");

async function auditBrowserHashing() {
  const vite = await createViteServer({
    appType: "custom",
    logLevel: "silent",
    root: reportPlatformRoot,
    server: { middlewareMode: true },
  });
  try {
    const module = await vite.ssrLoadModule("/src/lib/browserSha256.ts");
    const expected = sha256("abc");
    const fallbackHash = await module.sha256Text("abc", null);
    assert(
      fallbackHash === expected,
      "Targeted editing must compute the server-compatible SHA-256 hash on insecure HTTP origins.",
    );
    if (globalThis.crypto?.subtle) {
      const webCryptoHash = await module.sha256Text("abc", globalThis.crypto.subtle);
      assert(
        webCryptoHash === expected,
        "Targeted editing Web Crypto and portable SHA-256 paths must return the same hash.",
      );
    }
  } finally {
    await vite.close();
  }
}

async function auditBrowserIds() {
  const vite = await createViteServer({
    appType: "custom",
    logLevel: "silent",
    root: reportPlatformRoot,
    server: { middlewareMode: true },
  });
  try {
    const module = await vite.ssrLoadModule("/src/lib/browserId.ts");
    const nativeId = module.createBrowserId("native", {
      randomUUID: () => "11111111-2222-4333-8444-555555555555",
    });
    assert(
      nativeId === "native-11111111-2222-4333-8444-555555555555",
      "Secure browser origins must use native randomUUID when available.",
    );

    let byteValue = 0;
    const insecureOriginId = module.createBrowserId("http", {
      getRandomValues: (bytes) => {
        bytes.forEach((_, index) => { bytes[index] = byteValue++; });
        return bytes;
      },
    });
    assert(
      /^http-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(insecureOriginId),
      "Tailscale HTTP origins must generate portable UUIDs without crypto.randomUUID.",
    );

    const legacyId = module.createBrowserId("legacy", null);
    assert(
      /^legacy-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(legacyId),
      "Older browsers without Web Crypto must still create non-security UI correlation IDs.",
    );
  } finally {
    await vite.close();
  }
}

function auditTargetedChatWiring() {
  const appSource = readFileSync(join(reportPlatformRoot, "src", "app", "App.tsx"), "utf8");
  const editorSource = readFileSync(
    join(reportPlatformRoot, "src", "components", "RichTextSectionEditor.tsx"),
    "utf8",
  );
  const styleSource = readFileSync(join(reportPlatformRoot, "src", "styles.css"), "utf8");

  assert(
    !appSource.includes("crypto.randomUUID"),
    "Browser targeted-edit paths must not require crypto.randomUUID on Tailscale HTTP origins.",
  );

  assert(
    editorSource.includes("Continue in AI Panel") && editorSource.includes("onContinueTargetedEditInChat"),
    "Targeted editing must expose an explicit popup-to-AI-panel handoff.",
  );
  assert(
    editorSource.includes('addEventListener("pointerup", finishPointerSelection')
      && editorSource.includes("if (isPointerSelectingRef.current) return")
      && editorSource.includes("targeted-edit-menu-pointer-selecting")
      && editorSource.includes("!isPointerSelecting && !isTargetedChatHandoff"),
    "Targeted editing must wait for pointer release before opening its popup and focus backdrop.",
  );
  assert(
    appSource.includes("sendTargetedChatPrompt") && appSource.includes("handleRequestTargetedEdit"),
    "Right-panel selection chat must use the protected targeted-edit proposal path.",
  );
  assert(
    appSource.includes("Apply to Selection") && appSource.includes("externalTargetedEdit"),
    "Right-panel proposals must require explicit apply and execute through the editor selection binding.",
  );
  assert(
    styleSource.includes(".ai-command-panel-targeted")
      && styleSource.includes("grid-template-rows: auto auto auto minmax(0, 1fr) auto"),
    "Selection mode must reserve a stable right-panel row above the scrolling chat thread.",
  );
}

function sha256(value) {
  return createHash("sha256").update(String(value), "utf8").digest("hex");
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeComparableText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}
