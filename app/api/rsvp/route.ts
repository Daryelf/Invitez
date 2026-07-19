import { env } from "cloudflare:workers";
import { ensureInvitationSchema, getD1, getEventSettings, publicEvent } from "@/db/invitations";

type RSVPInput = {
  name?: string;
  email?: string;
  guests?: string | number;
  adults?: string | number;
  kids?: string | number;
  notes?: string;
  attending?: string;
  additionalInformation?: string;
};

const allowedOrigins = new Set([
  "https://www.invitez.xyz",
  "https://invitez.xyz",
  "https://after-hours-party.adventraa.chatgpt.site",
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin");
  return origin && allowedOrigins.has(origin)
    ? { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", Vary: "Origin" }
    : {};
}

function json(request: Request, data: unknown, init?: ResponseInit) {
  return Response.json(data, { headers: { "Cache-Control": "no-store", ...corsHeaders(request) }, ...init });
}

async function totalGuests() {
  if (!env.DB) return 0;
  const result = await env.DB.prepare("SELECT COALESCE(SUM(guests), 0) AS total_guests FROM rsvps").first<{ total_guests: number }>();
  return Number(result?.total_guests ?? 0);
}

export async function GET(request: Request) {
  try {
    return json(request, { totalGuests: await totalGuests() });
  } catch {
    return json(request, { totalGuests: 0, unavailable: true });
  }
}

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function POST(request: Request) {
  let input: RSVPInput;
  try {
    input = await request.json() as RSVPInput;
  } catch {
    return json(request, { error: "Invalid request" }, { status: 400 });
  }

  const name = input.name?.trim();
  const attending = input.attending === "yes" ? "yes" : input.attending === "no" ? "no" : "";
  const email = input.email?.trim().toLowerCase() || `guest-${crypto.randomUUID()}@invite.local`;
  if (!name || !attending) return json(request, { error: "Name and attendance are required" }, { status: 400 });
  const hasGuestBreakdown = input.adults !== undefined || input.kids !== undefined;
  const adults = attending === "no" ? 0 : Math.min(20, Math.max(0, Number(input.adults) || 0));
  const kids = attending === "no" ? 0 : Math.min(20, Math.max(0, Number(input.kids) || 0));
  const requestedGuests = hasGuestBreakdown ? adults + kids : Number(input.guests) || 1;
  if (attending === "yes" && requestedGuests < 1) return json(request, { error: "Enter at least one adult or child" }, { status: 400 });
  const guests = attending === "no" ? 0 : Math.min(20, Math.max(1, requestedGuests));
  if (!env.DB) return json(request, { error: "RSVP storage is not configured yet" }, { status: 503 });

  const additionalInformation = input.additionalInformation?.trim() || input.notes?.trim() || "";
  const guestBreakdown = hasGuestBreakdown && attending === "yes" ? `Adults: ${adults} · Kids: ${kids}` : "";
  const trackedInformation = [guestBreakdown, additionalInformation].filter(Boolean).join(" · ");
  const trackedPartySize = attending === "no" ? 0 : guests;
  const notes = `[Attending: ${attending}]${trackedInformation ? ` ${trackedInformation}` : ""}`;

  const now = new Date().toISOString();
  try {
    await ensureInvitationSchema();
    await env.DB.prepare(
      "INSERT INTO rsvps (id, name, email, guests, notes, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, guests = excluded.guests, notes = excluded.notes, created_at = excluded.created_at",
    ).bind(crypto.randomUUID(), name, email, guests, notes, now).run();
    const trackedGuest = await getD1().prepare("SELECT id FROM invitation_guests WHERE name = ? COLLATE NOCASE ORDER BY created_at DESC LIMIT 1")
      .bind(name)
      .first<{ id: string }>();
    const trackedStatus = attending === "yes" ? "attending" : "declined";
    if (trackedGuest) {
      await getD1().prepare(`UPDATE invitation_guests SET status = ?, party_size = ?,
        additional_information = ?, first_opened_at = COALESCE(first_opened_at, ?),
        last_opened_at = ?, opened_count = CASE WHEN opened_count < 1 THEN 1 ELSE opened_count END,
        responded_at = ?, updated_at = ? WHERE id = ?`)
        .bind(trackedStatus, trackedPartySize, trackedInformation || null, now, now, now, now, trackedGuest.id)
        .run();
    } else {
      await getD1().prepare(`INSERT INTO invitation_guests (
        id, invite_token, name, email, party_size, status, additional_information,
        first_opened_at, last_opened_at, opened_count, responded_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`)
        .bind(
          crypto.randomUUID(),
          crypto.randomUUID().replaceAll("-", ""),
          name,
          input.email?.trim().toLowerCase() || null,
          trackedPartySize,
          trackedStatus,
          trackedInformation || null,
          now,
          now,
          now,
          now,
          now,
        )
        .run();
    }
    const event = await getEventSettings();
    return json(request, { ok: true, totalGuests: await totalGuests(), event: publicEvent(event) });
  } catch (error) {
    console.error("Could not save RSVP", error);
    return json(request, { error: "Could not save RSVP" }, { status: 500 });
  }
}
