import { cookies } from "next/headers";
import EventDayPinGate from "./event-day-pin-gate";
import { EVENT_DAY_COOKIE, hasEventDayAccess } from "./event-day-auth";

export default async function EventDayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  if (!hasEventDayAccess(cookieStore.get(EVENT_DAY_COOKIE)?.value)) return <EventDayPinGate />;
  return children;
}
