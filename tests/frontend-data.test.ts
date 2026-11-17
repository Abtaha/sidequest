import { describe, it, expect } from "vitest";
import {
  datedAvailability,
  localDateValue,
  formText,
} from "../src/lib/sidequest-data";
describe("form data boundaries", () => {
  it("turns selected periods into future dated windows without mutating the reference date", () => {
    const now = new Date(2026, 10, 17, 12),
      before = +now;
    const weekends = datedAvailability(["Weekends"], now);
    expect(weekends).toHaveLength(4);
    for (const window of weekends) {
      expect([0, 6]).toContain(window.start.getDay());
      expect(+window.start).toBeGreaterThan(+now);
      expect(window.end.getHours()).toBe(22);
    }
    expect(+now).toBe(before);
    expect(datedAvailability(["Weekday evenings"], now)).toHaveLength(10);
  });
  it("round-trips local datetime fields and rejects file form fields as text", () => {
    const date = new Date(2026, 10, 21, 18, 0);
    expect(+new Date(localDateValue(date))).toBe(+date);
    const data = new FormData();
    data.set("name", "Synthetic user");
    data.set("file", new Blob(["data"]), "file.txt");
    expect(formText(data, "name")).toBe("Synthetic user");
    expect(formText(data, "file", "fallback")).toBe("fallback");
  });
});
