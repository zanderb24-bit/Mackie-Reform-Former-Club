import test from "node:test";
import assert from "node:assert/strict";
import {
  londonToISO,
  londonDay,
  timeLabel,
  safeUrl,
  escapeHTML,
} from "../js/utils.js";
test("London winter and summer sessions use correct offsets", () => {
  assert.equal(londonToISO("2026-01-20", "19:00"), "2026-01-20T19:00:00.000Z");
  assert.equal(londonToISO("2026-07-21", "19:00"), "2026-07-21T18:00:00.000Z");
});
test("DST gaps and ambiguous times are rejected", () => {
  assert.throws(() => londonToISO("2026-03-29", "01:30"), /does not exist/);
  assert.throws(() => londonToISO("2026-10-25", "01:30"), /occurs twice/);
});
test("day and time match London at midnight in summer", () => {
  assert.equal(londonDay("2026-07-20T23:30:00Z"), "2026-07-21");
  assert.equal(timeLabel("2026-07-20T23:30:00Z"), "00:30");
});
test("untrusted links and text are safe", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("https://user:pass@example.org"), "");
  assert.equal(safeUrl("https://example.org/"), "https://example.org/");
  assert.equal(
    escapeHTML('<img onerror="x">'),
    "&lt;img onerror=&quot;x&quot;&gt;",
  );
});

test("bulletin expiry and pin ordering use actual stored records", async () => {
  const { visiblePosts } = await import("../js/data.js");
  const posts = [
    {
      id: "expired",
      pinned: true,
      created_at: "2026-01-01T10:00:00Z",
      expires_at: new Date(Date.now() - 60000).toISOString(),
    },
    { id: "new", pinned: false, created_at: "2026-01-03T10:00:00Z" },
    { id: "pin", pinned: true, created_at: "2026-01-01T10:00:00Z" },
    { id: "old", pinned: false, created_at: "2026-01-02T10:00:00Z" },
  ];
  assert.deepEqual(
    visiblePosts(posts).map((p) => p.id),
    ["pin", "new", "old"],
  );
});
