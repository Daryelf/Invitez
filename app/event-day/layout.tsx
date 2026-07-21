import { cookies } from "next/headers";
import EventDayPinGate from "./event-day-pin-gate";
import { EVENT_DAY_COOKIE, hasEventDayAccess } from "./event-day-auth";
import { getAccessPins } from "@/app/access-pins";

export default async function EventDayLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const { eventDayPin } = await getAccessPins();
  if (!hasEventDayAccess(cookieStore.get(EVENT_DAY_COOKIE)?.value, eventDayPin)) return <EventDayPinGate />;
  return children;
}
