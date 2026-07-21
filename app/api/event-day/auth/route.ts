import { NextResponse } from "next/server";
import { EVENT_DAY_COOKIE, eventDayAccessToken } from "@/app/event-day/event-day-auth";
import { getAccessPins } from "@/app/access-pins";

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({})) as { pin?: unknown };
  const { eventDayPin } = await getAccessPins();
  if (input.pin !== eventDayPin) return NextResponse.json({ error: "That Event Day PIN is incorrect." }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(EVENT_DAY_COOKIE, eventDayAccessToken(eventDayPin), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/event-day",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
