import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(path, import.meta.url), "utf8");
}

test("admin dashboard is owner authenticated and tracks the complete guest lifecycle", async () => {
  const [auth, page, client, guestApi, guestUpdateApi, schema, invitations] = await Promise.all([
    source("../app/admin-auth.ts"),
    source("../app/admin/page.tsx"),
    source("../app/admin/admin-client.tsx"),
    source("../app/api/admin/guests/route.ts"),
    source("../app/api/admin/guests/[id]/route.ts"),
    source("../db/schema.ts"),
    source("../db/invitations.ts"),
  ]);
  const adminSource = `${auth}\n${page}\n${client}\n${guestApi}\n${guestUpdateApi}`;

  assert.match(auth, /gamingboi567@gmail\.com/);
  assert.match(page, /Sign in with ChatGPT/);
  assert.match(adminSource, /requireAdminApi/);
  assert.match(client, /Invitation overview/);
  assert.match(client, /Guest list/);
  assert.match(client, /Check every screen size/);
  assert.match(client, /Event-day control/);
  assert.match(client, /No reply/);
  assert.match(client, /Not going/);
  assert.match(client, /Additional information/);
  assert.match(client, /Export CSV/);
  assert.match(client, /navigator\.share/);
  assert.match(client, /https:\/\/www\.invitez\.xyz\/i\/\$\{guest\.token\}/);
  assert.match(guestApi, /opened_count/);
  assert.match(guestApi, /responded_at/);
  assert.match(guestUpdateApi, /markSent/);
  assert.match(schema, /invitationGuests/);
  assert.match(schema, /inviteToken/);
  assert.match(schema, /eventSettings/);
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
  assert.match(html, /tokenMatch/);
  assert.match(html, /previouslyOpened/);
  assert.match(html, /showSecondStage\(false\)/);
  assert.match(html, /showConfirmation\(guestContext\)/);
  assert.match(html, /confirmationPreview/);
  assert.match(html, /eventDayActive/);
  assert.match(html, /window\.location\.replace/);
  assert.match(inviteApi, /opened_count = opened_count \+ 1/);
  assert.match(inviteApi, /previouslyOpened/);
  assert.match(rsvpApi, /status = input\.attending === "yes" \? "attending"/);
  assert.match(eventApi, /isEventDayActive/);
  assert.match(styles, /\.confirmation-screen/);
});

test("event-day photo wall supports camera uploads but enforces host and date controls", async () => {
  const [page, styles, photosApi, eventApi] = await Promise.all([
    source("../app/event-day/page.tsx"),
    source("../app/event-day/event-day.module.css"),
    source("../app/api/photos/route.ts"),
    source("../app/api/event-day/route.ts"),
  ]);
  const eventSource = `${page}\n${styles}\n${photosApi}\n${eventApi}`;

  assert.match(page, /capture="environment"/);
  assert.match(page, /Party wall/);
  assert.match(page, /Come back on/);
  assert.match(page, /preview/);
  assert.match(photosApi, /Photo sharing opens on event day/);
  assert.match(photosApi, /Photo uploads are paused by the host/);
  assert.match(photosApi, /image\/jpeg/);
  assert.match(eventApi, /photoUploadsEnabled/);
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
});
