import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "../validation/authSchemas.js";

// Pure unit tests: no database, no HTTP. Limits from PRD §6.
const valid = {
  first_name: "Ada",
  last_name: "Lovelace",
  email: "ada@example.com",
  password: "Passw0rd!",
};
const reg = (over) => registerSchema.safeParse({ ...valid, ...over });

describe("registerSchema", () => {
  it("accepts a valid payload", () => {
    expect(reg({}).success).toBe(true);
  });

  it("accepts names at 1 and 100 chars", () => {
    expect(reg({ first_name: "a", last_name: "b" }).success).toBe(true);
    expect(reg({ first_name: "a".repeat(100), last_name: "b".repeat(100) }).success).toBe(true);
  });

  it("rejects empty and >100 char names", () => {
    expect(reg({ first_name: "" }).success).toBe(false);
    expect(reg({ last_name: "" }).success).toBe(false);
    expect(reg({ first_name: "a".repeat(101) }).success).toBe(false);
    expect(reg({ last_name: "a".repeat(101) }).success).toBe(false);
  });

  it("rejects an invalid email", () => {
    expect(reg({ email: "not-an-email" }).success).toBe(false);
    expect(reg({ email: "" }).success).toBe(false);
  });

  it("accepts password lengths 8 and 20", () => {
    expect(reg({ password: "Passw0r!" }).success).toBe(true);
    expect(reg({ password: "Aa1!" + "a".repeat(16) }).success).toBe(true);
  });

  it("rejects password length 7 and 21", () => {
    expect(reg({ password: "Passw0!" }).success).toBe(false);
    expect(reg({ password: "Aa1!" + "a".repeat(17) }).success).toBe(false);
  });

  it("rejects a password missing an uppercase letter", () => {
    expect(reg({ password: "passw0rd!" }).success).toBe(false);
  });

  it("rejects a password missing a lowercase letter", () => {
    expect(reg({ password: "PASSW0RD!" }).success).toBe(false);
  });

  it("rejects a password missing a digit", () => {
    expect(reg({ password: "Password!" }).success).toBe(false);
  });

  it("rejects a password missing a non-alphanumeric character", () => {
    expect(reg({ password: "Passw0rdd" }).success).toBe(false);
  });

  it("rejects missing fields", () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts a valid email and non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });

  it("does not apply registration password rules at login", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "weak" }).success).toBe(true);
  });

  it("rejects an empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("rejects a bad email", () => {
    expect(loginSchema.safeParse({ email: "nope", password: "x" }).success).toBe(false);
  });
});
