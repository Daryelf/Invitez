import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const rsvps = sqliteTable("rsvps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  guests: integer("guests").notNull().default(1),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

export const photos = sqliteTable("photos", {
  id: text("id").primaryKey(),
  objectKey: text("object_key").notNull().unique(),
  name: text("name").notNull(),
  contentType: text("content_type").notNull(),
  caption: text("caption"),
  createdAt: text("created_at").notNull(),
});

export const invitationGuests = sqliteTable("invitation_guests", {
  id: text("id").primaryKey(),
  inviteToken: text("invite_token").notNull().unique(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  partySize: integer("party_size").notNull().default(1),
  status: text("status").notNull().default("pending"),
  additionalInformation: text("additional_information"),
  sentAt: text("sent_at"),
  firstOpenedAt: text("first_opened_at"),
  lastOpenedAt: text("last_opened_at"),
  openedCount: integer("opened_count").notNull().default(0),
  respondedAt: text("responded_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const eventSettings = sqliteTable("event_settings", {
  id: text("id").primaryKey(),
  eventName: text("event_name").notNull(),
  eventDate: text("event_date").notNull(),
  eventTime: text("event_time").notNull(),
  eventIso: text("event_iso").notNull(),
  venue: text("venue").notNull(),
  address: text("address").notNull().default(""),
  mapUrl: text("map_url").notNull().default(""),
  dayOfOverride: integer("day_of_override", { mode: "boolean" }).notNull().default(false),
  photoUploadsEnabled: integer("photo_uploads_enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: text("updated_at").notNull(),
});
