import bcrypt from "bcrypt";
import asyncHandler from "../middleware/asyncHandler.js";
import { getPrisma } from "../config/prisma.js";
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

  const prisma = await getPrisma();

  const existing = await prisma.profiles.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    res.status(400);
    throw new Error("Email already in use");
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.profiles.create({
    data: { first_name, last_name, email, password: hashedPassword },
    select: { id: true, first_name: true, last_name: true, email: true, created_at: true },
  });

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

  const prisma = await getPrisma();
  const user = await prisma.profiles.findUnique({ where: { email } });

  if (!user) {
    res.status(401);
    throw new Error("Invalid email or password");
  }

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
