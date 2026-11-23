import { describe, it, expect, beforeAll, afterAll } from "vitest";
import supertest from "supertest";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { app } from "../app.js";
import { getPool, closePool } from "../config/db.js";

// PRD §4.3–§4.11 task surface, §4.13 missing `today`, §7 isolation; DB §6 dashboard cases.
const TODAY = "2026-01-15";
const TOMORROW = "2026-01-16";

// One user per read-only scenario group so seeds never collide, plus A/B for isolation.
const users = {
  dash: randomUUID(),
  list: randomUUID(),
  a: randomUUID(),
  b: randomUUID(),
};
const tokens = {};

const day = (v) => new Date(v).toISOString().slice(0, 10);
const api = (user) => ({
  get: (url, query) =>
    supertest(app).get(url).query(query || {}).set("Cookie", `jwt=${tokens[user]}`),
  post: (url, body) =>
    supertest(app).post(url).send(body).set("Cookie", `jwt=${tokens[user]}`),
  put: (url, body) =>
    supertest(app).put(url).send(body || {}).set("Cookie", `jwt=${tokens[user]}`),
  del: (url) => supertest(app).delete(url).set("Cookie", `jwt=${tokens[user]}`),
});

// Inserts a task row directly and returns its id.
async function seedTask(userId, t) {
  const id = randomUUID();
  const pool = await getPool();
  await pool.query(
    `INSERT INTO tasks (id, user_id, title, due_date, priority, status, is_deleted, completed_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      userId,
      t.title,
      t.due_date,
      t.priority || "medium",
      t.status || "pending",
      t.is_deleted ? true : false,
      t.completed_at ? new Date(t.completed_at) : null,
      new Date(t.created_at || "2026-01-01T00:00:00.000Z"),
    ]
  );
  return id;
}

async function dbRow(id) {
  const pool = await getPool();
  const r = await pool.query(
    `SELECT user_id, title, status, is_deleted, completed_at FROM tasks WHERE id = $1`,
    [id]
  );
  return r.rows[0];
}

const idsOf = (rows) => rows.map((r) => r.id.toLowerCase());
const titlesOf = (rows) => rows.map((r) => r.title);

describe("task surface", () => {
  beforeAll(async () => {
    const pool = await getPool();
    await pool.query(`
      DROP TABLE IF EXISTS tasks    CASCADE;
      DROP TABLE IF EXISTS profiles CASCADE;
    `);
    await pool.query(`
      CREATE TABLE profiles (
        id         uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        first_name varchar(100) NOT NULL,
        last_name  varchar(100) NOT NULL,
        email      varchar(255) NOT NULL UNIQUE,
        password   varchar(255) NOT NULL,
        created_at timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc')
      );
    `);
    await pool.query(`
      CREATE TABLE tasks (
        id           uuid         NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
        user_id      uuid         NOT NULL,
        title        varchar(255) NOT NULL,
        description  text         NULL,
        due_date     date         NOT NULL,
        priority     varchar(10)  NOT NULL DEFAULT 'medium'
                       CHECK (priority IN ('low','medium','high')),
        status       varchar(10)  NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','completed')),
        is_deleted   boolean      NOT NULL DEFAULT false,
        completed_at timestamptz  NULL,
        created_at   timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
        updated_at   timestamptz  NOT NULL DEFAULT (now() AT TIME ZONE 'utc'),
        CONSTRAINT "FK_tasks_profiles" FOREIGN KEY (user_id) REFERENCES profiles(id)
      );
    `);

    for (const [name, id] of Object.entries(users)) {
      await pool.query(
        `INSERT INTO profiles (id, first_name, last_name, email, password)
         VALUES ($1, 'Test', 'User', $2, 'hashed')`,
        [id, `${name}@lazaros.dev`]
      );
      tokens[name] = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: "1d" });
    }
  });

  afterAll(async () => {
    const pool = await getPool();
    await pool.query(`
      DROP TABLE IF EXISTS tasks    CASCADE;
      DROP TABLE IF EXISTS profiles CASCADE;
    `);
    await closePool();
  });

  // ------------------------------------------------ Dashboard (DB §6, PRD §4.7/§4.8)
  describe("dashboard classification (one case per DB §6 row)", () => {
    beforeAll(async () => {
      const u = users.dash;
      await seedTask(u, { title: "overdue-pending", due_date: "2026-01-13" });
      await seedTask(u, { title: "due-today-pending", due_date: TODAY });
      await seedTask(u, { title: "future-pending", due_date: "2026-01-20" });
      await seedTask(u, {
        title: "completed-today",
        due_date: TODAY,
        status: "completed",
        completed_at: "2026-01-15T10:00:00.000Z",
      });
      await seedTask(u, {
        title: "completed-earlier",
        due_date: "2026-01-10",
        status: "completed",
        completed_at: "2026-01-14T10:00:00.000Z",
      });
      await seedTask(u, {
        title: "completed-later",
        due_date: TODAY,
        status: "completed",
        completed_at: "2026-01-16T10:00:00.000Z",
      });
    });

    it("overdue pending (due_date < today) is in Overdue with the exact day diff", async () => {
      const res = await api("dash").get("/api/tasks/dashboard", { today: TODAY });
      expect(res.status).toBe(200);
      expect(titlesOf(res.body.overdue)).toEqual(["overdue-pending"]);
      expect(res.body.overdue[0].days_overdue).toBe(2);
    });

    it("due-today pending (due_date = today) is in Today with days_overdue 0", async () => {
      const res = await api("dash").get("/api/tasks/dashboard", { today: TODAY });
      expect(titlesOf(res.body.today)).toEqual(["due-today-pending"]);
      expect(res.body.today[0].days_overdue).toBe(0);
    });

    it("future pending (due_date > today) is excluded from every bucket", async () => {
      const res = await api("dash").get("/api/tasks/dashboard", { today: TODAY });
      const all = [...res.body.overdue, ...res.body.today, ...res.body.completed_today];
      expect(titlesOf(all)).not.toContain("future-pending");
    });

    it("completed today (CAST(completed_at AS DATE) = today) is in Completed Today", async () => {
      const res = await api("dash").get("/api/tasks/dashboard", { today: TODAY });
      expect(titlesOf(res.body.completed_today)).toEqual(["completed-today"]);
    });

    it("completed earlier and completed later are excluded", async () => {
      const res = await api("dash").get("/api/tasks/dashboard", { today: TODAY });
      const all = [...res.body.overdue, ...res.body.today, ...res.body.completed_today];
      expect(titlesOf(all)).not.toContain("completed-earlier");
      expect(titlesOf(all)).not.toContain("completed-later");
    });

    it("returns exactly the three buckets with the expected row counts", async () => {
      const res = await api("dash").get("/api/tasks/dashboard", { today: TODAY });
      expect(Object.keys(res.body).sort()).toEqual(["completed_today", "overdue", "today"]);
      expect(res.body.overdue).toHaveLength(1);
      expect(res.body.today).toHaveLength(1);
      expect(res.body.completed_today).toHaveLength(1);
    });

    it("overdue persistence (PRD §4.8): still Overdue the next day with a bigger badge", async () => {
      const d1 = await api("dash").get("/api/tasks/dashboard", { today: TODAY });
      const d2 = await api("dash").get("/api/tasks/dashboard", { today: TOMORROW });
      expect(titlesOf(d1.body.overdue)).toContain("overdue-pending");
      expect(titlesOf(d2.body.overdue)).toContain("overdue-pending");
      const next = d2.body.overdue.find((t) => t.title === "overdue-pending");
      expect(next.days_overdue).toBe(3);
      expect(day(next.due_date)).toBe("2026-01-13");
    });
  });

  // ------------------------------------------------ All tasks / Upcoming
  describe("list endpoints", () => {
    beforeAll(async () => {
      const u = users.list;
      await seedTask(u, { title: "late", due_date: "2026-03-01", created_at: "2026-01-01T00:00:00Z" });
      await seedTask(u, { title: "soon", due_date: "2026-01-20", created_at: "2026-01-02T00:00:00Z" });
      await seedTask(u, { title: "mid", due_date: "2026-02-01", created_at: "2026-01-03T00:00:00Z" });
      await seedTask(u, { title: "past", due_date: "2026-01-05" });
      await seedTask(u, { title: "today", due_date: TODAY });
      await seedTask(u, {
        title: "done-future",
        due_date: "2026-02-10",
        status: "completed",
        completed_at: "2026-01-15T09:00:00Z",
      });
      await seedTask(u, { title: "deleted-future", due_date: "2026-01-25", is_deleted: true });
      // Same due_date, different created_at: created_at ASC is the PRD tiebreak.
      await seedTask(u, { title: "tie-first", due_date: "2026-06-01", created_at: "2026-01-01T00:00:00Z" });
      await seedTask(u, { title: "tie-second", due_date: "2026-06-01", created_at: "2026-01-02T00:00:00Z" });
    });

    it("All tasks (PRD §4.10): non-deleted only, ordered by due_date ascending", async () => {
      const res = await api("list").get("/api/tasks");
      expect(res.status).toBe(200);
      expect(titlesOf(res.body)).not.toContain("deleted-future");
      expect(res.body).toHaveLength(8);
      const dates = res.body.map((t) => day(t.due_date));
      expect(dates).toEqual([...dates].sort());
    });

    it("All tasks: equal due_date rows are ordered by created_at ascending", async () => {
      const res = await api("list").get("/api/tasks");
      const titles = titlesOf(res.body);
      expect(titles.indexOf("tie-first")).toBeLessThan(titles.indexOf("tie-second"));
    });

    it("Upcoming (PRD §4.9): only pending with due_date > today, ordered by due_date", async () => {
      const res = await api("list").get("/api/tasks/upcoming", { today: TODAY });
      expect(res.status).toBe(200);
      // soon (01-20), mid (02-01), late (03-01), then the two 06-01 ties in unspecified order.
      expect(titlesOf(res.body).slice(0, 3)).toEqual(["soon", "mid", "late"]);
      expect(titlesOf(res.body).slice(3).sort()).toEqual(["tie-first", "tie-second"]);
      const dates = res.body.map((t) => day(t.due_date));
      expect(dates).toEqual([...dates].sort());
    });

    it("Upcoming excludes overdue, due-today, completed and soft-deleted rows", async () => {
      const res = await api("list").get("/api/tasks/upcoming", { today: TODAY });
      for (const t of ["past", "today", "done-future", "deleted-future"]) {
        expect(titlesOf(res.body)).not.toContain(t);
      }
    });
  });

  // ------------------------------------------------ Create / edit
  describe("create and edit", () => {
    it("create stamps user_id from the session, never from the body (PRD §7)", async () => {
      const bogus = randomUUID();
      const res = await api("a").post("/api/tasks", {
        title: "Created",
        due_date: TODAY,
        priority: "low",
        user_id: bogus,
      });
      expect(res.status).toBe(201);
      expect(res.body.user_id.toLowerCase()).toBe(users.a.toLowerCase());
      expect(res.body.user_id.toLowerCase()).not.toBe(bogus.toLowerCase());
      expect(res.body.title).toBe("Created");
      const row = await dbRow(res.body.id);
      expect(row.user_id.toLowerCase()).toBe(users.a.toLowerCase());
    });

    it("edit pending -> completed sets completed_at; completed -> pending nulls it", async () => {
      const id = await seedTask(users.a, { title: "toggle", due_date: TODAY });

      const done = await api("a").put(`/api/tasks/${id}`, { status: "completed" });
      expect(done.status).toBe(200);
      expect(done.body.status).toBe("completed");
      expect(done.body.completed_at).not.toBeNull();
      expect(Number.isNaN(new Date(done.body.completed_at).getTime())).toBe(false);
      expect((await dbRow(id)).completed_at).not.toBeNull();

      const undone = await api("a").put(`/api/tasks/${id}`, { status: "pending" });
      expect(undone.status).toBe(200);
      expect(undone.body.status).toBe("pending");
      expect(undone.body.completed_at).toBeNull();
      expect((await dbRow(id)).completed_at).toBeNull();
    });
  });

  // ------------------------------------------------ Soft delete / restore / archive
  describe("soft delete, restore and archive", () => {
    it("delete keeps the row, hides it from All tasks, lists it in Archive; restore reverses", async () => {
      const id = await seedTask(users.a, { title: "to-archive", due_date: TODAY });
      const lid = id.toLowerCase();

      const del = await api("a").del(`/api/tasks/${id}`);
      expect(del.status).toBe(200);
      const row = await dbRow(id);
      expect(row).toBeDefined();
      expect(row.is_deleted).toBe(true);

      const all = await api("a").get("/api/tasks");
      expect(idsOf(all.body)).not.toContain(lid);
      const arch = await api("a").get("/api/tasks/archive");
      expect(idsOf(arch.body)).toContain(lid);

      const restored = await api("a").put(`/api/tasks/${id}/restore`);
      expect(restored.status).toBe(200);
      expect((await dbRow(id)).is_deleted).toBe(false);

      const all2 = await api("a").get("/api/tasks");
      expect(idsOf(all2.body)).toContain(lid);
      const arch2 = await api("a").get("/api/tasks/archive");
      expect(idsOf(arch2.body)).not.toContain(lid);
    });

    it("Archive lists only soft-deleted rows", async () => {
      await seedTask(users.a, { title: "live-one", due_date: TODAY });
      await seedTask(users.a, { title: "archived-one", due_date: TODAY, is_deleted: true });
      const res = await api("a").get("/api/tasks/archive");
      expect(res.status).toBe(200);
      expect(titlesOf(res.body)).toContain("archived-one");
      expect(titlesOf(res.body)).not.toContain("live-one");
    });

    it("a soft-deleted task is 404 to edit and to complete; restore brings it back", async () => {
      const id = await seedTask(users.a, { title: "gone", due_date: TODAY, is_deleted: true });

      const edit = await api("a").put(`/api/tasks/${id}`, { title: "renamed" });
      expect(edit.status).toBe(404);
      const complete = await api("a").put(`/api/tasks/${id}`, { status: "completed" });
      expect(complete.status).toBe(404);
      const row = await dbRow(id);
      expect(row.title).toBe("gone");
      expect(row.status).toBe("pending");

      expect((await api("a").put(`/api/tasks/${id}/restore`)).status).toBe(200);
      const after = await api("a").put(`/api/tasks/${id}`, { status: "completed" });
      expect(after.status).toBe(200);
    });
  });

  // ------------------------------------------------ Isolation (PRD §7)
  describe("data isolation", () => {
    let live;
    let archived;
    beforeAll(async () => {
      live = await seedTask(users.a, { title: "A-live", due_date: "2026-01-13" });
      archived = await seedTask(users.a, { title: "A-archived", due_date: TODAY, is_deleted: true });
    });

    it("user B gets 404 (not 403) editing, deleting or restoring user A's tasks", async () => {
      expect((await api("b").put(`/api/tasks/${live}`, { title: "hijack" })).status).toBe(404);
      expect((await api("b").put(`/api/tasks/${live}`, { status: "completed" })).status).toBe(404);
      expect((await api("b").del(`/api/tasks/${live}`)).status).toBe(404);
      expect((await api("b").put(`/api/tasks/${archived}/restore`)).status).toBe(404);

      const liveRow = await dbRow(live);
      expect(liveRow.title).toBe("A-live");
      expect(liveRow.status).toBe("pending");
      expect(liveRow.is_deleted).toBe(false);
      expect((await dbRow(archived)).is_deleted).toBe(true);
    });

    it("every list for user B excludes user A's rows", async () => {
      const aIds = [live, archived].map((i) => i.toLowerCase());
      const [all, up, arch, dash] = await Promise.all([
        api("b").get("/api/tasks"),
        api("b").get("/api/tasks/upcoming", { today: "2000-01-01" }),
        api("b").get("/api/tasks/archive"),
        api("b").get("/api/tasks/dashboard", { today: TODAY }),
      ]);
      const seen = [
        ...idsOf(all.body),
        ...idsOf(up.body),
        ...idsOf(arch.body),
        ...idsOf(dash.body.overdue),
        ...idsOf(dash.body.today),
        ...idsOf(dash.body.completed_today),
      ];
      for (const id of aIds) expect(seen).not.toContain(id);
      expect(all.body).toHaveLength(0);
      expect(arch.body).toHaveLength(0);
    });
  });

  // ------------------------------------------------ Failure paths (PRD §4.13)
  describe("missing today", () => {
    it("dashboard without `today` is 400", async () => {
      expect((await api("a").get("/api/tasks/dashboard")).status).toBe(400);
    });
    it("upcoming without `today` is 400", async () => {
      expect((await api("a").get("/api/tasks/upcoming")).status).toBe(400);
    });
  });
});
