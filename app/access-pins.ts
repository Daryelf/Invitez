import { getD1 } from "@/db/invitations";

export type AccessPins = {
  adminPin: string;
  designerPin: string;
  eventDayPin: string;
};

const DEFAULT_PINS: AccessPins = {
  adminPin: "7350",
  designerPin: "8412",
  eventDayPin: "8412",
};

async function ensureAccessPins() {
  const db = getD1();
  await db.prepare(`CREATE TABLE IF NOT EXISTS site_access_pins (
    id TEXT PRIMARY KEY NOT NULL,
    admin_pin TEXT NOT NULL DEFAULT '7350',
    designer_pin TEXT NOT NULL,
    event_day_pin TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`).run();

  const columns = await db.prepare("PRAGMA table_info(site_access_pins)").all<{ name: string }>();
  if (!(columns.results || []).some((column) => column.name === "admin_pin")) {
    await db.prepare("ALTER TABLE site_access_pins ADD COLUMN admin_pin TEXT NOT NULL DEFAULT '7350'").run();
  }

  await db.prepare(`INSERT OR IGNORE INTO site_access_pins (
    id, admin_pin, designer_pin, event_day_pin, updated_at
  ) VALUES ('primary', ?, ?, ?, ?)`)
    .bind(
      DEFAULT_PINS.adminPin,
      DEFAULT_PINS.designerPin,
      DEFAULT_PINS.eventDayPin,
      new Date().toISOString(),
    )
    .run();
}

export async function getAccessPins(): Promise<AccessPins> {
  await ensureAccessPins();
  const row = await getD1().prepare(`SELECT admin_pin, designer_pin, event_day_pin
    FROM site_access_pins WHERE id = 'primary'`)
    .first<{ admin_pin: string; designer_pin: string; event_day_pin: string }>();
  return row ? {
    adminPin: row.admin_pin,
    designerPin: row.designer_pin,
    eventDayPin: row.event_day_pin,
  } : DEFAULT_PINS;
}

export async function saveAccessPins(pins: AccessPins) {
  if (![pins.adminPin, pins.designerPin, pins.eventDayPin].every((pin) => /^\d{4}$/.test(pin))) {
    throw new Error("Each PIN must contain exactly four digits.");
  }
  await ensureAccessPins();
  await getD1().prepare(`UPDATE site_access_pins
    SET admin_pin = ?, designer_pin = ?, event_day_pin = ?, updated_at = ?
    WHERE id = 'primary'`)
    .bind(pins.adminPin, pins.designerPin, pins.eventDayPin, new Date().toISOString())
    .run();
  return pins;
}
