import { describe, it, expect } from "vitest";

// PRD §6: the dashboard/upcoming `today` format is /^\d{4}-\d{2}-\d{2}$/; a missing or
// malformed value is a 400 (PRD §4.13). The guard in taskController.js is
// `!today || !PATTERN.test(today)`; this unit test exercises that logic with no DB or HTTP.
const PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isValidToday = (today) => Boolean(today) && PATTERN.test(today);

describe("today query-param guard", () => {
  it("accepts YYYY-MM-DD dates", () => {
    for (const ok of ["2026-11-22", "2026-01-15", "1999-12-31"]) {
      expect(isValidToday(ok)).toBe(true);
    }
  });

  it("rejects missing and empty values", () => {
    expect(isValidToday(undefined)).toBe(false);
    expect(isValidToday("")).toBe(false);
  });

  it("rejects non-padded, wrong-separator and datetime forms", () => {
    for (const bad of ["2026-1-1", "2026/11/22", "2026-11-22T00:00", "22-11-2026", "20261122"]) {
      expect(isValidToday(bad)).toBe(false);
    }
  });

  it("rejects leading or trailing junk", () => {
    for (const bad of [" 2026-11-22", "2026-11-22 ", "x2026-11-22", "2026-11-22x", "2026-11-22\n"]) {
      expect(isValidToday(bad)).toBe(false);
    }
  });
});
