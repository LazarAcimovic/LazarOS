import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { app } from "../app.js";
import { getPool, sql } from "../config/db.js";

// PRD §4.1 register, §4.2 login, §4.12 logout, §4.13 protect failures, §7 password never leaves.
const PASSWORD = "Valid1Pass!";
const user = {
  first_name: "Auth",
  last_name: "Tester",
  email: "auth-tester@lazaros.dev",
  password: PASSWORD,
};

const request = () => supertest(app);
const jwtCookie = (res) =>
  (res.headers["set-cookie"] || []).find((c) => c.startsWith("jwt="));

describe("auth surface", () => {
  beforeAll(async () => {
    const pool = await getPool();
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
  });

  afterAll(async () => {
    const pool = await getPool();
    await pool.request().query(`
      IF OBJECT_ID('dbo.profiles', 'U') IS NOT NULL DROP TABLE dbo.profiles;
    `);
    await sql.close();
  });

  describe("POST /api/auth/register", () => {
    it("creates the user, sets an httpOnly SameSite=Strict jwt cookie, omits password", async () => {
      const res = await request().post("/api/auth/register").send(user);
      expect(res.status).toBe(201);
      expect(res.body.email).toBe(user.email);
      expect(res.body.first_name).toBe(user.first_name);
      expect(res.body).not.toHaveProperty("password");

      const cookie = jwtCookie(res);
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
    });

    it("rejects a duplicate email with 400 Email already in use", async () => {
      const res = await request().post("/api/auth/register").send(user);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe("Email already in use");
    });

    it("rejects an invalid email with 400", async () => {
      const res = await request()
        .post("/api/auth/register")
        .send({ ...user, email: "not-an-email" });
      expect(res.status).toBe(400);
    });

    it("rejects a too-short password with 400", async () => {
      const res = await request()
        .post("/api/auth/register")
        .send({ ...user, email: "short@lazaros.dev", password: "Ab1!" });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/auth/login", () => {
    it("logs in with the registered password, sets the cookie, omits password", async () => {
      const res = await request()
        .post("/api/auth/login")
        .send({ email: user.email, password: PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(user.email);
      expect(res.body).not.toHaveProperty("password");
      expect(jwtCookie(res)).toBeDefined();
    });

    it("returns the identical 401 for unknown email and wrong password (no enumeration)", async () => {
      const unknown = await request()
        .post("/api/auth/login")
        .send({ email: "nobody@lazaros.dev", password: PASSWORD });
      const wrong = await request()
        .post("/api/auth/login")
        .send({ email: user.email, password: "Wrong1Pass!" });

      expect(unknown.status).toBe(401);
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(wrong.status);
      expect(unknown.body.message).toBe("Invalid email or password");
      expect(wrong.body.message).toBe(unknown.body.message);
    });
  });

  describe("GET /api/auth/me and protect", () => {
    let loginCookie;

    beforeAll(async () => {
      const res = await request()
        .post("/api/auth/login")
        .send({ email: user.email, password: PASSWORD });
      loginCookie = jwtCookie(res).split(";")[0];
    });

    it("returns the current user without password for a valid cookie", async () => {
      const res = await request().get("/api/auth/me").set("Cookie", loginCookie);
      expect(res.status).toBe(200);
      expect(res.body.email).toBe(user.email);
      expect(res.body).not.toHaveProperty("password");
    });

    it("401 when the token is missing", async () => {
      const res = await request().get("/api/auth/me");
      expect(res.status).toBe(401);
    });

    it("401 when the token is malformed", async () => {
      const res = await request().get("/api/auth/me").set("Cookie", "jwt=not.a.jwt");
      expect(res.status).toBe(401);
    });

    it("401 when the token is valid but the user no longer exists", async () => {
      const ghost = jwt.sign({ userId: randomUUID() }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      const res = await request().get("/api/auth/me").set("Cookie", `jwt=${ghost}`);
      expect(res.status).toBe(401);
    });

    it("logout clears the jwt cookie and a following protected request is 401", async () => {
      const out = await request().post("/api/auth/logout").set("Cookie", loginCookie);
      expect(out.status).toBe(200);
      const cleared = jwtCookie(out);
      expect(cleared).toBeDefined();
      // Cleared cookie: empty value and an expiry in the past.
      expect(cleared).toMatch(/^jwt=;/);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/i);

      // A client honouring the clearing sends no jwt cookie afterwards.
      const after = await request().get("/api/auth/me");
      expect(after.status).toBe(401);
    });
  });
});
