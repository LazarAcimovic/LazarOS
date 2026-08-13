import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import { getPool, sql } from "../config/db.js";

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
  const result = await pool
    .request()
    .input("id", sql.UniqueIdentifier, decoded.userId)
    .query(
      "SELECT id, first_name, last_name, email, created_at FROM profiles WHERE id = @id"
    );

  if (result.recordset.length === 0) {
    res.status(401);
    throw new Error("Not authorized, user not found");
  }
  req.user = result.recordset[0];
  next();
});
