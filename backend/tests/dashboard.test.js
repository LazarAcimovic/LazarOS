import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { app } from "../app.js";
import { getPool, closePool } from "../config/db.js";
import { resetSchema } from "./setup/resetSchema.js";

// Fixed reference date for all assertions in this suite.
const TODAY = "2026-01-15";
// 2 days before TODAY — DATEDIFF(DAY, due_date, @today) must equal 2.
const OVERDUE_DATE = "2026-01-13";
// A UTC datetime whose CAST(... AS DATE) equals TODAY.
const COMPLETED_AT = new Date("2026-01-15T10:00:00.000Z");

describe("GET /api/tasks/dashboard", () => {
  const userId = randomUUID();
  let token;

  beforeAll(async () => {
    const pool = await getPool();

    // Reset to the migrated schema so the test always starts clean (code-first, D-019).
    await resetSchema(pool);

    // Test user
    await pool.query(
      `INSERT INTO profiles (id, first_name, last_name, email, password)
       VALUES ($1, 'Test', 'User', 'test@lazaros.dev', 'hashed')`,
      [userId]
    );

    // Overdue: pending, due_date = OVERDUE_DATE (2 days before TODAY)
    await pool.query(
      `INSERT INTO tasks (user_id, title, due_date, priority, status)
       VALUES ($1, 'Overdue task', $2, 'high', 'pending')`,
      [userId, OVERDUE_DATE]
    );

    // Today: pending, due_date = TODAY
    await pool.query(
      `INSERT INTO tasks (user_id, title, due_date, priority, status)
       VALUES ($1, 'Today task', $2, 'medium', 'pending')`,
      [userId, TODAY]
    );

    // Completed today: completed, (completed_at AT TIME ZONE 'utc')::date = TODAY
    await pool.query(
      `INSERT INTO tasks (user_id, title, due_date, priority, status, completed_at)
       VALUES ($1, 'Completed today task', $2, 'low', 'completed', $3)`,
      [userId, TODAY, COMPLETED_AT]
    );

    token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
  });

  afterAll(async () => {
    const pool = await getPool();
    await pool.query(`
      DROP TABLE IF EXISTS tasks    CASCADE;
      DROP TABLE IF EXISTS profiles CASCADE;
    `);
    await closePool();
  });

  it("returns three buckets with correct counts and days_overdue", async () => {
    const res = await supertest(app)
      .get("/api/tasks/dashboard")
      .query({ today: TODAY })
      .set("Cookie", `jwt=${token}`);

    expect(res.status).toBe(200);
    expect(res.body.overdue).toHaveLength(1);
    expect(res.body.today).toHaveLength(1);
    expect(res.body.completed_today).toHaveLength(1);

    expect(res.body.overdue[0].title).toBe("Overdue task");
    expect(res.body.overdue[0].days_overdue).toBe(2);

    expect(res.body.today[0].title).toBe("Today task");

    expect(res.body.completed_today[0].title).toBe("Completed today task");
  });
});
