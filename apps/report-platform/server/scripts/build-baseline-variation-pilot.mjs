import { createBaselineVariationPilot } from "../baseline-variation-pilot.mjs";
import { createS3ObjectStorage } from "../object-storage.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{
  const pilot=createBaselineVariationPilot({db,objectStorage:createS3ObjectStorage()});
  const sampleSize=Number(process.env.PILOT_VARIATION_SAMPLE_SIZE??100);
  const seed=Number(process.env.PILOT_VARIATION_SEED??1);
  const allProfiles=String(process.env.PILOT_ALL_PROFILES??"true").toLowerCase()!=="false";
  console.log(JSON.stringify(await pilot.buildPilot({sampleSize,seed,allProfiles}),null,2));
  console.log(JSON.stringify(await pilot.getStatus(),null,2));
}finally{await db.close();}
