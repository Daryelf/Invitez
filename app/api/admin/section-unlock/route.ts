import { matchesAdminPin, requireAdminApi } from "@/app/admin-auth";
import { getAccessPins } from "@/app/access-pins";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.response) return auth.response;
  const input = await request.json().catch(() => ({})) as { section?: unknown; pin?: unknown };
  const pins = await getAccessPins();
  const valid = input.section === "designer"
    ? await matchesAdminPin(String(input.pin || ""))
    : input.section === "event" && input.pin === pins.eventDayPin;
  if (!valid) return Response.json({ error: "That PIN is incorrect." }, { status: 401 });
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
