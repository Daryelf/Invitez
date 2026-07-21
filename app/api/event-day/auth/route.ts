import { NextResponse } from "next/server";
import { EVENT_DAY_ACCESS_TOKEN, EVENT_DAY_COOKIE, EVENT_DAY_PIN } from "@/app/event-day/event-day-auth";

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({})) as { pin?: unknown };
  if (input.pin !== EVENT_DAY_PIN) return NextResponse.json({ error: "That Event Day PIN is incorrect." }, { status: 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(EVENT_DAY_COOKIE, EVENT_DAY_ACCESS_TOKEN, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/event-day",
    maxAge: 60 * 60 * 12,
  });
  return response;
}
