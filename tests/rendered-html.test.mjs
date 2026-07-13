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
  assert.match(source, /\/secondv2\.mp4/);
  assert.match(source, /className=.*intro-video/i);
  assert.match(source, /aria-label="Open invitation"/i);
  assert.match(source, /OPEN INVITATION/);
  assert.match(source, /intro-sequence--locked/);
  assert.match(source, /overflow: hidden/);
  assert.doesNotMatch(source, /disabled={!isComplete}/);
  assert.match(source, /introStage === "first" \?/);
  assert.match(source, /setIntroStage\("second"\)/);
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.match(source, /object-fit: cover/);
  assert.match(source, /intro-panel--full/);
  assert.match(source, /intro-video--full/);
  assert.match(source, /object-fit: contain/);
  assert.match(source, /aspect-ratio: 736 \/ 4088/);
  assert.match(source, /video\.addEventListener\("canplay", playIfVisible\)/);
  assert.match(source, /src="\/secondv2\.mp4"[\s\S]*autoPlay[\s\S]*preload="auto"/);
  assert.match(source, /countdown-panel/);
  assert.match(source, /October 3 at 7 PM/);
  assert.match(source, /setInterval\(updateCountdown, 1000\)/);
  assert.match(source, /2026-10-03T19:00:00-04:00/);
  assert.match(source, /vinyl-record\.png/);
  assert.match(source, /vinyl-spin 7s linear infinite/);
  assert.match(source, /rotate\(360deg\)/);
  assert.match(source, /rsvp-panel/);
  assert.match(source, /Additional information/);
  assert.match(source, /Will you be attending\?/);
  assert.match(source, /fetch\("\/api\/rsvp"/);
  assert.match(source, /autoComplete="email"/);
  assert.match(source, /scroll-snap-type: y proximity/);
  assert.match(source, /threshold: 0\.01/);
  assert.match(source, /preload="auto"/);
  assert.match(source, /autoPlay = false/);
  assert.match(source, /viewportFit: "cover"/);
  assert.match(source, /title: "After Hours Invitation"/);

  assert.doesNotMatch(source, /The Night Shift|event-page|gallery|hero|eventDetails|starterPhotos/i);
  assert.doesNotMatch(source, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});
