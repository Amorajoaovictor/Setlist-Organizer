import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const setlistsTable = pgTable("setlists", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const setlistSongsTable = pgTable("setlist_songs", {
  id: serial("id").primaryKey(),
  setlistId: integer("setlist_id")
    .notNull()
    .references(() => setlistsTable.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  title: text("title").notNull(),
  artist: text("artist").notNull(),
  durationMs: integer("duration_ms").notNull(),
  spotifyId: text("spotify_id"),
  albumArt: text("album_art"),
});

export const insertSetlistSchema = createInsertSchema(setlistsTable).omit({ id: true, createdAt: true });
export const insertSetlistSongSchema = createInsertSchema(setlistSongsTable).omit({ id: true });

export type Setlist = typeof setlistsTable.$inferSelect;
export type InsertSetlist = z.infer<typeof insertSetlistSchema>;
export type SetlistSong = typeof setlistSongsTable.$inferSelect;
export type InsertSetlistSong = z.infer<typeof insertSetlistSongSchema>;
