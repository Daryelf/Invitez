import { env } from "cloudflare:workers";

export type EventSettings = {
  eventName: string;
  eventDate: string;
  eventTime: string;
  eventIso: string;
  venue: string;
  address: string;
  mapUrl: string;
  dayOfOverride: boolean;
  photoUploadsEnabled: boolean;
};

const DEFAULT_EVENT: EventSettings = {
  eventName: "Erika's Sweet 16",
  eventDate: "October 3, 2026",
  eventTime: "7:00 PM",
  eventIso: "2026-10-03T19:00:00-04:00",
  venue: "Centerville Banquet Hall",
  address: "",
  mapUrl: "",
  dayOfOverride: false,
  photoUploadsEnabled: true,
};

export function getD1() {
  if (!env.DB) throw new Error("Database is unavailable");
  return env.DB;
}

export async function ensureInvitationSchema() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS rsvps (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      guests INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS rsvps_email_unique ON rsvps (email)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY NOT NULL,
      object_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      content_type TEXT NOT NULL,
      caption TEXT,
      created_at TEXT NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS photos_object_key_unique ON photos (object_key)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS invitation_guests (
      id TEXT PRIMARY KEY NOT NULL,
      invite_token TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      party_size INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'pending',
      additional_information TEXT,
      sent_at TEXT,
      first_opened_at TEXT,
      last_opened_at TEXT,
      opened_count INTEGER NOT NULL DEFAULT 0,
      responded_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`),
    db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS invitation_guests_token_unique ON invitation_guests (invite_token)"),
    db.prepare("CREATE INDEX IF NOT EXISTS invitation_guests_status_idx ON invitation_guests (status)"),
    db.prepare(`CREATE TABLE IF NOT EXISTS event_settings (
      id TEXT PRIMARY KEY NOT NULL,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      event_iso TEXT NOT NULL,
      venue TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT '',
      map_url TEXT NOT NULL DEFAULT '',
      day_of_override INTEGER NOT NULL DEFAULT 0,
      photo_uploads_enabled INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    )`),
  ]);

  await db.prepare(`INSERT OR IGNORE INTO event_settings (
    id, event_name, event_date, event_time, event_iso, venue, address, map_url,
    day_of_override, photo_uploads_enabled, updated_at
  ) VALUES ('primary', ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`)
    .bind(
      DEFAULT_EVENT.eventName,
      DEFAULT_EVENT.eventDate,
      DEFAULT_EVENT.eventTime,
      DEFAULT_EVENT.eventIso,
      DEFAULT_EVENT.venue,
      DEFAULT_EVENT.address,
      DEFAULT_EVENT.mapUrl,
      new Date().toISOString(),
    )
    .run();
}

export async function getEventSettings(): Promise<EventSettings> {
  await ensureInvitationSchema();
  const row = await getD1().prepare(`SELECT
    event_name, event_date, event_time, event_iso, venue, address, map_url,
    day_of_override, photo_uploads_enabled
    FROM event_settings WHERE id = 'primary'`)
    .first<{
      event_name: string;
      event_date: string;
      event_time: string;
      event_iso: string;
      venue: string;
      address: string;
      map_url: string;
      day_of_override: number;
      photo_uploads_enabled: number;
    }>();

  if (!row) return DEFAULT_EVENT;
  return {
    eventName: row.event_name,
    eventDate: row.event_date,
    eventTime: row.event_time,
    eventIso: row.event_iso,
    venue: row.venue,
    address: row.address,
    mapUrl: row.map_url,
    dayOfOverride: Boolean(row.day_of_override),
    photoUploadsEnabled: Boolean(row.photo_uploads_enabled),
  };
}

export function isEventDayActive(settings: EventSettings, now = new Date()) {
  if (settings.dayOfOverride) return true;
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).map((part) => [part.type, part.value]));
  const today = `${parts.year}-${parts.month}-${parts.day}`;
  return today === settings.eventIso.slice(0, 10);
}

export function publicEvent(settings: EventSettings) {
  return {
    eventName: settings.eventName,
    eventDate: settings.eventDate,
    eventTime: settings.eventTime,
    eventIso: settings.eventIso,
    venue: settings.venue,
    address: settings.address,
    mapUrl: settings.mapUrl,
  };
}
