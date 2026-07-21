export const EVENT_DAY_COOKIE = "invitez_event_day_access";
export const EVENT_DAY_PIN = "8412";
export const EVENT_DAY_ACCESS_TOKEN = "invitez-event-day-8412";

export function hasEventDayAccess(value: string | undefined) {
  return value === EVENT_DAY_ACCESS_TOKEN;
}
