import bcrypt from "bcrypt";
import asyncHandler from "../middleware/asyncHandler.js";
import { getPool } from "../config/db.js";
import generateToken from "../utils/generateToken.js";
import { registerSchema, loginSchema } from "../validation/authSchemas.js";

// @desc   Register a new user
// @route  POST /api/auth/register
// @access Public
export const register = asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400);
    throw new Error(parsed.error.errors[0].message);
  }
  const { first_name, last_name, email, password } = parsed.data;

  const pool = await getPool();

  const existing = await pool.query(
    "SELECT id FROM profiles WHERE email = $1",
    [email]
  );

  if (existing.rows.length > 0) {
    res.status(400);
    throw new Error("Email already in use");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool.query(
    `
      INSERT INTO profiles (first_name, last_name, email, password)
      VALUES ($1, $2, $3, $4)
      RETURNING id, first_name, last_name, email, created_at
    `,
    [first_name, last_name, email, hashedPassword]
  );

  const user = result.rows[0];
  generateToken(res, user.id);
  res.status(201).json(user);
});

// @desc   Login user
// @route  POST /api/auth/login
// @access Public
export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400);
    throw new Error(parsed.error.errors[0].message);
  }
  const { email, password } = parsed.data;

  const pool = await getPool();
  const result = await pool.query(
    "SELECT id, first_name, last_name, email, password, created_at FROM profiles WHERE email = $1",
    [email]
  );

  if (result.rows.length === 0) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  generateToken(res, user.id);
  const { password: _pw, ...safeUser } = user;
  res.json(safeUser);
});

// @desc   Logout user
// @route  POST /api/auth/logout
// @access Private
export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("jwt");
  res.json({ message: "Logged out" });
});

// @desc   Get current user
// @route  GET /api/auth/me
// @access Private
export const getMe = asyncHandler(async (req, res) => {
  res.json(req.user);
});
