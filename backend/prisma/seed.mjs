import "dotenv/config";
import { getPrisma } from "../config/prisma.js";

// Demo seed — the code-first replacement for the old schema.sql seed (DB §4, D-019). Run from
// backend/ with `node prisma/seed.mjs` after `prisma migrate deploy`. Idempotent: it upserts the
// one demo profile and replaces that profile's tasks, date-anchored to today so the dashboard
// always looks current. It is NOT the real-data cutover (DB §7).

const USER_ID = "11111111-1111-1111-1111-111111111111";
// bcrypt hash (cost 10) of the demo password 'Password123!', as in the original seed.
const PASSWORD_HASH = "$2b$10$cxXcJsy8A2NQksG4ZqRVBeXwKmCP3qupWwKUx5VJIh2vshcJWKsxa";

// Today's UTC calendar date at midnight, plus n days — a date-only value (Tech-Backend §8).
function dayPlus(n) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + n));
}

const TASKS = [
  // Today
  { title: "Review Spring Security", description: "Filters, JWT, method-level security", day: 0, priority: "high" },
  { title: "Work on thesis", description: "Write the architecture chapter", day: 0, priority: "high" },
  { title: "Review Java Streams", description: "map / filter / collect / reduce", day: 0, priority: "medium" },
  { title: "Reply to recruiter email", description: null, day: 0, priority: "medium" },
  { title: "Water the plants", description: null, day: 0, priority: "low" },
  // Day +1
  { title: "Review React Server Components", description: "RSC vs client components, data fetching", day: 1, priority: "high" },
  { title: "Apply to Company X", description: "Tailor CV and cover letter", day: 1, priority: "high" },
  { title: "Review Spring Boot notes 21-51", description: null, day: 1, priority: "medium" },
  { title: "Grocery shopping", description: "Milk, eggs, coffee", day: 1, priority: "low" },
  { title: "Gym leg day", description: null, day: 1, priority: "low" },
  // Day +2
  { title: "Apply to 3 jobs", description: "Backend / full-stack roles", day: 2, priority: "high" },
  { title: "Review Java Collections", description: "List, Set, Map, complexity", day: 2, priority: "medium" },
  { title: "Read Next.js documentation", description: "App router + caching", day: 2, priority: "medium" },
  { title: "Call the bank", description: null, day: 2, priority: "medium" },
  { title: "Plan weekend trip", description: null, day: 2, priority: "low" },
  // Day +3
  { title: "Review Spring Boot notes 21-51", description: "Second pass (spaced repetition)", day: 3, priority: "medium" },
  { title: "Refactor LazarOS backend", description: "Split controllers, add validation", day: 3, priority: "high" },
  { title: "Review SQL indexing", description: "Clustered vs non-clustered", day: 3, priority: "medium" },
  { title: "Dentist appointment", description: null, day: 3, priority: "high" },
  { title: "Backup laptop", description: null, day: 3, priority: "low" },
];

async function main() {
  const prisma = await getPrisma();

  await prisma.profiles.upsert({
    where: { id: USER_ID },
    update: {},
    create: {
      id: USER_ID,
      first_name: "Lazar",
      last_name: "Lazarevic",
      email: "lazar@lazaros.dev",
      password: PASSWORD_HASH,
    },
  });

  // Replace this demo user's tasks so re-running the seed is clean and deterministic.
  await prisma.tasks.deleteMany({ where: { user_id: USER_ID } });
  await prisma.tasks.createMany({
    data: TASKS.map((t) => ({
      user_id: USER_ID,
      title: t.title,
      description: t.description,
      due_date: dayPlus(t.day),
      priority: t.priority,
    })),
  });

  console.log(`Seeded profile ${USER_ID} with ${TASKS.length} tasks (login lazar@lazaros.dev / Password123!).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exit(1);
});
