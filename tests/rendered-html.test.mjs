import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains only the two gated invitation videos", async () => {
  const [page, layout, styles] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const source = `${page}\n${layout}\n${styles}`;

  assert.match(source, /\/first\.mp4/);
  assert.match(source, /\/second\.mp4/);
  assert.match(source, /className="intro-video"/i);
  assert.match(source, /aria-label="Open invitation"/i);
  assert.doesNotMatch(source, /disabled={!isComplete}/);
  assert.match(source, /introStage === "second"/);
  assert.match(source, /object-fit: cover/);
  assert.match(source, /preload="metadata"/);
  assert.match(source, /autoPlay = false/);
  assert.match(source, /viewportFit: "cover"/);
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.match(source, /title: "After Hours Invitation"/);

  assert.doesNotMatch(source, /The Night Shift|event-page|RSVP|gallery|hero|eventDetails|starterPhotos/i);
  assert.doesNotMatch(source, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
