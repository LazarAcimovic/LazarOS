import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { app } from "../app.js";
import { getPool, sql } from "../config/db.js";

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

    // Drop and recreate tables so the test always starts clean.
    await pool.request().query(`
      IF OBJECT_ID('dbo.tasks',    'U') IS NOT NULL DROP TABLE dbo.tasks;
      IF OBJECT_ID('dbo.profiles', 'U') IS NOT NULL DROP TABLE dbo.profiles;
    `);

    await pool.request().query(`
      CREATE TABLE profiles (
        id         UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        first_name VARCHAR(100)     NOT NULL,
        last_name  VARCHAR(100)     NOT NULL,
        email      VARCHAR(255)     NOT NULL UNIQUE,
        password   VARCHAR(255)     NOT NULL,
        created_at DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME()
      );
    `);

    await pool.request().query(`
      CREATE TABLE tasks (
        id           UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        user_id      UNIQUEIDENTIFIER NOT NULL,
        title        VARCHAR(255)     NOT NULL,
        description  VARCHAR(MAX)     NULL,
        due_date     DATE             NOT NULL,
        priority     VARCHAR(10)      NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low','medium','high')),
        status       VARCHAR(10)      NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','completed')),
        is_deleted   BIT              NOT NULL DEFAULT 0,
        completed_at DATETIME2        NULL,
        created_at   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at   DATETIME2        NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT FK_tasks_profiles FOREIGN KEY (user_id) REFERENCES profiles(id)
      );
    `);

    // Test user
    await pool
      .request()
      .input("id", sql.UniqueIdentifier, userId)
      .query(`
        INSERT INTO profiles (id, first_name, last_name, email, password)
        VALUES (@id, 'Test', 'User', 'test@lazaros.dev', 'hashed')
      `);

    // Overdue: pending, due_date = OVERDUE_DATE (2 days before TODAY)
    await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("due_date", sql.Date, OVERDUE_DATE)
      .query(`
        INSERT INTO tasks (user_id, title, due_date, priority, status)
        VALUES (@user_id, 'Overdue task', @due_date, 'high', 'pending')
      `);

    // Today: pending, due_date = TODAY
    await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("due_date", sql.Date, TODAY)
      .query(`
        INSERT INTO tasks (user_id, title, due_date, priority, status)
        VALUES (@user_id, 'Today task', @due_date, 'medium', 'pending')
      `);

    // Completed today: completed, CAST(completed_at AS DATE) = TODAY
    await pool
      .request()
      .input("user_id", sql.UniqueIdentifier, userId)
      .input("due_date", sql.Date, TODAY)
      .input("completed_at", sql.DateTime2, COMPLETED_AT)
      .query(`
        INSERT INTO tasks (user_id, title, due_date, priority, status, completed_at)
        VALUES (@user_id, 'Completed today task', @due_date, 'low', 'completed', @completed_at)
      `);

    token = jwt.sign(
      { userId },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
  });

  afterAll(async () => {
    const pool = await getPool();
    await pool.request().query(`
      IF OBJECT_ID('dbo.tasks',    'U') IS NOT NULL DROP TABLE dbo.tasks;
      IF OBJECT_ID('dbo.profiles', 'U') IS NOT NULL DROP TABLE dbo.profiles;
    `);
    await sql.close();
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
