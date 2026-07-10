import { env } from "cloudflare:workers";

type RSVPInput = { name?: string; email?: string; guests?: string | number; notes?: string };

function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { headers: { "Cache-Control": "no-store" }, ...init });
}

async function totalGuests() {
  if (!env.DB) return 0;
  const result = await env.DB.prepare("SELECT COALESCE(SUM(guests), 0) AS total_guests FROM rsvps").first<{ total_guests: number }>();
  return Number(result?.total_guests ?? 0);
}

export async function GET() {
  try {
    return json({ totalGuests: await totalGuests() });
  } catch {
    return json({ totalGuests: 0, unavailable: true });
  }
}

export async function POST(request: Request) {
  let input: RSVPInput;
  try {
    input = await request.json() as RSVPInput;
  } catch {
    return json({ error: "Invalid request" }, { status: 400 });
  }

  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const guests = Math.min(4, Math.max(1, Number(input.guests) || 1));
  if (!name || !email || !email.includes("@")) return json({ error: "Name and a valid email are required" }, { status: 400 });
  if (!env.DB) return json({ error: "RSVP storage is not configured yet" }, { status: 503 });

  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      "INSERT INTO rsvps (id, name, email, guests, notes, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO UPDATE SET name = excluded.name, guests = excluded.guests, notes = excluded.notes, created_at = excluded.created_at",
    ).bind(crypto.randomUUID(), name, email, guests, input.notes?.trim() || null, now).run();
    return json({ ok: true, totalGuests: await totalGuests() });
  } catch {
    return json({ error: "Could not save RSVP" }, { status: 500 });
  }
}
