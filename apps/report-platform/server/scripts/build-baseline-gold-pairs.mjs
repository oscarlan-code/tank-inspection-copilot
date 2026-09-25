import { createPostgresDatabase } from "../storage/postgres.mjs";
import { createStandardizedPairBuilder } from "../standardized-pair-builder.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db = await createPostgresDatabase({ databaseUrl: process.env.DATABASE_URL });
try {
  console.log(JSON.stringify(await createStandardizedPairBuilder({ db }).buildBaselines(), null, 2));
} finally {
  await db.close();
}
