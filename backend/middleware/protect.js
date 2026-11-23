import jwt from "jsonwebtoken";
import asyncHandler from "./asyncHandler.js";
import { getPrisma } from "../config/prisma.js";

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

  const prisma = await getPrisma();
  const user = await prisma.profiles.findUnique({
    where: { id: decoded.userId },
    select: { id: true, first_name: true, last_name: true, email: true, created_at: true },
  });

  if (!user) {
    res.status(401);
    throw new Error("Not authorized, user not found");
  }
  req.user = user;
  next();
});
