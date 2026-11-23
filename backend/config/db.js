import pg from "pg";

const { Pool } = pg;

// DATE (OID 1082): return a UTC-midnight Date so a `date` serializes to
// 'YYYY-MM-DDT00:00:00.000Z' (matching the previous SQL Server behaviour) and stays
// date-only. Without this, pg parses dates at LOCAL midnight and the serialized value can
// slip to the previous day on a non-UTC host (Tech-Backend §8).
pg.types.setTypeParser(1082, (v) => (v === null ? null : new Date(`${v}T00:00:00.000Z`)));

let poolPromise = null;

// One shared pg.Pool for the whole process, built from DATABASE_URL (Tech §2, D-016).
// Every connection is pinned to timezone=UTC so `now() at time zone 'utc'` and the
// completed_at date extraction reproduce the UTC wall-clock time model (Tech-Backend §8).
export function getPool() {
  if (!poolPromise) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      return Promise.reject(
        new Error("DATABASE_URL is not set — the backend cannot reach PostgreSQL")
      );
    }
    const pool = new Pool({ connectionString, options: "-c timezone=UTC" });
    // A single connectivity probe so boot fails fast on a bad DATABASE_URL.
    poolPromise = pool
      .query("select 1")
      .then(() => {
        console.log("✓ Connected to PostgreSQL");
        return pool;
      })
      .catch((err) => {
        poolPromise = null;
        pool.end().catch(() => {});
        throw err;
      });
  }
  return poolPromise;
}

// Closes the shared pool (used by test teardown). Safe to call when nothing connected.
export async function closePool() {
  if (!poolPromise) return;
  const pending = poolPromise;
  poolPromise = null;
  try {
    const pool = await pending;
    await pool.end();
  } catch {
    /* the pool never connected; nothing to close */
  }
}
