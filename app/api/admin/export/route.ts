import { ensureInvitationSchema, getD1, getEventSettings } from "@/db/invitations";
import { requireAdminApi } from "@/app/admin-auth";

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export async function GET() {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  await ensureInvitationSchema();
  const [result, event] = await Promise.all([
    getD1().prepare(`SELECT name, email, phone, party_size, status,
      additional_information, sent_at, first_opened_at, opened_count, responded_at
      FROM invitation_guests ORDER BY name COLLATE NOCASE`).all<Record<string, unknown>>(),
    getEventSettings(),
  ]);
  const headers = ["Name", "Email", "Phone", "Party size", "Status", "Additional information", "Sent", "First opened", "Open count", "Responded"];
  const rows = result.results.map((row: Record<string, unknown>) => [row.name, row.email, row.phone, row.party_size, row.status, row.additional_information, row.sent_at, row.first_opened_at, row.opened_count, row.responded_at]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename=${event.eventName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event"}-rsvps.csv`,
      "Cache-Control": "no-store",
    },
  });
}
