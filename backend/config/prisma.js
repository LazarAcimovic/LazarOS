import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getPool } from "./db.js";

// One shared PrismaClient for the whole process — the data-access layer (Tech-Backend §2, D-018).
// Prisma 7 requires a driver adapter; we build the pg adapter on the SAME shared pg.Pool as the
// raw path (config/db.js), so the UTC session pinning (Tech-Backend §8) and the test teardown
// (closePool) both apply to Prisma too. getPool() runs the connectivity probe, so awaiting this
// yields a client backed by a live, UTC-pinned connection.
let prismaPromise = null;

export function getPrisma() {
  if (!prismaPromise) {
    prismaPromise = getPool()
      .then((pool) => new PrismaClient({ adapter: new PrismaPg(pool) }))
      .catch((err) => {
        prismaPromise = null;
        throw err;
      });
  }
  return prismaPromise;
}
