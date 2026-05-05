import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { z } from "zod/v4";
import lyricsRouter from "./lyrics";

const router: IRouter = Router();

router.use("/:id/songs/:songId/lyrics", lyricsRouter);

router.get("/", async (req, res) => {
  try {
    const rows = await db.setlist.findMany({
      include: { songs: true },
      orderBy: { createdAt: "asc" },
    });

    res.json(
      rows.map((setlist) => ({
        id: setlist.id,
        name: setlist.name,
        createdAt: setlist.createdAt,
        songCount: setlist.songs.length,
        totalDurationMs: setlist.songs.reduce(
          (total, song) => total + song.durationMs,
          0,
        ),
      })),
    );
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
    const setlist = await db.setlist.create({
      data: { name: parsed.data.name },
    });

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
    const setlist = await db.setlist.findUnique({
      where: { id },
      include: { songs: { orderBy: { position: "asc" } } },
    });

    if (!setlist) {
      res.status(404).json({ error: "Setlist not found" });
      return;
    }

    res.json(setlist);
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
    const updated = await db.setlist.updateMany({
      where: { id },
      data: { name: parsed.data.name },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: "Setlist not found" });
      return;
    }

    const setlist = await db.setlist.findUniqueOrThrow({ where: { id } });
    res.json(setlist);
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
    await db.setlist.deleteMany({ where: { id } });
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
    const maxPosition = await db.setlistSong.aggregate({
      where: { setlistId },
      _max: { position: true },
    });

    const song = await db.setlistSong.create({
      data: {
        setlistId,
        position: (maxPosition._max.position ?? -1) + 1,
        title: parsed.data.title,
        artist: parsed.data.artist,
        durationMs: parsed.data.durationMs,
        spotifyId: parsed.data.spotifyId ?? null,
        albumArt: parsed.data.albumArt ?? null,
      },
    });

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
    await db.setlistSong.deleteMany({ where: { id: songId } });
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
    await db.$transaction(
      parsed.data.songIds.map((songId, position) =>
        db.setlistSong.updateMany({
          where: { id: songId, setlistId },
          data: { position },
        }),
      ),
    );

    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to reorder songs");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
