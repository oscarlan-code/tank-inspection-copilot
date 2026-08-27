import { randomUUID } from "node:crypto";
import { createReportStore } from "../store.mjs";
import {
  hashPassword,
  validatePassword,
  validateUsername,
} from "../auth/password-auth.mjs";

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  printUsage();
  process.exit(0);
}

const required = ["tenantId", "tenantName", "workspaceId", "workspaceName", "displayName", "username"];
const missing = required.filter((key) => !options[key]);
if (missing.length > 0) {
  printUsage();
  throw new Error(`Missing required options: ${missing.join(", ")}.`);
}

const password = await readPassword();
validatePassword(password);
const reportStore = await createReportStore({ databaseUrl: process.env.DATABASE_URL });

try {
  const account = await reportStore.bootstrapInitialSuperAdmin({
    displayName: options.displayName,
    passwordHash: await hashPassword(password),
    tenantId: options.tenantId,
    tenantName: options.tenantName,
    userId: options.userId || randomUUID(),
    usernameNormalized: validateUsername(options.username),
    workspaceId: options.workspaceId,
    workspaceName: options.workspaceName,
  });
  process.stdout.write(
    `Initial Super Admin created: ${account.displayName} (${account.username}) in ${account.tenantName} / ${account.workspaceName}.\n`,
  );
} finally {
  await reportStore.close();
}

function parseArguments(args) {
  const parsed = {
    displayName: "",
    help: false,
    tenantId: "",
    tenantName: "",
    userId: "",
    username: "",
    workspaceId: "",
    workspaceName: "",
  };
  const optionMap = {
    "--display-name": "displayName",
    "--tenant-id": "tenantId",
    "--tenant-name": "tenantName",
    "--user-id": "userId",
    "--username": "username",
    "--workspace-id": "workspaceId",
    "--workspace-name": "workspaceName",
  };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--help" || value === "-h") parsed.help = true;
    const key = optionMap[value];
    if (key) parsed[key] = args[index + 1] ?? "";
  }
  return parsed;
}

async function readPassword() {
  const environmentPassword = process.env.REPORT_PLATFORM_ACCOUNT_PASSWORD;
  if (environmentPassword) return environmentPassword;
  if (process.stdin.isTTY) {
    throw new Error(
      "Provide the password through standard input or REPORT_PLATFORM_ACCOUNT_PASSWORD. Standard input is recommended so the password is not stored in shell history.",
    );
  }
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8").replace(/[\r\n]+$/, "");
}

function printUsage() {
  process.stdout.write(`Usage:
  printf '%s' '<password>' | npm run account:bootstrap-admin -- \\
    --tenant-id <tenant-id> --tenant-name '<tenant-name>' \\
    --workspace-id <workspace-id> --workspace-name '<workspace-name>' \\
    --display-name '<admin-name>' --username <username> [--user-id <user-id>]

This command works only before the first password account exists. Afterward,
create and manage accounts through the Super Admin UI.
`);
}
