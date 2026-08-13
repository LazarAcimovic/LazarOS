import bcrypt from "bcrypt";
import asyncHandler from "../middleware/asyncHandler.js";
import { getPool, sql } from "../config/db.js";
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

  const existing = await pool
    .request()
    .input("email", sql.VarChar, email)
    .query("SELECT id FROM profiles WHERE email = @email");

  if (existing.recordset.length > 0) {
    res.status(400);
    throw new Error("Email already in use");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const result = await pool
    .request()
    .input("first_name", sql.VarChar, first_name)
    .input("last_name", sql.VarChar, last_name)
    .input("email", sql.VarChar, email)
    .input("password", sql.VarChar, hashedPassword)
    .query(`
      INSERT INTO profiles (first_name, last_name, email, password)
      OUTPUT INSERTED.id, INSERTED.first_name, INSERTED.last_name, INSERTED.email, INSERTED.created_at
      VALUES (@first_name, @last_name, @email, @password)
    `);

  const user = result.recordset[0];
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
  const result = await pool
    .request()
    .input("email", sql.VarChar, email)
    .query(
      "SELECT id, first_name, last_name, email, password, created_at FROM profiles WHERE email = @email"
    );

  if (result.recordset.length === 0) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

  const user = result.recordset[0];
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
