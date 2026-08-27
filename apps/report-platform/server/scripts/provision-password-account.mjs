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
if (!options.userId || !options.username) {
  printUsage();
  throw new Error("Both --user-id and --username are required.");
}

const password = await readPassword();
validatePassword(password);
const usernameNormalized = validateUsername(options.username);
const reportStore = await createReportStore({ databaseUrl: process.env.DATABASE_URL });

try {
  const principal = await reportStore.getUserPrincipal(options.userId);
  if (!principal) {
    throw new Error(
      `Platform user ${options.userId} does not exist or is inactive. Provision the tenant/workspace user before creating credentials.`,
    );
  }
  await reportStore.upsertPasswordCredential({
    passwordHash: await hashPassword(password),
    userId: options.userId,
    usernameNormalized,
  });
  process.stdout.write(
    `Password account provisioned for ${principal.displayName}: ${usernameNormalized}. Existing sessions for this user were revoked.\n`,
  );
} finally {
  await reportStore.close();
}

function parseArguments(args) {
  const parsed = { help: false, userId: "", username: "" };
  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--help" || value === "-h") parsed.help = true;
    if (value === "--user-id") parsed.userId = args[index + 1] ?? "";
    if (value === "--username") parsed.username = args[index + 1] ?? "";
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
  printf '%s' '<password>' | npm run account:provision -- --user-id <platform-user-id> --username <username>

The password must contain 12-128 characters. Only its scrypt hash is stored.
`);
}
