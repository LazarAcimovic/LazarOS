import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import { getPool } from "../config/db.js";

export const protect = asyncHandler(async (req, res, next) => {
  const token = req.cookies.jwt;
  if (!token) {
    res.status(401);
    throw new Error("Not authorized, no token");
  }
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error("Not authorized, token failed");
  }

  const pool = await getPool();
  const result = await pool.query(
    "SELECT id, first_name, last_name, email, created_at FROM profiles WHERE id = $1",
    [decoded.userId]
  );

  if (result.rows.length === 0) {
    res.status(401);
    throw new Error("Not authorized, user not found");
  }
  req.user = result.rows[0];
  next();
});
