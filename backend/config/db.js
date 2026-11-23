import pg from "pg";

const { Pool } = pg;

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

// Transitional no-op kept only so the not-yet-ported controllers can still
// `import { sql } from "../config/db.js"` while R04.2 lands ahead of R04.4.
// Removed together with those imports when the queries are ported (R04.4).
export const sql = {};
