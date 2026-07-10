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
