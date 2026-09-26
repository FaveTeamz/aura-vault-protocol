import pg from "pg";

const { Pool } = pg;

/** Shared PostgreSQL connection pool used by database backed services. */
export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.parseInt(process.env.PG_POOL_MAX ?? "10", 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
