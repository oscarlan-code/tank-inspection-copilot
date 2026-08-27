import { AsyncLocalStorage } from "node:async_hooks";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool, types } = pg;
const transactionStorage = new AsyncLocalStorage();
const migrationsDirectory = join(
  dirname(fileURLToPath(import.meta.url)),
  "migrations",
);

// Keep API timestamps stable and JSON-serializable instead of returning Date objects.
types.setTypeParser(1114, (value) => value);
types.setTypeParser(1184, (value) => value);
types.setTypeParser(20, (value) => Number(value));

export async function createPostgresDatabase({ databaseUrl }) {
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required. The report platform uses PostgreSQL as its only database.",
    );
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: positiveInteger(process.env.REPORT_PLATFORM_DB_POOL_MAX, 20),
    idleTimeoutMillis: positiveInteger(
      process.env.REPORT_PLATFORM_DB_IDLE_TIMEOUT_MS,
      30_000,
    ),
    connectionTimeoutMillis: positiveInteger(
      process.env.REPORT_PLATFORM_DB_CONNECT_TIMEOUT_MS,
      10_000,
    ),
    ssl: readSslConfiguration(),
  });

  pool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error", error);
  });

  await runMigrations(pool);

  return {
    close: () => pool.end(),
    getPoolStats: () => ({
      idleConnections: pool.idleCount,
      totalConnections: pool.totalCount,
      waitingRequests: pool.waitingCount,
    }),
    prepare(statement) {
      const sql = convertPlaceholders(statement);
      return {
        async all(...parameters) {
          const result = await query(sql, parameters);
          return result.rows;
        },
        async get(...parameters) {
          const result = await query(sql, parameters);
          return result.rows[0];
        },
        async run(...parameters) {
          return query(sql, parameters);
        },
      };
    },
    async transaction(operation) {
      const existingClient = transactionStorage.getStore();
      if (existingClient) {
        return operation();
      }

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const result = await transactionStorage.run(client, operation);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };

  function query(sql, parameters = []) {
    const client = transactionStorage.getStore();
    return (client ?? pool).query(sql, parameters);
  }
}

async function runMigrations(pool) {
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock($1)", [653_2026]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const migrations = (await readdir(migrationsDirectory))
      .filter((name) => /^\d{3}_[a-z0-9_]+\.sql$/.test(name))
      .sort();
    if (migrations.length === 0) {
      throw new Error("No PostgreSQL migrations were found.");
    }
    for (const migration of migrations) {
      const applied = await client.query(
        "SELECT version FROM schema_migrations WHERE version = $1",
        [migration],
      );
      if (applied.rowCount > 0) continue;

      const sql = await readFile(join(migrationsDirectory, migration), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          "INSERT INTO schema_migrations (version) VALUES ($1)",
          [migration],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock($1)", [653_2026]).catch(() => {});
    client.release();
  }
}

function convertPlaceholders(statement) {
  let index = 0;
  return statement.replace(/\?/g, () => `$${++index}`);
}

function readSslConfiguration() {
  const mode = String(process.env.REPORT_PLATFORM_DB_SSL ?? "prefer").toLowerCase();
  if (mode === "disable") return false;
  if (mode === "require") return { rejectUnauthorized: true };
  return process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: true }
    : false;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
