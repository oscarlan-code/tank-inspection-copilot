import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";

type RequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

async function readJsonBody(req: IncomingMessage) {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function importFreshModule(modulePath: string) {
  const moduleUrl = new URL(`file://${modulePath}`);
  moduleUrl.searchParams.set("t", String(Date.now()));
  return import(moduleUrl.href);
}

function createHandler(repoRoot: string): RequestHandler {
  return async (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method not allowed");
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const modulePath = path.join(repoRoot, "apps/report-platform/server/runCodexBrain.mjs");
      const { runCodexBrain } = await importFreshModule(modulePath);
      const result = await runCodexBrain(payload, { repoRoot });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          provider: "mock",
          message: error instanceof Error ? error.message : "Unknown Codex worker error",
        }),
      );
    }
  };
}

function createFeedbackHandler(repoRoot: string): RequestHandler {
  return async (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method not allowed");
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const modulePath = path.join(repoRoot, "apps/report-platform/server/runCodexBrain.mjs");
      const { storeSectionFeedback } = await importFreshModule(modulePath);
      const result = await storeSectionFeedback(payload, { repoRoot });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          stored: false,
          message: error instanceof Error ? error.message : "Unknown feedback storage error",
        }),
      );
    }
  };
}

function createLogicFeedbackHandler(repoRoot: string): RequestHandler {
  return async (req, res) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      res.end("Method not allowed");
      return;
    }

    try {
      const payload = await readJsonBody(req);
      const modulePath = path.join(repoRoot, "apps/report-platform/server/runCodexBrain.mjs");
      const { storeSectionLogicFeedback } = await importFreshModule(modulePath);
      const result = await storeSectionLogicFeedback(payload, { repoRoot });
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          ok: false,
          stored: false,
          message: error instanceof Error ? error.message : "Unknown logic feedback storage error",
        }),
      );
    }
  };
}

export function reportBrainDevPlugin(): Plugin {
  return {
    name: "report-brain-dev-plugin",
    configureServer(server) {
      const repoRoot = server.config.root;
      const handler = createHandler(repoRoot);
      const feedbackHandler = createFeedbackHandler(repoRoot);
      const logicFeedbackHandler = createLogicFeedbackHandler(repoRoot);
      server.middlewares.use("/api/report-brain/run", (req, res, next) => {
        void handler(req, res);
      });
      server.middlewares.use("/api/report-brain/feedback", (req, res, next) => {
        void feedbackHandler(req, res);
      });
      server.middlewares.use("/api/report-brain/logic-feedback", (req, res, next) => {
        void logicFeedbackHandler(req, res);
      });
    },
  };
}
