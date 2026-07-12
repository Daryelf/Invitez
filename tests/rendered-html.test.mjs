import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("contains the party landing page content", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  const source = `${page}\n${layout}`;
  assert.match(source, /\/first\.mp4/);
  assert.match(source, /\/second\.mp4/);
  assert.match(source, /className="intro-video"/i);
  assert.match(source, /aria-label="Open invitation"/i);
  assert.match(source, /scrollIntoView/);
  assert.match(source, /introStage/);
  assert.match(source, /onEnded={enterEventPage}/);
  assert.match(source, /id="event-page"/i);
  assert.match(source, /RSVP now/);
  assert.match(source, /Add your photo/);
  assert.doesNotMatch(source, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("keeps persistent event capabilities wired into the app", async () => {
  const [schema, hosting, rsvpRoute, photoRoute] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../.openai/hosting.json", import.meta.url), "utf8"),
    readFile(new URL("../app/api/rsvp/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/photos/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(hosting, /"d1":\s*"DB"/);
  assert.match(hosting, /"r2":\s*"MEDIA"/);
  assert.match(schema, /sqliteTable\("rsvps"/);
  assert.match(schema, /sqliteTable\("photos"/);
  assert.match(rsvpRoute, /INSERT INTO rsvps/);
  assert.match(photoRoute, /env\.MEDIA\.put/);
});
