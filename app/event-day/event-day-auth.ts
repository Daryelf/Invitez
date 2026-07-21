export const EVENT_DAY_COOKIE = "invitez_event_day_access";
export function eventDayAccessToken(pin: string) { return `invitez-event-day-${pin}`; }
export function hasEventDayAccess(value: string | undefined, pin: string) { return value === eventDayAccessToken(pin); }
