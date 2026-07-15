import { ensureInvitationSchema, getD1, getEventSettings, publicEvent } from "@/db/invitations";
import { publicCorsHeaders, publicJson } from "@/app/api/cors";

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: publicCorsHeaders(request) });
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  let input: { name?: string; attending?: string; additionalInformation?: string; partySize?: number };
  try {
    input = await request.json() as typeof input;
  } catch {
    return publicJson(request, { error: "Invalid RSVP" }, { status: 400 });
  }

  const status = input.attending === "yes" ? "attending" : input.attending === "no" ? "declined" : "";
  if (!status) return publicJson(request, { error: "Choose whether you are attending" }, { status: 400 });
  await ensureInvitationSchema();
  const existing = await getD1().prepare("SELECT name, party_size FROM invitation_guests WHERE invite_token = ?").bind(token).first<{ name: string; party_size: number }>();
  if (!existing) return publicJson(request, { error: "Invitation not found" }, { status: 404 });

  const now = new Date().toISOString();
  await getD1().prepare(`UPDATE invitation_guests SET
    name = ?, status = ?, party_size = ?, additional_information = ?, responded_at = ?, updated_at = ?
    WHERE invite_token = ?`)
    .bind(
      input.name?.trim() || existing.name,
      status,
      Math.min(20, Math.max(1, Number(input.partySize) || existing.party_size)),
      input.additionalInformation?.trim() || null,
      now,
      now,
      token,
    )
    .run();
  const settings = await getEventSettings();
  const partySize = Math.min(20, Math.max(1, Number(input.partySize) || existing.party_size));
  return publicJson(request, {
    ok: true,
    guest: { name: input.name?.trim() || existing.name, status, partySize },
    event: publicEvent(settings),
  });
}
