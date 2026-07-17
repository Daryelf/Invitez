import { getD1, ensureInvitationSchema, getEventSettings, publicEvent, isEventDayActive } from "@/db/invitations";
import { requireAdminApi } from "@/app/admin-auth";
import { getSmsConfigurationStatus, normalizePhoneNumber } from "@/lib/sms";

type GuestRow = {
  id: string;
  invite_token: string;
  name: string;
  email: string | null;
  phone: string | null;
  party_size: number;
  status: string;
  additional_information: string | null;
  sent_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  opened_count: number;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

type SmsDeliveryRow = {
  guest_id: string;
  status: string;
  error: string | null;
  sent_at: string | null;
  created_at: string;
};

function serializeGuest(row: GuestRow, latestSms?: SmsDeliveryRow) {
  return {
    id: row.id,
    token: row.invite_token,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    partySize: row.party_size,
    status: row.status,
    additionalInformation: row.additional_information || "",
    sentAt: row.sent_at,
    firstOpenedAt: row.first_opened_at,
    lastOpenedAt: row.last_opened_at,
    openedCount: row.opened_count,
    respondedAt: row.responded_at,
    smsStatus: latestSms?.status || null,
    smsError: latestSms?.error || "",
    smsSentAt: latestSms?.sent_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  await ensureInvitationSchema();
  const [guestResult, smsResult, settings] = await Promise.all([
    getD1().prepare("SELECT * FROM invitation_guests ORDER BY created_at DESC").all<GuestRow>(),
    getD1().prepare(`SELECT guest_id, status, error, sent_at, created_at
      FROM invitation_sms_deliveries ORDER BY created_at DESC`).all<SmsDeliveryRow>(),
    getEventSettings(),
  ]);
  const latestSmsByGuest = new Map<string, SmsDeliveryRow>();
  for (const delivery of smsResult.results) {
    if (!latestSmsByGuest.has(delivery.guest_id)) latestSmsByGuest.set(delivery.guest_id, delivery);
  }
  return Response.json({
    guests: guestResult.results.map((guest: GuestRow) => serializeGuest(guest, latestSmsByGuest.get(guest.id))),
    event: publicEvent(settings),
    eventDayOverride: settings.dayOfOverride,
    photoUploadsEnabled: settings.photoUploadsEnabled,
    eventDayActive: isEventDayActive(settings),
    sms: getSmsConfigurationStatus(),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;

  let input: {
    guests?: Array<{ name?: string; email?: string; phone?: string; partySize?: number }>;
    markSent?: boolean;
  };
  try {
    input = await request.json() as typeof input;
  } catch {
    return Response.json({ error: "Invalid guest list" }, { status: 400 });
  }

  let guests: Array<{ name: string; email: string | null; phone: string | null; partySize: number }>;
  try {
    guests = (input.guests || [])
      .map((guest) => ({
        name: guest.name?.trim() || "",
        email: guest.email?.trim().toLowerCase() || null,
        phone: guest.phone?.trim() ? normalizePhoneNumber(guest.phone) : null,
        partySize: Math.min(20, Math.max(1, Number(guest.partySize) || 1)),
      }))
      .filter((guest) => guest.name)
      .slice(0, 200);
  } catch (phoneError) {
    return Response.json({ error: phoneError instanceof Error ? phoneError.message : "Enter a valid mobile number" }, { status: 400 });
  }
  if (!guests.length) return Response.json({ error: "Add at least one guest name" }, { status: 400 });

  await ensureInvitationSchema();
  const now = new Date().toISOString();
  const db = getD1();
  await db.batch(guests.map((guest) => db.prepare(`INSERT INTO invitation_guests (
    id, invite_token, name, email, phone, party_size, status, sent_at, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`)
    .bind(
      crypto.randomUUID(),
      crypto.randomUUID().replaceAll("-", ""),
      guest.name,
      guest.email,
      guest.phone,
      guest.partySize,
      input.markSent ? now : null,
      now,
      now,
    )));

  return Response.json({ ok: true, added: guests.length }, { status: 201 });
}
