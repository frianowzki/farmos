import { describe, expect, it } from "vitest";
import { addDays, weekStart } from "@/lib/dates";
import { dayStreak, heatmap, isDue, taskStreak } from "@/lib/streak";

const daily = { cadence: "daily", intervalDays: 1, weekdays: [], startDate: "2026-10-01" };

describe("dates", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("finds Monday week start", () => {
    expect(weekStart("2026-11-10")).toBe("2026-11-09"); // Tue -> Mon
    expect(weekStart("2026-11-15")).toBe("2026-11-09"); // Sun -> Mon
  });
});

describe("taskStreak", () => {
  it("counts consecutive days and does not break on an open today", () => {
    const days = ["2026-11-07", "2026-11-08", "2026-11-09"];
    expect(taskStreak(daily, days, "2026-11-10").current).toBe(3);
    expect(taskStreak(daily, [...days, "2026-11-10"], "2026-11-10").current).toBe(4);
  });
  it("breaks on a missed day and keeps best", () => {
    const days = ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-08", "2026-11-09"];
    const s = taskStreak(daily, days, "2026-11-10");
    expect(s.current).toBe(2);
    expect(s.best).toBe(4);
  });
  it("handles weekly tasks on fixed weekdays", () => {
    const t = { cadence: "weekly", intervalDays: 1, weekdays: [1, 4], startDate: "2026-10-01" }; // Mon, Thu
    expect(isDue(t, "2026-11-09")).toBe(true); // Monday
    expect(isDue(t, "2026-11-10")).toBe(false);
    const s = taskStreak(t, ["2026-11-02", "2026-11-05", "2026-11-09"], "2026-11-10");
    expect(s.current).toBe(3);
  });
  it("handles once-a-week tasks without weekdays", () => {
    const t = { cadence: "weekly", intervalDays: 1, weekdays: [], startDate: "2026-10-01" };
    const s = taskStreak(t, ["2026-10-28", "2026-11-03"], "2026-11-10");
    expect(s.current).toBe(2); // this week still open, last two weeks done
  });
  it("handles every-N-days tasks", () => {
    const t = { cadence: "custom", intervalDays: 3, weekdays: [], startDate: "2026-11-01" };
    expect(isDue(t, "2026-11-04")).toBe(true);
    expect(isDue(t, "2026-11-05")).toBe(false);
    const s = taskStreak(t, ["2026-11-01", "2026-11-05", "2026-11-07"], "2026-11-10");
    expect(s.current).toBe(3);
  });
});

describe("dayStreak + heatmap", () => {
  it("counts workspace streak from yesterday if today is empty", () => {
    expect(dayStreak(["2026-11-08", "2026-11-09"], "2026-11-10")).toBe(2);
    expect(dayStreak(["2026-11-08"], "2026-11-10")).toBe(0);
  });
  it("builds 7-row columns ending on the current week", () => {
    const h = heatmap(["2026-11-10", "2026-11-10", "2026-11-09"], "2026-11-10", 4);
    expect(h.cols).toHaveLength(4);
    expect(h.cols.every((c) => c.length === 7)).toBe(true);
    const flat = h.cols.flat();
    expect(flat.find((d) => d.day === "2026-11-10")?.count).toBe(2);
    expect(flat.find((d) => d.day === "2026-11-15")?.future).toBe(true);
  });
});
