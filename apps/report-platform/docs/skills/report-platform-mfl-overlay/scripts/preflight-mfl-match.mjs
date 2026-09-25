#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  inspectMflPlateMetadata,
  validateMflLayoutMatch,
} from "../../../../server/floor-corrosion.mjs";

const options = parseArguments(process.argv.slice(2));

try {
  if (!options.layout || !options.mfl) {
    throw new Error("--layout and --mfl are required.");
  }

  const layoutPath = resolve(options.layout);
  const mflPath = resolve(options.mfl);
  if (!existsSync(layoutPath)) throw new Error(`Layout JSON was not found: ${layoutPath}`);
  if (!existsSync(mflPath)) throw new Error(`MFL PDF was not found: ${mflPath}`);

  const payload = JSON.parse(readFileSync(layoutPath, "utf8"));
  const layoutMap = payload.layoutMap ?? payload;
  const placementPayload = options.placements
    ? JSON.parse(readFileSync(resolve(options.placements), "utf8"))
    : [];
  const placements = placementPayload.placements ?? placementPayload;
  const metadataManifest = inspectMflPlateMetadata({ pdfPath: mflPath });
  const result = validateMflLayoutMatch({
    layoutMap,
    metadataManifest,
    placements,
    requireCompleteCoverage: !options.allowPartial,
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`MFL preflight failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

function parseArguments(args) {
  const parsed = {
    layout: null,
    mfl: null,
    placements: null,
    allowPartial: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--allow-partial") {
      parsed.allowPartial = true;
      continue;
    }
    if (["--layout", "--mfl", "--placements"].includes(argument)) {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path.`);
      parsed[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return parsed;
}
