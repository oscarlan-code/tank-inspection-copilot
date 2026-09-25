import { createMatchedBaselineCohortService } from "../matched-baseline-cohort.mjs";
import { createPostgresDatabase } from "../storage/postgres.mjs";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
const db=await createPostgresDatabase({databaseUrl:process.env.DATABASE_URL});
try {
  const service=createMatchedBaselineCohortService({db});
  const groupCount=Number(process.env.PILOT_TRAINING_GROUP_COUNT??100);
  const evaluationGroupCount=Number(process.env.PILOT_EVALUATION_GROUP_COUNT??20);
  const seed=Number(process.env.PILOT_COHORT_SEED??1);
  const sectionIds=String(process.env.PILOT_SECTION_IDS??"").split(",").map((item)=>item.trim()).filter(Boolean);
  console.log(JSON.stringify(await service.build({groupCount,evaluationGroupCount,seed,sectionIds}),null,2));
  console.log(JSON.stringify(await service.getStatus(),null,2));
} finally { await db.close(); }
