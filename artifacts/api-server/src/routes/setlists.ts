import { Router, type IRouter } from "express";
import { db, setlistsTable, setlistSongsTable } from "@workspace/db";
import { eq, sql, asc } from "drizzle-orm";
import { z } from "zod/v4";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const rows = await db
      .select({
        id: setlistsTable.id,
        name: setlistsTable.name,
        createdAt: setlistsTable.createdAt,
        songCount: sql<number>`count(${setlistSongsTable.id})::int`,
        totalDurationMs: sql<number>`coalesce(sum(${setlistSongsTable.durationMs}), 0)::int`,
      })
      .from(setlistsTable)
      .leftJoin(setlistSongsTable, eq(setlistSongsTable.setlistId, setlistsTable.id))
      .groupBy(setlistsTable.id)
      .orderBy(asc(setlistsTable.createdAt));

    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to list setlists");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  try {
    const [setlist] = await db
      .insert(setlistsTable)
      .values({ name: parsed.data.name })
      .returning();

    res.status(201).json({
      ...setlist,
      songCount: 0,
      totalDurationMs: 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create setlist");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const [setlist] = await db
      .select()
      .from(setlistsTable)
      .where(eq(setlistsTable.id, id));

    if (!setlist) {
      res.status(404).json({ error: "Setlist not found" });
      return;
    }

    const songs = await db
      .select()
      .from(setlistSongsTable)
      .where(eq(setlistSongsTable.setlistId, id))
      .orderBy(asc(setlistSongsTable.position));

    res.json({ ...setlist, songs });
  } catch (err) {
    req.log.error({ err }, "Failed to get setlist");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const schema = z.object({ name: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Name is required" });
    return;
  }

  try {
    const [updated] = await db
      .update(setlistsTable)
      .set({ name: parsed.data.name })
      .where(eq(setlistsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Setlist not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update setlist");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    await db.delete(setlistsTable).where(eq(setlistsTable.id, id));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to delete setlist");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:id/songs", async (req, res) => {
  const setlistId = parseInt(req.params.id, 10);
  if (isNaN(setlistId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const schema = z.object({
    title: z.string().min(1),
    artist: z.string().min(1),
    durationMs: z.number().int().positive(),
    spotifyId: z.string().optional(),
    albumArt: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid song data" });
    return;
  }

  try {
    const [{ maxPos }] = await db
      .select({ maxPos: sql<number>`coalesce(max(${setlistSongsTable.position}), -1)::int` })
      .from(setlistSongsTable)
      .where(eq(setlistSongsTable.setlistId, setlistId));

    const [song] = await db
      .insert(setlistSongsTable)
      .values({
        setlistId,
        position: maxPos + 1,
        title: parsed.data.title,
        artist: parsed.data.artist,
        durationMs: parsed.data.durationMs,
        spotifyId: parsed.data.spotifyId ?? null,
        albumArt: parsed.data.albumArt ?? null,
      })
      .returning();

    res.status(201).json(song);
  } catch (err) {
    req.log.error({ err }, "Failed to add song");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:id/songs/:songId", async (req, res) => {
  const songId = parseInt(req.params.songId, 10);
  if (isNaN(songId)) {
    res.status(400).json({ error: "Invalid songId" });
    return;
  }

  try {
    await db.delete(setlistSongsTable).where(eq(setlistSongsTable.id, songId));
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove song");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:id/songs/reorder", async (req, res) => {
  const setlistId = parseInt(req.params.id, 10);
  if (isNaN(setlistId)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const schema = z.object({ songIds: z.array(z.number().int()) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "songIds array required" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < parsed.data.songIds.length; i++) {
        await tx
          .update(setlistSongsTable)
          .set({ position: i })
          .where(eq(setlistSongsTable.id, parsed.data.songIds[i]));
      }
    });

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reorder songs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
