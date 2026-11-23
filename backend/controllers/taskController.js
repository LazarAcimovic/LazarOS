import asyncHandler from "../middleware/asyncHandler.js";
import { getPool } from "../config/db.js";
import { getPrisma } from "../config/prisma.js";
import { createTaskSchema, updateTaskSchema } from "../validation/taskSchemas.js";

// The column set the list endpoints return (user_id and is_deleted are intentionally omitted),
// matching the previous raw SELECTs byte-for-byte.
const listSelect = {
  id: true,
  title: true,
  description: true,
  due_date: true,
  priority: true,
  status: true,
  completed_at: true,
  created_at: true,
  updated_at: true,
};

// due_date arrives as 'YYYY-MM-DD' (Zod). Store it as UTC midnight so the @db.Date column keeps
// the date-only value and serializes back as 'YYYY-MM-DDT00:00:00.000Z' (Tech-Backend §8).
const toDateOnly = (ymd) => new Date(`${ymd}T00:00:00.000Z`);

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
  const prisma = await getPrisma();
  const tasks = await prisma.tasks.findMany({
    where: { user_id: req.user.id, is_deleted: false },
    orderBy: [{ due_date: "asc" }, { created_at: "asc" }],
    select: listSelect,
  });

  res.json(tasks);
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

  const prisma = await getPrisma();
  const tasks = await prisma.tasks.findMany({
    where: {
      user_id: req.user.id,
      is_deleted: false,
      status: "pending",
      due_date: { gt: toDateOnly(today) },
    },
    orderBy: [{ due_date: "asc" }, { priority: "desc" }],
    select: listSelect,
  });

  res.json(tasks);
});

// @desc   Get archived tasks (soft-deleted)
// @route  GET /api/tasks/archive
// @access Private
export const getArchive = asyncHandler(async (req, res) => {
  const prisma = await getPrisma();
  const tasks = await prisma.tasks.findMany({
    where: { user_id: req.user.id, is_deleted: true },
    orderBy: { updated_at: "desc" },
    select: listSelect,
  });

  res.json(tasks);
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

  const prisma = await getPrisma();
  const task = await prisma.tasks.create({
    data: {
      user_id: req.user.id,
      title,
      description: description ?? null,
      due_date: toDateOnly(due_date),
      priority,
    },
  });

  res.status(201).json(task);
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

  const prisma = await getPrisma();

  // Verify ownership (and that the task is not soft-deleted) before updating — a miss is a 404,
  // which also gives cross-user access a 404 (never 403), per the isolation invariant (PRD §7).
  const current = await prisma.tasks.findFirst({
    where: { id: req.params.id, user_id: req.user.id, is_deleted: false },
    select: { status: true },
  });

  if (!current) {
    res.status(404);
    throw new Error("Task not found");
  }

  const input = parsed.data;
  const data = { updated_at: new Date() };

  if (input.title !== undefined) data.title = input.title;
  if ("description" in input) data.description = input.description ?? null;
  if (input.due_date !== undefined) data.due_date = toDateOnly(input.due_date);
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.status !== undefined) data.status = input.status;

  // Determine completed_at from the status transition.
  if (input.status === "completed" && current.status !== "completed") {
    data.completed_at = new Date();
  } else if (input.status === "pending" && current.status === "completed") {
    data.completed_at = null;
  }

  const task = await prisma.tasks.update({
    where: { id: req.params.id },
    data,
  });

  res.json(task);
});

// @desc   Soft-delete a task
// @route  DELETE /api/tasks/:id
// @access Private
export const deleteTask = asyncHandler(async (req, res) => {
  const prisma = await getPrisma();
  const { count } = await prisma.tasks.updateMany({
    where: { id: req.params.id, user_id: req.user.id, is_deleted: false },
    data: { is_deleted: true, updated_at: new Date() },
  });

  if (count === 0) {
    res.status(404);
    throw new Error("Task not found");
  }

  res.json({ message: "Task deleted" });
});

// @desc   Restore a soft-deleted task
// @route  PUT /api/tasks/:id/restore
// @access Private
export const restoreTask = asyncHandler(async (req, res) => {
  const prisma = await getPrisma();
  const { count } = await prisma.tasks.updateMany({
    where: { id: req.params.id, user_id: req.user.id, is_deleted: true },
    data: { is_deleted: false, updated_at: new Date() },
  });

  if (count === 0) {
    res.status(404);
    throw new Error("Task not found in archive");
  }

  const task = await prisma.tasks.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      title: true,
      due_date: true,
      priority: true,
      status: true,
      is_deleted: true,
      created_at: true,
      updated_at: true,
    },
  });

  res.json(task);
});
