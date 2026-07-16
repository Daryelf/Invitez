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
  assert.match(server, /shouldProxyDashboard/);
  assert.match(server, /proxyDashboardRequest/);
  assert.match(server, /pathname\.startsWith\("\/assets\/"\)/);
  assert.match(server, /invitez_admin_session=/);
  assert.match(server, /replaceAll\(dashboardOrigin, publicOrigin\)/);
  assert.match(server, /Accept-Ranges/);
  assert.match(html, /\/first\.mp4/);
  assert.match(html, /\/secondv2\.mp4/);
  assert.match(html, /\/first-poster\.png/);
  assert.match(html, /\/secondv2-poster\.png/);
  assert.match(html, /playVideoOrShowFallback/);
  assert.match(html, /Nicki%20Minaj/);
  assert.match(html, /rsvp-name-hotspot/);
  assert.match(html, /rsvp-submit-hotspot/);
  assert.match(html, /\/invitation-layout\.js\?v=1/);
  assert.match(html, /layoutEditorMode/);
  assert.match(html, /startEditor/);
  assert.match(html, /API_ORIGIN = "https:\/\/after-hours-party\.adventraa\.chatgpt\.site"/);
  assert.match(html, /api\/invite\/\$\{encodeURIComponent\(invitationToken\)\}\/rsvp/);
  assert.match(html, /countdown-panel/);
  assert.match(html, /vinyl-record--paused/);
  assert.match(html, /device-shell/);
  assert.match(html, /device-camera/);
  assert.match(html, /window\.addEventListener\("pageshow", initializeOnce\)/);
  assert.match(html, /window\.setTimeout\(markReady, 450\)/);
  assert.match(html, /invitez-opening-viewed/);
  assert.match(html, /guest\.previouslyOpened/);
  assert.match(html, /showConfirmation/);
  assert.match(html, /rsvp-confirmation/);
  assert.match(html, /eventDayActive/);
  assert.ok(server.includes('if (/^\\/i\\/[^/]+\\/?$/.test(pathname))'));
  assert.doesNotMatch(server, /Location: "https:\/\/after-hours-party\.adventraa\.chatgpt\.site\/admin"/);
  assert.match(server, /after-hours-party\.adventraa\.chatgpt\.site\/event-day/);
  assert.match(styles, /@media \(min-width: 700px\)/);
  assert.match(styles, /\[hidden\][\s\S]*display: none !important/);
});
