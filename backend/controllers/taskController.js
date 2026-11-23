import asyncHandler from "../middleware/asyncHandler.js";
import { getPool } from "../config/db.js";
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
  const result = await pool.query(
    `
      SELECT
        id, title, description, due_date, priority, status,
        completed_at, created_at, updated_at,
        CASE
          WHEN status = 'pending'   AND due_date <  $2::date THEN 'overdue'
          WHEN status = 'pending'   AND due_date =  $2::date THEN 'today'
          WHEN status = 'completed' AND (completed_at AT TIME ZONE 'utc')::date = $2::date THEN 'completed_today'
          ELSE 'other'
        END AS section,
        ($2::date - due_date) AS days_overdue
      FROM tasks
      WHERE user_id = $1
        AND is_deleted = false
        AND (
          (status = 'pending'   AND due_date <= $2::date)
          OR
          (status = 'completed' AND (completed_at AT TIME ZONE 'utc')::date = $2::date)
        )
      ORDER BY
        CASE
          WHEN status = 'pending' AND due_date < $2::date THEN 0
          WHEN status = 'pending' AND due_date = $2::date THEN 1
          ELSE 2
        END,
        due_date ASC,
        priority DESC
    `,
    [req.user.id, today]
  );

  const overdue = result.rows.filter((t) => t.section === "overdue");
  const todayTasks = result.rows.filter((t) => t.section === "today");
  const completedToday = result.rows.filter(
    (t) => t.section === "completed_today"
  );

  res.json({ overdue, today: todayTasks, completed_today: completedToday });
});

// @desc   Get all tasks (non-deleted)
// @route  GET /api/tasks
// @access Private
export const getAllTasks = asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool.query(
    `
      SELECT id, title, description, due_date, priority, status,
             completed_at, created_at, updated_at
      FROM tasks
      WHERE user_id = $1 AND is_deleted = false
      ORDER BY due_date ASC, created_at ASC
    `,
    [req.user.id]
  );

  res.json(result.rows);
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
  const result = await pool.query(
    `
      SELECT id, title, description, due_date, priority, status,
             completed_at, created_at, updated_at
      FROM tasks
      WHERE user_id = $1
        AND is_deleted = false
        AND status = 'pending'
        AND due_date > $2::date
      ORDER BY due_date ASC, priority DESC
    `,
    [req.user.id, today]
  );

  res.json(result.rows);
});

// @desc   Get archived tasks (soft-deleted)
// @route  GET /api/tasks/archive
// @access Private
export const getArchive = asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool.query(
    `
      SELECT id, title, description, due_date, priority, status,
             completed_at, created_at, updated_at
      FROM tasks
      WHERE user_id = $1 AND is_deleted = true
      ORDER BY updated_at DESC
    `,
    [req.user.id]
  );

  res.json(result.rows);
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
  const result = await pool.query(
    `
      INSERT INTO tasks (user_id, title, description, due_date, priority)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, title, description, due_date, priority, status,
                is_deleted, completed_at, created_at, updated_at
    `,
    [req.user.id, title, description ?? null, due_date, priority]
  );

  res.status(201).json(result.rows[0]);
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
  const existing = await pool.query(
    "SELECT id, status FROM tasks WHERE id = $1 AND user_id = $2 AND is_deleted = false",
    [req.params.id, req.user.id]
  );

  if (existing.rows.length === 0) {
    res.status(404);
    throw new Error("Task not found");
  }

  const current = existing.rows[0];
  const data = parsed.data;

  const sets = ["updated_at = now() at time zone 'utc'"];
  const params = [];
  const set = (col, val) => {
    params.push(val);
    sets.push(`${col} = $${params.length}`);
  };

  if (data.title !== undefined) set("title", data.title);
  if ("description" in data) set("description", data.description ?? null);
  if (data.due_date !== undefined) set("due_date", data.due_date);
  if (data.priority !== undefined) set("priority", data.priority);
  if (data.status !== undefined) set("status", data.status);

  // Determine completed_at from the status transition.
  if (data.status === "completed" && current.status !== "completed") {
    sets.push("completed_at = now() at time zone 'utc'");
  } else if (data.status === "pending" && current.status === "completed") {
    sets.push("completed_at = NULL");
  }

  params.push(req.params.id);
  const idParam = params.length;
  params.push(req.user.id);
  const userParam = params.length;

  const result = await pool.query(
    `
      UPDATE tasks
      SET ${sets.join(", ")}
      WHERE id = $${idParam} AND user_id = $${userParam} AND is_deleted = false
      RETURNING id, user_id, title, description, due_date, priority, status,
                is_deleted, completed_at, created_at, updated_at
    `,
    params
  );

  res.json(result.rows[0]);
});

// @desc   Soft-delete a task
// @route  DELETE /api/tasks/:id
// @access Private
export const deleteTask = asyncHandler(async (req, res) => {
  const pool = await getPool();
  const result = await pool.query(
    `
      UPDATE tasks
      SET is_deleted = true, updated_at = now() at time zone 'utc'
      WHERE id = $1 AND user_id = $2 AND is_deleted = false
      RETURNING id
    `,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
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
  const result = await pool.query(
    `
      UPDATE tasks
      SET is_deleted = false, updated_at = now() at time zone 'utc'
      WHERE id = $1 AND user_id = $2 AND is_deleted = true
      RETURNING id, title, due_date, priority, status, is_deleted, created_at, updated_at
    `,
    [req.params.id, req.user.id]
  );

  if (result.rows.length === 0) {
    res.status(404);
    throw new Error("Task not found in archive");
  }

  res.json(result.rows[0]);
});
