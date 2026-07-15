import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Railway entrypoint serves the complete invitation without Cloudflare imports", async () => {
  const [server, html, packageJson, styles] = await Promise.all([
    readFile(new URL("../railway-server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../railway/index.html", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(packageJson, /"start": "node railway-server\.mjs"/);
  assert.doesNotMatch(server, /cloudflare:/);
  assert.match(server, /process\.env\.PORT \|\| 8080/);
  assert.match(server, /Accept-Ranges/);
  assert.match(html, /\/first\.mp4/);
  assert.match(html, /\/secondv2\.mp4/);
  assert.match(html, /Nicki%20Minaj/);
  assert.match(html, /rsvp-name-hotspot/);
  assert.match(html, /rsvp-submit-hotspot/);
  assert.match(html, /after-hours-party\.adventraa\.chatgpt\.site\/api\/rsvp/);
  assert.match(html, /countdown-panel/);
  assert.match(html, /vinyl-record--paused/);
  assert.match(html, /device-shell/);
  assert.match(html, /device-camera/);
  assert.match(html, /window\.addEventListener\("pageshow", resetOpeningScreen\)/);
  assert.match(html, /firstPanel\.hidden = false/);
  assert.match(html, /secondPanel\.hidden = true/);
  assert.match(styles, /@media \(min-width: 700px\)/);
  assert.match(styles, /\[hidden\][\s\S]*display: none !important/);
});
