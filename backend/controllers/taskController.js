import asyncHandler from "../middleware/asyncHandler.js";
import { getPool, sql } from "../config/db.js";
import { createTaskSchema, updateTaskSchema } from "../validation/taskSchemas.js";

// @desc   Get dashboard (overdue, today, completed today)
// @route  GET /api/tasks/dashboard?today=YYYY-MM-DD
// @access Private
export const getDashboard = asyncHandler(async (req, res) => {
  const today = req.query.today;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    res.status(400);
    throw new Error("Query param 'today' (YYYY-MM-DD) is required");
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input("user_id", sql.UniqueIdentifier, req.user.id)
    .input("today", sql.Date, today)
    .query(`
      SELECT
        id, title, description, due_date, priority, status,
        completed_at, created_at, updated_at,
        CASE
          WHEN status = 'pending' AND due_date < @today THEN 'overdue'
          WHEN status = 'pending' AND due_date = @today THEN 'today'
          WHEN status = 'completed' AND CAST(completed_at AS DATE) = @today THEN 'completed_today'
          ELSE 'other'
        END AS section,
        DATEDIFF(DAY, due_date, @today) AS days_overdue
      FROM tasks
      WHERE user_id = @user_id
        AND is_deleted = 0
        AND (
          (status = 'pending' AND due_date <= @today)
          OR
          (status = 'completed' AND CAST(completed_at AS DATE) = @today)
        )
      ORDER BY
        CASE
          WHEN status = 'pending' AND due_date < @today THEN 0
          WHEN status = 'pending' AND due_date = @today THEN 1
          ELSE 2
        END,
        due_date ASC,
        priority DESC
    `);

  const overdue = result.recordset.filter((t) => t.section === "overdue");
  const todayTasks = result.recordset.filter((t) => t.section === "today");
  const completedToday = result.recordset.filter(
    (t) => t.section === "completed_today"
  );

  res.json({ overdue, today: todayTasks, completed_today: completedToday });
});

// @desc   Get all tasks (non-deleted)
// @route  GET /api/tasks
// @access Private
export const getAllTasks = asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("user_id", sql.UniqueIdentifier, req.user.id)
    .query(`
      SELECT id, title, description, due_date, priority, status,
             completed_at, created_at, updated_at
      FROM tasks
      WHERE user_id = @user_id AND is_deleted = 0
      ORDER BY due_date ASC, created_at ASC
    `);

  res.json(result.recordset);
});

// @desc   Get upcoming tasks (future pending, grouped by date)
// @route  GET /api/tasks/upcoming?today=YYYY-MM-DD
// @access Private
export const getUpcoming = asyncHandler(async (req, res) => {
  const today = req.query.today;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    res.status(400);
    throw new Error("Query param 'today' (YYYY-MM-DD) is required");
  }

  const pool = await getPool();
  const result = await pool
    .request()
    .input("user_id", sql.UniqueIdentifier, req.user.id)
    .input("today", sql.Date, today)
    .query(`
      SELECT id, title, description, due_date, priority, status,
             completed_at, created_at, updated_at
      FROM tasks
      WHERE user_id = @user_id
        AND is_deleted = 0
        AND status = 'pending'
        AND due_date > @today
      ORDER BY due_date ASC, priority DESC
    `);

  res.json(result.recordset);
});

// @desc   Get archived tasks (soft-deleted)
// @route  GET /api/tasks/archive
// @access Private
export const getArchive = asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("user_id", sql.UniqueIdentifier, req.user.id)
    .query(`
      SELECT id, title, description, due_date, priority, status,
             completed_at, created_at, updated_at
      FROM tasks
      WHERE user_id = @user_id AND is_deleted = 1
      ORDER BY updated_at DESC
    `);

  res.json(result.recordset);
});

// @desc   Create a task
// @route  POST /api/tasks
// @access Private
export const createTask = asyncHandler(async (req, res) => {
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400);
    throw new Error(parsed.error.errors[0].message);
  }
  const { title, description, due_date, priority } = parsed.data;

  const pool = await getPool();
  const result = await pool
    .request()
    .input("user_id", sql.UniqueIdentifier, req.user.id)
    .input("title", sql.VarChar, title)
    .input("description", sql.VarChar, description ?? null)
    .input("due_date", sql.Date, due_date)
    .input("priority", sql.VarChar, priority)
    .query(`
      INSERT INTO tasks (user_id, title, description, due_date, priority)
      OUTPUT INSERTED.id, INSERTED.user_id, INSERTED.title, INSERTED.description,
             INSERTED.due_date, INSERTED.priority, INSERTED.status,
             INSERTED.is_deleted, INSERTED.completed_at, INSERTED.created_at, INSERTED.updated_at
      VALUES (@user_id, @title, @description, @due_date, @priority)
    `);

  res.status(201).json(result.recordset[0]);
});

// @desc   Update a task
// @route  PUT /api/tasks/:id
// @access Private
export const updateTask = asyncHandler(async (req, res) => {
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400);
    throw new Error(parsed.error.errors[0].message);
  }

  const pool = await getPool();

  // Verify ownership
  const existing = await pool
    .request()
    .input("id", sql.UniqueIdentifier, req.params.id)
    .input("user_id", sql.UniqueIdentifier, req.user.id)
    .query(
      "SELECT id, status FROM tasks WHERE id = @id AND user_id = @user_id AND is_deleted = 0"
    );

  if (existing.recordset.length === 0) {
    res.status(404);
    throw new Error("Task not found");
  }

  const current = existing.recordset[0];
  const data = parsed.data;

  // Determine completed_at
  let completedAtClause = "";
  if (data.status === "completed" && current.status !== "completed") {
    completedAtClause = ", completed_at = SYSUTCDATETIME()";
  } else if (data.status === "pending" && current.status === "completed") {
    completedAtClause = ", completed_at = NULL";
  }

  const req2 = pool.request();
  req2.input("id", sql.UniqueIdentifier, req.params.id);
  req2.input("user_id", sql.UniqueIdentifier, req.user.id);

  const sets = ["updated_at = SYSUTCDATETIME()"];
  if (data.title !== undefined) {
    req2.input("title", sql.VarChar, data.title);
    sets.push("title = @title");
  }
  if ("description" in data) {
    req2.input("description", sql.VarChar, data.description ?? null);
    sets.push("description = @description");
  }
  if (data.due_date !== undefined) {
    req2.input("due_date", sql.Date, data.due_date);
    sets.push("due_date = @due_date");
  }
  if (data.priority !== undefined) {
    req2.input("priority", sql.VarChar, data.priority);
    sets.push("priority = @priority");
  }
  if (data.status !== undefined) {
    req2.input("status", sql.VarChar, data.status);
    sets.push("status = @status");
  }

  const result = await req2.query(`
    UPDATE tasks
    SET ${sets.join(", ")}${completedAtClause}
    OUTPUT INSERTED.id, INSERTED.user_id, INSERTED.title, INSERTED.description,
           INSERTED.due_date, INSERTED.priority, INSERTED.status,
           INSERTED.is_deleted, INSERTED.completed_at, INSERTED.created_at, INSERTED.updated_at
    WHERE id = @id AND user_id = @user_id AND is_deleted = 0
  `);

  res.json(result.recordset[0]);
});

// @desc   Soft-delete a task
// @route  DELETE /api/tasks/:id
// @access Private
export const deleteTask = asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier, req.params.id)
    .input("user_id", sql.UniqueIdentifier, req.user.id)
    .query(`
      UPDATE tasks
      SET is_deleted = 1, updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.id
      WHERE id = @id AND user_id = @user_id AND is_deleted = 0
    `);

  if (result.recordset.length === 0) {
    res.status(404);
    throw new Error("Task not found");
  }

  res.json({ message: "Task deleted" });
});

// @desc   Restore a soft-deleted task
// @route  PUT /api/tasks/:id/restore
// @access Private
export const restoreTask = asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier, req.params.id)
    .input("user_id", sql.UniqueIdentifier, req.user.id)
    .query(`
      UPDATE tasks
      SET is_deleted = 0, updated_at = SYSUTCDATETIME()
      OUTPUT INSERTED.id, INSERTED.title, INSERTED.due_date, INSERTED.priority,
             INSERTED.status, INSERTED.is_deleted, INSERTED.created_at, INSERTED.updated_at
      WHERE id = @id AND user_id = @user_id AND is_deleted = 1
    `);

  if (result.recordset.length === 0) {
    res.status(404);
    throw new Error("Task not found in archive");
  }

  res.json(result.recordset[0]);
});
