import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("Argentum Studio uses PIN-only login, clean invite links, and protected owner sessions", async () => {
  const [auth, page, form, loginApi, logoutApi, client, guestApi, guestUpdateApi, smsApi, sms, layoutApi, publicLayoutApi, layoutEditor, schema, invitations, viteConfig, sectionUnlock] = await Promise.all([
    source("../app/admin-auth.ts"),
    source("../app/admin/page.tsx"),
    source("../app/admin/auth-form.tsx"),
    source("../app/api/admin/auth/login/route.ts"),
    source("../app/api/admin/auth/logout/route.ts"),
    source("../app/admin/admin-client.tsx"),
    source("../app/api/admin/guests/route.ts"),
    source("../app/api/admin/guests/[id]/route.ts"),
    source("../app/api/admin/guests/[id]/sms/route.ts"),
    source("../lib/sms.ts"),
    source("../app/api/admin/layout/route.ts"),
    source("../app/api/invitation-layout/route.ts"),
    source("../public/invitation-layout.js"),
    source("../db/schema.ts"),
    source("../db/invitations.ts"),
    source("../vite.config.ts"),
    source("../app/api/admin/section-unlock/route.ts"),
  ]);
  const adminSource = `${auth}\n${page}\n${form}\n${loginApi}\n${logoutApi}\n${client}\n${guestApi}\n${guestUpdateApi}\n${smsApi}`;

  assert.match(auth, /gamingboi567@gmail\.com/);
  assert.match(form, /4-digit PIN/);
  assert.match(form, /inputMode="numeric"/);
  assert.match(form, /maxLength=\{4\}/);
  assert.match(form, /JSON\.stringify\(\{ pin \}\)/);
  assert.match(form, /Enter studio/);
  assert.doesNotMatch(form, />Email<|>Password<|new-password|setupMode/);
  assert.doesNotMatch(page, /isAdminPasswordConfigured|getAdminOwnerEmail/);
  assert.doesNotMatch(adminSource, /ADMIN_SETUP_TOKEN|setupToken|private one-time/);
  assert.doesNotMatch(adminSource, /Sign in with ChatGPT/);
  assert.match(auth, /ADMIN_PIN/);
  assert.match(auth, /\|\| "7350"/);
  assert.match(viteConfig, /"ADMIN_PIN"/);
  assert.match(viteConfig, /"TWILIO_ACCOUNT_SID"/);
  assert.doesNotMatch(viteConfig, /ADMIN_PASSWORD_PEPPER/);
  assert.match(auth, /authenticateAdminPin/);
  assert.match(auth, /constantTimeEqual/);
  assert.doesNotMatch(auth, /ADMIN_PASSWORD_PEPPER|PBKDF2|HMAC|password_hash/);
  assert.match(auth, /admin_sessions/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.match(auth, /MAX_FAILED_LOGINS = 5/);
  assert.match(auth, /LOGIN_LOCK_SECONDS = 60/);
  assert.match(loginApi, /authenticateAdminPin/);
  assert.match(logoutApi, /revokeAdminSession/);
  assert.match(adminSource, /requireAdminApi/);
  assert.match(page, /Argentum Studio \| Invitation Creator/);
  assert.match(page, />A</);
  assert.match(client, /Argentum Studio/);
  assert.match(client, /Invitation dashboard/);
  assert.match(client, /RSVP responses/);
  assert.match(client, /Invitation designer/);
  assert.match(client, /This space is reserved for the experience guests will use during the event/);
  assert.doesNotMatch(`${page}\n${form}\n${client}`, /Erika(?:&apos;|'|’)?s Sweet 16/);
  assert.doesNotMatch(client, /Creator account|sidebarFooter/);
  assert.match(client, /Designer 🔒/);
  assert.match(client, /Event day 🔒/);
  assert.match(client, /SectionLock/);
  assert.match(sectionUnlock, /matchesAdminPin/);
  assert.match(sectionUnlock, /EVENT_DAY_PIN/);
  assert.doesNotMatch(client, /No reply|Unopened|Opened [^·]|openedCount/);
  assert.match(client, /Not going/);
  assert.match(client, /Additional information/);
  assert.match(client, /Export CSV/);
  assert.doesNotMatch(client, /navigator\.share/);
  assert.match(client, /copyInvite/);
  assert.match(client, /Copy invitation link/);
  assert.match(client, /Invitation link copied/);
  assert.match(client, /PUBLIC_INVITE_URL = "https:\/\/www\.invitez\.xyz\/rsvp"/);
  assert.doesNotMatch(client, /SMS|Twilio|Text invite|Open Messages|Mobile number/);
  assert.match(client, /document\.execCommand\("copy"\)/);
  assert.match(client, /Safari and embedded browsers/);
  assert.match(client, /Copy this one link/);
  assert.match(client, /invitation URL is selected below/);
  assert.doesNotMatch(client, /\/i\/\$\{encodeURIComponent/);
  assert.match(client, /Open phone preview/);
  assert.match(client, /editor=1/);
  assert.match(guestApi, /opened_count/);
  assert.match(guestApi, /responded_at/);
  assert.match(guestUpdateApi, /markSent/);
  assert.match(schema, /invitationGuests/);
  assert.match(schema, /inviteToken/);
  assert.match(schema, /eventSettings/);
  assert.match(schema, /adminCredentials/);
  assert.match(schema, /adminSessions/);
  assert.match(schema, /invitationLayouts/);
  assert.match(schema, /invitationSmsDeliveries/);
  assert.match(sms, /TWILIO_ACCOUNT_SID/);
  assert.match(sms, /TWILIO_AUTH_TOKEN/);
  assert.match(sms, /TWILIO_MESSAGING_SERVICE_SID/);
  assert.match(sms, /normalizePhoneNumber/);
  assert.match(sms, /Reply STOP to opt out/);
  assert.match(smsApi, /consentConfirmed/);
  assert.match(smsApi, /sendSmsMessage/);
  assert.match(smsApi, /invitation_sms_deliveries/);
  assert.match(layoutApi, /requireAdminApi/);
  assert.match(layoutApi, /saveRsvpLayout/);
  assert.match(publicLayoutApi, /getRsvpLayout/);
  assert.match(layoutEditor, /rsvp-layout-editor-handle/);
  assert.match(layoutEditor, /data-handle/);
  assert.match(layoutEditor, /handleName === "rotate"/);
  assert.match(layoutEditor, /Fields and Submit appearance/);
  assert.match(layoutEditor, /setControlFill/);
  assert.match(layoutEditor, /Countdown card/);
  assert.match(layoutEditor, /Vinyl play \/ pause/);
  assert.match(layoutEditor, /View map button/);
  assert.match(layoutEditor, /Adults/);
  assert.match(layoutEditor, /Kids/);
  assert.match(layoutEditor, /const countdown = options\.countdown/);
  assert.match(layoutEditor, /MAXIMUM_HEIGHT/);
  assert.match(layoutEditor, /\["nw", "n", "ne", "e", "se", "s", "sw", "w", "rotate"\]/);
  assert.match(layoutEditor, /pointerdown/);
  assert.match(layoutEditor, /\/api\/admin\/layout/);
  assert.match(layoutEditor, /Reset/);
  assert.match(invitations, /America\/New_York/);
});

test("individual invite links skip the opening on return, confirm RSVP, and switch on event day", async () => {
  const [html, server, inviteApi, rsvpApi, eventApi, styles] = await Promise.all([
    source("../railway/index.html"),
    source("../railway-server.mjs"),
    source("../app/api/invite/[token]/route.ts"),
    source("../app/api/invite/[token]/rsvp/route.ts"),
    source("../app/api/event-day/route.ts"),
    source("../app/globals.css"),
  ]);

  assert.ok(server.includes('if (/^\\/i\\/[^/]+\\/?$/.test(pathname))'));
  assert.match(server, /canonicalInvitationPath/);
  assert.match(server, /\[a-f0-9\]\{32\}/);
  assert.match(server, /canonicalInvitePath/);
  assert.match(html, /tokenMatch/);
  assert.match(html, /previouslyOpened/);
  assert.match(html, /showSecondStage\(false\)/);
  assert.match(html, /showConfirmation\(guestContext\)/);
  assert.match(html, /confirmationPreview/);
  assert.match(html, /rsvpForm\.reset\(\)/);
  assert.match(html, /Your RSVP is in/);
  assert.match(html, /eventDayActive/);
  assert.match(html, /window\.location\.replace/);
  assert.match(inviteApi, /opened_count = opened_count \+ 1/);
  assert.match(inviteApi, /previouslyOpened/);
  assert.match(rsvpApi, /status = input\.attending === "yes" \? "attending"/);
  assert.match(rsvpApi, /Adults:/);
  assert.match(rsvpApi, /Kids:/);
  assert.match(eventApi, /isEventDayActive/);
  assert.match(styles, /\.rsvp-confirmation-card/);
  assert.doesNotMatch(styles, /\.confirmation-screen/);
});

test("event-day photo wall uses a PIN gate and supports controlled camera uploads", async () => {
  const [page, styles, photosApi, eventApi, gate, layout, authApi, auth] = await Promise.all([
    source("../app/event-day/page.tsx"),
    source("../app/event-day/event-day.module.css"),
    source("../app/api/photos/route.ts"),
    source("../app/api/event-day/route.ts"),
    source("../app/event-day/event-day-pin-gate.tsx"),
    source("../app/event-day/layout.tsx"),
    source("../app/api/event-day/auth/route.ts"),
    source("../app/event-day/event-day-auth.ts"),
  ]);
  const eventSource = `${page}\n${styles}\n${photosApi}\n${eventApi}\n${gate}\n${layout}\n${authApi}\n${auth}`;

  assert.match(page, /capture="environment"/);
  assert.match(page, /Party wall/);
  assert.match(page, /Come back on/);
  assert.match(page, /preview/);
  assert.match(photosApi, /Photo sharing opens on event day/);
  assert.match(photosApi, /Photo uploads are paused by the host/);
  assert.match(photosApi, /image\/jpeg/);
  assert.match(eventApi, /photoUploadsEnabled/);
  assert.match(auth, /EVENT_DAY_PIN = "8412"/);
  assert.match(authApi, /httpOnly: true/);
  assert.match(authApi, /path: "\/event-day"/);
  assert.match(layout, /hasEventDayAccess/);
  assert.match(gate, /Open Event Day/);
  assert.match(eventSource, /eventDate/);
  assert.match(eventSource, /eventTime/);
  assert.match(eventSource, /venue/);
  assert.match(eventSource, /address/);
});

test("general invitation responses are included in dashboard tracking", async () => {
  const rsvpApi = await source("../app/api/rsvp/route.ts");
  assert.match(rsvpApi, /INSERT INTO invitation_guests/);
  assert.match(rsvpApi, /UPDATE invitation_guests SET status/);
  assert.match(rsvpApi, /additional_information/);
  assert.match(rsvpApi, /opened_count/);
  assert.match(rsvpApi, /requestedGuests/);
  assert.match(rsvpApi, /Adults:/);
});
