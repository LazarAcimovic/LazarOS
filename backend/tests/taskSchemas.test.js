import { describe, it, expect } from "vitest";
import { createTaskSchema, updateTaskSchema } from "../validation/taskSchemas.js";

// Pure unit tests: no database, no HTTP. Limits from PRD §6.
const valid = { title: "Write tests", due_date: "2026-11-22", priority: "medium" };
const create = (over) => createTaskSchema.safeParse({ ...valid, ...over });
const update = (data) => updateTaskSchema.safeParse(data);

describe("createTaskSchema", () => {
  it("accepts a valid payload without description", () => {
    expect(create({}).success).toBe(true);
  });

  it("has no status field and requires title, due_date, priority", () => {
    expect(Object.keys(createTaskSchema.shape)).not.toContain("status");
    for (const key of ["title", "due_date", "priority"]) {
      const rest = { ...valid };
      delete rest[key];
      expect(createTaskSchema.safeParse(rest).success).toBe(false);
    }
  });

  it("accepts title at 1 and 255 chars; rejects empty and 256", () => {
    expect(create({ title: "a" }).success).toBe(true);
    expect(create({ title: "a".repeat(255) }).success).toBe(true);
    expect(create({ title: "" }).success).toBe(false);
    expect(create({ title: "a".repeat(256) }).success).toBe(false);
  });

  it("accepts description empty, null and 4000 chars; rejects 4001", () => {
    expect(create({ description: "" }).success).toBe(true);
    expect(create({ description: null }).success).toBe(true);
    expect(create({ description: "a".repeat(4000) }).success).toBe(true);
    expect(create({ description: "a".repeat(4001) }).success).toBe(false);
  });

  it("accepts only YYYY-MM-DD due_date", () => {
    expect(create({ due_date: "2026-11-22" }).success).toBe(true);
    for (const bad of ["", "2026-1-1", "2026/11/22", "2026-11-22T00:00", " 2026-11-22", "22-11-2026"]) {
      expect(create({ due_date: bad }).success).toBe(false);
    }
  });

  it("accepts low/medium/high priority and rejects others", () => {
    for (const p of ["low", "medium", "high"]) expect(create({ priority: p }).success).toBe(true);
    for (const p of ["urgent", "", "HIGH"]) expect(create({ priority: p }).success).toBe(false);
  });
});

describe("updateTaskSchema", () => {
  it("accepts an empty object (every field optional)", () => {
    expect(update({}).success).toBe(true);
  });

  it("includes status and accepts pending/completed only", () => {
    expect(Object.keys(updateTaskSchema.shape)).toContain("status");
    expect(update({ status: "pending" }).success).toBe(true);
    expect(update({ status: "completed" }).success).toBe(true);
    expect(update({ status: "done" }).success).toBe(false);
    expect(update({ status: "" }).success).toBe(false);
  });

  it("enforces title 1–255 when present", () => {
    expect(update({ title: "a" }).success).toBe(true);
    expect(update({ title: "a".repeat(255) }).success).toBe(true);
    expect(update({ title: "" }).success).toBe(false);
    expect(update({ title: "a".repeat(256) }).success).toBe(false);
  });

  it("enforces description 0–4000 (nullable) when present", () => {
    expect(update({ description: "" }).success).toBe(true);
    expect(update({ description: null }).success).toBe(true);
    expect(update({ description: "a".repeat(4000) }).success).toBe(true);
    expect(update({ description: "a".repeat(4001) }).success).toBe(false);
  });

  it("enforces due_date format when present", () => {
    expect(update({ due_date: "2026-11-22" }).success).toBe(true);
    expect(update({ due_date: "2026-1-1" }).success).toBe(false);
    expect(update({ due_date: "2026-11-22T00:00" }).success).toBe(false);
  });

  it("enforces priority enum when present", () => {
    expect(update({ priority: "high" }).success).toBe(true);
    expect(update({ priority: "urgent" }).success).toBe(false);
  });
});
