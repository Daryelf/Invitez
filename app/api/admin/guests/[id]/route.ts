import { ensureInvitationSchema, getD1 } from "@/db/invitations";
import { requireAdminApi } from "@/app/admin-auth";
import { normalizePhoneNumber } from "@/lib/sms";

const STATUSES = new Set(["pending", "attending", "declined"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const { id } = await context.params;

  let input: {
    name?: string;
    email?: string;
    phone?: string;
    partySize?: number;
    status?: string;
    additionalInformation?: string;
    markSent?: boolean;
  };
  try {
    input = await request.json() as typeof input;
  } catch {
    return Response.json({ error: "Invalid update" }, { status: 400 });
  }

  await ensureInvitationSchema();
  const existing = await getD1().prepare("SELECT * FROM invitation_guests WHERE id = ?").bind(id).first<Record<string, unknown>>();
  if (!existing) return Response.json({ error: "Guest not found" }, { status: 404 });

  const now = new Date().toISOString();
  const status = input.status && STATUSES.has(input.status) ? input.status : String(existing.status);
  const respondedAt = status === "pending" ? null : (existing.responded_at || now);
  const sentAt = input.markSent === true ? (existing.sent_at || now) : input.markSent === false ? null : existing.sent_at;
  let phone = existing.phone;
  try {
    phone = input.phone === undefined ? existing.phone : input.phone.trim() ? normalizePhoneNumber(input.phone) : null;
  } catch (phoneError) {
    return Response.json({ error: phoneError instanceof Error ? phoneError.message : "Enter a valid mobile number" }, { status: 400 });
  }
  await getD1().prepare(`UPDATE invitation_guests SET
    name = ?, email = ?, phone = ?, party_size = ?, status = ?, additional_information = ?,
    sent_at = ?, responded_at = ?, updated_at = ? WHERE id = ?`)
    .bind(
      input.name?.trim() || existing.name,
      input.email === undefined ? existing.email : input.email.trim().toLowerCase() || null,
      phone,
      input.partySize === undefined ? existing.party_size : Math.min(20, Math.max(1, Number(input.partySize) || 1)),
      status,
      input.additionalInformation === undefined ? existing.additional_information : input.additionalInformation.trim() || null,
      sentAt,
      respondedAt,
      now,
      id,
    )
    .run();
  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const { id } = await context.params;
  await ensureInvitationSchema();
  await getD1().prepare("DELETE FROM invitation_guests WHERE id = ?").bind(id).run();
  return Response.json({ ok: true });
}
