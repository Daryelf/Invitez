import { requireAdminApi } from "@/app/admin-auth";
import { ensureInvitationSchema, getD1, getEventSettings } from "@/db/invitations";
import {
  getSmsConfigurationStatus,
  invitationSmsMessage,
  normalizePhoneNumber,
  sendSmsMessage,
} from "@/lib/sms";

type GuestRow = {
  id: string;
  invite_token: string;
  name: string;
  phone: string | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const { id } = await context.params;

  let input: { message?: string; consentConfirmed?: boolean };
  try {
    input = await request.json() as typeof input;
  } catch {
    return Response.json({ error: "Invalid SMS request" }, { status: 400 });
  }
  if (input.consentConfirmed !== true) {
    return Response.json({ error: "Confirm that this guest agreed to receive the invitation by text." }, { status: 400 });
  }

  await ensureInvitationSchema();
  const guest = await getD1().prepare(`SELECT id, invite_token, name, phone
    FROM invitation_guests WHERE id = ? LIMIT 1`).bind(id).first<GuestRow>();
  if (!guest) return Response.json({ error: "Guest not found" }, { status: 404 });
  if (!guest.phone) return Response.json({ error: "Add a mobile number for this guest first." }, { status: 400 });

  let recipient: string;
  try {
    recipient = normalizePhoneNumber(guest.phone);
  } catch (phoneError) {
    return Response.json({ error: phoneError instanceof Error ? phoneError.message : "Enter a valid mobile number" }, { status: 400 });
  }

  const configuration = getSmsConfigurationStatus();
  if (!configuration.configured) {
    return Response.json({
      error: `SMS is ready in Argentum Studio, but Twilio still needs: ${configuration.missing.join(", ")}.`,
      sms: configuration,
    }, { status: 503 });
  }

  const event = await getEventSettings();
  const inviteUrl = `https://www.invitez.xyz/i/${guest.invite_token}`;
  const message = input.message?.trim() || invitationSmsMessage(guest.name, event.eventName, inviteUrl);
  if (message.length < 10 || message.length > 640) {
    return Response.json({ error: "Keep the SMS message between 10 and 640 characters." }, { status: 400 });
  }

  const deliveryId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    const result = await sendSmsMessage({ to: recipient, body: message });
    await getD1().batch([
      getD1().prepare(`INSERT INTO invitation_sms_deliveries (
        id, guest_id, provider, provider_message_id, recipient, message_body,
        status, error, sent_at, created_at
      ) VALUES (?, ?, 'twilio', ?, ?, ?, ?, NULL, ?, ?)`)
        .bind(deliveryId, guest.id, result.messageId, recipient, message, result.status, createdAt, createdAt),
      getD1().prepare(`UPDATE invitation_guests SET phone = ?, sent_at = COALESCE(sent_at, ?),
        updated_at = ? WHERE id = ?`).bind(recipient, createdAt, createdAt, guest.id),
    ]);
    return Response.json({ ok: true, status: result.status, sentAt: createdAt });
  } catch (sendError) {
    const error = sendError instanceof Error ? sendError.message : "The text message could not be sent.";
    await getD1().prepare(`INSERT INTO invitation_sms_deliveries (
      id, guest_id, provider, provider_message_id, recipient, message_body,
      status, error, sent_at, created_at
    ) VALUES (?, ?, 'twilio', NULL, ?, ?, 'failed', ?, NULL, ?)`)
      .bind(deliveryId, guest.id, recipient, message, error, createdAt)
      .run();
    return Response.json({ error }, { status: 502 });
  }
}
