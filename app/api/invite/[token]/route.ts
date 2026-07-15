import { ensureInvitationSchema, getD1, getEventSettings, isEventDayActive, publicEvent } from "@/db/invitations";
import { publicCorsHeaders, publicJson } from "@/app/api/cors";

type Guest = {
  name: string;
  status: string;
  party_size: number;
  additional_information: string | null;
  opened_count: number;
  responded_at: string | null;
};

export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: publicCorsHeaders(request) });
}

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  await ensureInvitationSchema();
  const guest = await getD1().prepare(`SELECT name, status, party_size, additional_information,
    opened_count, responded_at FROM invitation_guests WHERE invite_token = ?`)
    .bind(token)
    .first<Guest>();
  if (!guest) return publicJson(request, { error: "Invitation not found" }, { status: 404 });

  const now = new Date().toISOString();
  await getD1().prepare(`UPDATE invitation_guests SET
    first_opened_at = COALESCE(first_opened_at, ?), last_opened_at = ?,
    opened_count = opened_count + 1, updated_at = ? WHERE invite_token = ?`)
    .bind(now, now, now, token)
    .run();
  const settings = await getEventSettings();
  return publicJson(request, {
    guest: {
      name: guest.name,
      status: guest.status,
      partySize: guest.party_size,
      additionalInformation: guest.additional_information || "",
      respondedAt: guest.responded_at,
      previouslyOpened: guest.opened_count > 0,
    },
    event: publicEvent(settings),
    eventDayActive: isEventDayActive(settings),
  });
}
