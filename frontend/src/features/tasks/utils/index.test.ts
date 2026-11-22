import { afterEach, describe, expect, it, vi } from "vitest";
import {
  formatDueDate,
  formatGroupDate,
  getLocalToday,
  priorityLabel,
} from "./index";

afterEach(() => {
  vi.useRealTimers();
});

describe("getLocalToday (PRD §4.7)", () => {
  it("returns the local calendar date as zero-padded YYYY-MM-DD", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5, 12, 0, 0)); // local noon, 5 Jan

    expect(getLocalToday()).toBe("2026-01-05");
  });

  it("matches the local year/month/day parts of the mocked instant", () => {
    vi.useFakeTimers();
    const now = new Date(2026, 10, 22, 9, 15, 0);
    vi.setSystemTime(now);

    const pad = (n: number) => String(n).padStart(2, "0");
    expect(getLocalToday()).toBe(
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    );
  });

  // Built from local parts, so the UTC date differs from the local date in any
  // non-UTC timezone: 23:30 local is "tomorrow" in UTC for zones west of UTC,
  // 00:30 local is "yesterday" in UTC for zones east of UTC. In a UTC runner
  // the two coincide, but the local-parts assertion still holds.
  it("follows the local date late in the local day, not a UTC ISO slice", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 23, 30, 0));

    expect(getLocalToday()).toBe("2026-06-15");
  });

  it("follows the local date just after local midnight, not a UTC ISO slice", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 15, 0, 30, 0));

    expect(getLocalToday()).toBe("2026-06-15");
  });

  it("pads single-digit month and day and rolls over the year boundary locally", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 31, 23, 59, 0));
    expect(getLocalToday()).toBe("2026-12-31");

    vi.setSystemTime(new Date(2027, 0, 1, 0, 1, 0));
    expect(getLocalToday()).toBe("2027-01-01");
  });
});

describe("formatDueDate", () => {
  it("formats in en-US with short month, day and year", () => {
    const out = formatDueDate("2026-03-07");

    expect(out).toContain("Mar");
    expect(out).toContain("7");
    expect(out).toContain("2026");
  });

  it("does not shift the day for a date-only string", () => {
    expect(formatDueDate("2026-01-01")).toContain("Jan");
    expect(formatDueDate("2026-01-01")).toContain("1");
    expect(formatDueDate("2026-12-31")).toContain("Dec");
  });
});

describe("formatGroupDate (PRD §4.9)", () => {
  function setNow(y: number, m: number, d: number) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(y, m, d, 12, 0, 0));
  }

  it('labels the next calendar day "Tomorrow"', () => {
    setNow(2026, 5, 15);

    expect(formatGroupDate("2026-06-16")).toBe("Tomorrow");
  });

  it('labels tomorrow across a month boundary as "Tomorrow"', () => {
    setNow(2026, 5, 30);

    expect(formatGroupDate("2026-07-01")).toBe("Tomorrow");
  });

  it("formats a non-tomorrow date with the long month name", () => {
    setNow(2026, 5, 15);

    const out = formatGroupDate("2026-06-20");
    expect(out).not.toBe("Tomorrow");
    expect(out).toContain("June");
    expect(out).toContain("20");
  });

  it("does not label today or a two-days-out date as Tomorrow", () => {
    setNow(2026, 5, 15);

    expect(formatGroupDate("2026-06-15")).not.toBe("Tomorrow");
    expect(formatGroupDate("2026-06-17")).not.toBe("Tomorrow");
  });

  it("omits the year when it equals the current year", () => {
    setNow(2026, 5, 15);

    expect(formatGroupDate("2026-09-03")).not.toContain("2026");
  });

  it("includes the year when it differs from the current year", () => {
    setNow(2026, 5, 15);

    const out = formatGroupDate("2027-02-03");
    expect(out).toContain("February");
    expect(out).toContain("2027");
  });
});

describe("priorityLabel (PRD §6)", () => {
  it.each([
    ["low", "Low"],
    ["medium", "Medium"],
    ["high", "High"],
  ])("capitalises %s as %s", (input, expected) => {
    expect(priorityLabel(input)).toBe(expected);
  });
});
