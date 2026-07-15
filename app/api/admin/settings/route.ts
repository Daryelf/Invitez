import { ensureInvitationSchema, getD1, getEventSettings, publicEvent, isEventDayActive } from "@/db/invitations";
import { requireAdminApi } from "@/app/admin-auth";

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const current = await getEventSettings();

  let input: Partial<typeof current>;
  try {
    input = await request.json() as Partial<typeof current>;
  } catch {
    return Response.json({ error: "Invalid event settings" }, { status: 400 });
  }

  await ensureInvitationSchema();
  const next = {
    eventName: input.eventName?.trim() || current.eventName,
    eventDate: input.eventDate?.trim() || current.eventDate,
    eventTime: input.eventTime?.trim() || current.eventTime,
    eventIso: input.eventIso?.trim() || current.eventIso,
    venue: input.venue?.trim() || current.venue,
    address: input.address === undefined ? current.address : input.address.trim(),
    mapUrl: input.mapUrl === undefined ? current.mapUrl : input.mapUrl.trim(),
    dayOfOverride: input.dayOfOverride ?? current.dayOfOverride,
    photoUploadsEnabled: input.photoUploadsEnabled ?? current.photoUploadsEnabled,
  };
  await getD1().prepare(`UPDATE event_settings SET
    event_name = ?, event_date = ?, event_time = ?, event_iso = ?, venue = ?, address = ?,
    map_url = ?, day_of_override = ?, photo_uploads_enabled = ?, updated_at = ? WHERE id = 'primary'`)
    .bind(
      next.eventName,
      next.eventDate,
      next.eventTime,
      next.eventIso,
      next.venue,
      next.address,
      next.mapUrl,
      next.dayOfOverride ? 1 : 0,
      next.photoUploadsEnabled ? 1 : 0,
      new Date().toISOString(),
    )
    .run();
  return Response.json({ ok: true, event: publicEvent(next), eventDayActive: isEventDayActive(next) });
}
