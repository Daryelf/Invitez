import { requireAdminApi } from "@/app/admin-auth";
import { ensureInvitationSchema, getD1, getEventSettings } from "@/db/invitations";
import { createGuestListPdf, type GuestListPdfEntry } from "@/lib/guest-list-pdf";

type GuestRow = {
  name: string;
  party_size: number;
  status: string;
  additional_information: string | null;
};

function safeFilename(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  await ensureInvitationSchema();

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter");
  const query = (url.searchParams.get("q") || "").trim().toLowerCase().slice(0, 100);
  const [result, event] = await Promise.all([
    getD1().prepare(`SELECT name, party_size, status, additional_information
      FROM invitation_guests
      WHERE status IN ('attending', 'declined')
      ORDER BY name COLLATE NOCASE`).all<GuestRow>(),
    getEventSettings(),
  ]);

  const guests = result.results
    .filter((guest) => filter !== "attending" && filter !== "declined" || guest.status === filter)
    .filter((guest) => !query || `${guest.name} ${guest.additional_information || ""}`.toLowerCase().includes(query))
    .map((guest): GuestListPdfEntry => ({
      name: guest.name,
      partySize: guest.party_size,
      status: guest.status === "declined" ? "declined" : "attending",
      additionalInformation: guest.additional_information || "",
    }));

  const filterLabel = filter === "attending" ? "Attending guests" : filter === "declined" ? "Not going" : "All responses";
  const viewLabel = query ? `${filterLabel} - filtered search` : filterLabel;
  const pdf = createGuestListPdf({
    eventName: event.eventName,
    eventDate: event.eventDate,
    eventTime: event.eventTime,
    venue: event.venue,
    viewLabel,
    guests,
  });
  const disposition = url.searchParams.get("download") === "1" ? "attachment" : "inline";
  return new Response(pdf, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${safeFilename(event.eventName)}-guest-list.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
