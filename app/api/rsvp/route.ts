import { env } from "cloudflare:workers";

type RSVPInput = {
  name?: string;
  email?: string;
  guests?: string | number;
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
  const guests = attending === "no" ? 0 : Math.min(4, Math.max(1, Number(input.guests) || 1));
  if (!name || !attending) return json(request, { error: "Name and attendance are required" }, { status: 400 });
  if (!env.DB) return json(request, { error: "RSVP storage is not configured yet" }, { status: 503 });

  const additionalInformation = input.additionalInformation?.trim() || input.notes?.trim() || "";
  const notes = `[Attending: ${attending}]${additionalInformation ? ` ${additionalInformation}` : ""}`;

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO rsvps (id, name, email, guests, notes, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, guests = excluded.guests, notes = excluded.notes, created_at = excluded.created_at",
    ).bind(crypto.randomUUID(), name, email, guests, notes, now).run();
    return json(request, { ok: true, totalGuests: await totalGuests() });
  } catch {
    return json(request, { error: "Could not save RSVP" }, { status: 500 });
  }
}
