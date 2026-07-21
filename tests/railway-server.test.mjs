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
  assert.match(server, /canonicalInvitationPath/);
  assert.match(server, /pathname === "\/rsvp"/);
  assert.match(server, /sendSocialPreview/);
  assert.match(server, /\[a-f0-9\]\{32\}/);
  assert.match(server, /Cache-Control\": \"no-store\"/);
  assert.match(html, /\/first\.mp4/);
  assert.match(html, /\/newsecond\.mp4/);
  assert.match(html, /\/first-poster\.png/);
  assert.match(html, /\/secondv2-poster\.png/);
  assert.match(html, /playVideoOrShowFallback/);
  assert.match(html, /Nicki%20Minaj/);
  assert.match(html, /rsvp-name-hotspot/);
  assert.match(html, /rsvp-submit-hotspot/);
  assert.match(html, /\/invitation-layout\.js\?v=8/);
  assert.match(html, /372%20Middle%20Rd%2C%20Hazlet%2C%20NJ%2007730/);
  assert.match(html, /name="adults"/);
  assert.match(html, /name="kids"/);
  assert.match(html, /partySize/);
  assert.match(html, /countdown: countdownPanel/);
  assert.match(html, /layoutEditorMode/);
  assert.match(html, /startEditor/);
  assert.match(html, /API_ORIGIN = "https:\/\/after-hours-party\.adventraa\.chatgpt\.site"/);
  assert.match(html, /api\/invite\/\$\{encodeURIComponent\(invitationToken\)\}\/rsvp/);
  assert.match(html, /countdown-panel/);
  assert.match(html, /vinyl-record--paused/);
  assert.match(html, /fetchpriority="high"/);
  assert.match(html, /device-shell/);
  assert.match(html, /device-camera/);
  assert.match(html, /window\.addEventListener\("pageshow", initializeOnce\)/);
  assert.match(html, /window\.setTimeout\(markReady, 450\)/);
  assert.match(html, /invitez-opening-viewed/);
  assert.match(html, /guest\.previouslyOpened/);
  assert.match(html, /showConfirmation/);
  assert.match(html, /rsvp-confirmation/);
  assert.match(html, /Your RSVP is in/);
  assert.doesNotMatch(html, /confirmation-detail|confirmation-venue/);
  assert.match(html, /invitation\.scrollTo\(\{ top: invitation\.scrollHeight/);
  assert.match(html, /rsvpForm\.reset\(\)/);
  assert.doesNotMatch(html, /id="update-rsvp"|>Edit<\/button>/);
  assert.match(html, /eventDayActive/);
  assert.match(html, /document\.title = `\$\{currentEvent\.eventName\} \| Invitez`/);
  assert.match(html, /Open your private digital invitation/);
  assert.match(html, /https:\/\/www\.invitez\.xyz\/rsvp/);
  assert.match(html, /https:\/\/www\.invitez\.xyz\/og-rsvp\.jpg/);
  assert.match(html, /window\.location\.pathname === "\/rsvp"/);
  assert.ok(server.includes('if (/^\\/i\\/[^/]+\\/?$/.test(pathname))'));
  assert.doesNotMatch(server, /Location: "https:\/\/after-hours-party\.adventraa\.chatgpt\.site\/admin"/);
  assert.match(server, /after-hours-party\.adventraa\.chatgpt\.site\/event-day/);
  assert.match(styles, /@media \(min-width: 700px\)/);
  assert.match(styles, /\[hidden\][\s\S]*display: none !important/);
  assert.match(styles, /url\("\/%20countdown\.png"\)/);
});
