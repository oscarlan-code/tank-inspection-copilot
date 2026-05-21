import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { constants } from "node:fs";

async function readJsonStore(filePath) {
  try {
    await access(filePath, constants.F_OK);
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeJsonStore(filePath, nextStore) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(nextStore, null, 2));
}

function getSectionFeedbackStorePath(repoRoot) {
  return path.join(repoRoot, "apps/report-platform/skills/report-section-copilot/references/section-feedback.json");
}

function getSectionLogicFeedbackStorePath(repoRoot) {
  return path.join(repoRoot, "apps/report-platform/skills/report-section-copilot/references/section-logic-feedback.json");
}

export async function storeSectionFeedback(feedback, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const feedbackStorePath = getSectionFeedbackStorePath(repoRoot);
  const store = await readJsonStore(feedbackStorePath);
  const currentItems = Array.isArray(store[feedback.sectionId]) ? store[feedback.sectionId] : [];
  const nextItems = [
    ...currentItems,
    {
      capturedAtIso: new Date().toISOString(),
      sectionId: feedback.sectionId,
      sectionTitle: feedback.sectionTitle,
      rating: feedback.rating,
      draft: feedback.draft,
      userComment: feedback.userComment ?? "",
      confirmedUnderstanding: feedback.confirmedUnderstanding ?? "",
    },
  ].slice(-16);
  await writeJsonStore(feedbackStorePath, {
    ...store,
    [feedback.sectionId]: nextItems,
  });
  return {
    ok: true,
    stored: true,
  };
}

export async function storeSectionLogicFeedback(feedback, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const logicStorePath = getSectionLogicFeedbackStorePath(repoRoot);
  const store = await readJsonStore(logicStorePath);
  const currentItems = Array.isArray(store[feedback.sectionId]) ? store[feedback.sectionId] : [];
  const nextItems = [
    ...currentItems,
    {
      capturedAtIso: new Date().toISOString(),
      approvalState: "active_dev",
      sectionId: feedback.sectionId,
      sectionTitle: feedback.sectionTitle,
      draft: feedback.draft ?? "",
      userComment: feedback.userComment,
      confirmedRule: feedback.confirmedRule,
      governanceNote:
        "In the future multi-tenant product, this type of durable logic change must be approved by a platform admin before activation.",
    },
  ].slice(-24);
  await writeJsonStore(logicStorePath, {
    ...store,
    [feedback.sectionId]: nextItems,
  });
  return {
    ok: true,
    stored: true,
  };
}

export async function runCodexBrain(payload, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const tempDir = await mkdtemp(path.join(tmpdir(), "report-brain-"));
  const bundleDir = path.join(tempDir, "bundle");
  await mkdir(bundleDir, { recursive: true });

  const files = {
    activeSection: path.join(bundleDir, "active-section.json"),
    sectionPlan: path.join(bundleDir, "section-plan.json"),
    sourcePackage: path.join(bundleDir, "source-package.json"),
    checklist: path.join(bundleDir, "checklist.json"),
    referenceBundle: path.join(bundleDir, "reference-bundle.json"),
    workspaceMeta: path.join(bundleDir, "workspace-meta.json"),
    currentDraft: path.join(bundleDir, "current-section-draft.md"),
    userInput: path.join(bundleDir, "user-input.json"),
    sectionFeedback: path.join(bundleDir, "section-feedback.json"),
    sectionLogicFeedback: path.join(bundleDir, "section-logic-feedback.json"),
    output: path.join(bundleDir, "brain-output.json"),
  };

  const sectionFeedbackStorePath = getSectionFeedbackStorePath(repoRoot);
  const sectionLogicFeedbackStorePath = getSectionLogicFeedbackStorePath(repoRoot);
  const sectionFeedbackStore = await readJsonStore(sectionFeedbackStorePath);
  const sectionLogicFeedbackStore = await readJsonStore(sectionLogicFeedbackStorePath);
  const activeSectionFeedback = Array.isArray(sectionFeedbackStore[payload.section.id])
    ? sectionFeedbackStore[payload.section.id].slice(-6)
    : [];
  const activeSectionLogicFeedback = Array.isArray(sectionLogicFeedbackStore[payload.section.id])
    ? sectionLogicFeedbackStore[payload.section.id]
        .filter((item) => item?.approvalState === "active_dev" || item?.approvalState === "approved")
        .slice(-8)
    : [];

  await writeFile(files.activeSection, JSON.stringify(payload.section, null, 2));
  await writeFile(files.sectionPlan, JSON.stringify(payload.sectionPlan ?? [], null, 2));
  await writeFile(files.sourcePackage, JSON.stringify(payload.workspace.sourcePackage, null, 2));
  await writeFile(files.checklist, JSON.stringify(payload.checklist, null, 2));
  await writeFile(files.referenceBundle, JSON.stringify(payload.referenceBundle, null, 2));
  await writeFile(files.workspaceMeta, JSON.stringify(payload.workspace.workspaceMeta, null, 2));
  await writeFile(files.currentDraft, payload.section.draft ?? "");
  await writeFile(files.sectionFeedback, JSON.stringify(activeSectionFeedback, null, 2));
  await writeFile(files.sectionLogicFeedback, JSON.stringify(activeSectionLogicFeedback, null, 2));
  await writeFile(
    files.userInput,
    JSON.stringify(
      {
        userPrompt: payload.userPrompt ?? "",
        selectedSectionId: payload.section.id,
        requestedAction: payload.action.label,
        refinementFeedback: payload.refinementFeedback ?? null,
      },
      null,
      2,
    ),
  );

  const skillPath = path.join(repoRoot, "apps/report-platform/skills/report-section-copilot/SKILL.md");
  const sectionRulesPath = path.join(
    repoRoot,
    "apps/report-platform/skills/report-section-copilot/references/sections.md",
  );
  const sectionPromptProfilesPath = path.join(
    repoRoot,
    "apps/report-platform/skills/report-section-copilot/references/section-prompts.md",
  );
  const sampleFormatPath = path.join(repoRoot, "apps/report-platform/references/tk-465-structure.md");
  const apiGuardRailPath = path.join(repoRoot, "apps/report-platform/references/api-inspection-guardrails.md");
  const outputSchemaPath = path.join(repoRoot, "apps/report-platform/brain/section-output.schema.json");

  const prompt = `
You are the report-section-copilot worker for a tank inspection report platform.

Work only on the active section. Read these files first:
- ${skillPath}
- ${sectionRulesPath}
- ${sectionPromptProfilesPath}
- ${sampleFormatPath}
- ${apiGuardRailPath}
- ${files.activeSection}
- ${files.sectionPlan}
- ${files.referenceBundle}
- ${files.sourcePackage}
- ${files.checklist}
- ${files.workspaceMeta}
- ${files.currentDraft}
- ${files.userInput}
- ${files.sectionFeedback}
- ${files.sectionLogicFeedback}

Task:
- section: ${payload.section.templateSection} ${payload.section.title}
- requested action: ${payload.action.label}
- action effect: ${payload.action.effect}
- action instruction: ${payload.action.instruction}
${payload.userPrompt ? `- user prompt: ${payload.userPrompt}` : ""}

Rules:
- stay inside the active section only
- follow the sample report order and tone
- follow the active section prompt profile exactly when it defines a list, caption, placeholder, or calculation shape
- follow the API guard rails and the section skill rules
- treat the confirmed section-logic-feedback notes as durable generation logic for this section whenever they do not conflict with captured facts or hard report guard rails
- use the confirmed section-feedback notes only as local reviewer preferences for this section; preserve patterns that received thumbs up and avoid patterns that received thumbs down
- never use section-feedback notes as a reason to invent unsupported facts
- if the section is blocked or manual-only, say so clearly instead of inventing content
- keep the response concise and report-focused
- if the action effect is "understand", do not change the draft; instead, explain your understanding of the requested change, note any pushback or ambiguity, and say what you will change after confirmation
- if the action effect is "refine", use the current draft plus the confirmed user refinement note to rewrite only this section
- if the action effect is "compare" or "missing", keep the current draft unchanged and use assistantMessage for the comparison or missing-input result

Return JSON that matches the provided output schema.
`.trim();

  const args = [
    "exec",
    "-C",
    bundleDir,
    "--skip-git-repo-check",
    "--ephemeral",
    "--output-schema",
    outputSchemaPath,
    "--output-last-message",
    files.output,
    "-s",
    "read-only",
    "--add-dir",
    repoRoot,
    "-",
  ];

  const result = await new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stderr = "";
    let stdout = "";
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Codex worker timed out while drafting the active section."));
    }, 12000);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", async (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr || stdout || `codex exec exited with code ${code}`));
        return;
      }
      try {
        const text = await readFile(files.output, "utf8");
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error);
      }
    });
    child.stdin.write(prompt);
    child.stdin.end();
  });

  await rm(tempDir, { recursive: true, force: true });
  return {
    ok: true,
    provider: "codex-cli",
    ...result,
  };
}
