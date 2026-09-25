import { createBaselineVariationPilot } from "../baseline-variation-pilot.mjs";
import { createS3ObjectStorage } from "../object-storage.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try{const pilot=createBaselineVariationPilot({db,objectStorage:createS3ObjectStorage()});console.log(JSON.stringify(await pilot.buildValidationPilot({sampleSize:20,seed:1}),null,2));}finally{await db.close();}
