import { Router, type IRouter } from "express";
import {
  fetchLrclibLyrics,
  getSongLyrics,
  linesFromPlainLyrics,
  saveSongLyrics,
} from "@workspace/db";
import { db } from "@workspace/db";
import { z } from "zod/v4";

const router: IRouter = Router({ mergeParams: true });

const lyricLineSchema = z.object({
  index: z.number().int().nonnegative(),
  text: z.string().min(1),
  startMs: z.number().int().nonnegative().nullable(),
});

const saveLyricsSchema = z.object({
  source: z.enum(["lrclib", "manual"]).default("manual"),
  lrclibId: z.number().int().nullable().optional(),
  plainLyrics: z.string().default(""),
  syncedLyrics: z.string().nullable().optional(),
  lines: z.array(lyricLineSchema).optional(),
  bpm: z.number().int().min(30).max(300).nullable().optional(),
});

function parseIds(params: { id?: string; songId?: string }) {
  const setlistId = Number.parseInt(params.id ?? "", 10);
  const songId = Number.parseInt(params.songId ?? "", 10);

  if (Number.isNaN(setlistId) || Number.isNaN(songId)) {
    return null;
  }

  return { setlistId, songId };
}

router.get("/", async (req, res) => {
  const ids = parseIds(req.params);
  if (!ids) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const lyrics = await getSongLyrics(ids.setlistId, ids.songId);
    if (!lyrics) {
      res.status(404).json({ error: "Lyrics not found" });
      return;
    }

    res.json(lyrics);
  } catch (err) {
    req.log.error({ err }, "Failed to get lyrics");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/", async (req, res) => {
  const ids = parseIds(req.params);
  if (!ids) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const parsed = saveLyricsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid lyrics data" });
    return;
  }

  try {
    const lyrics = await saveSongLyrics({
      ...ids,
      ...parsed.data,
      lines:
        parsed.data.lines ??
        linesFromPlainLyrics(parsed.data.plainLyrics),
    });

    if (!lyrics) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    res.json(lyrics);
  } catch (err) {
    req.log.error({ err }, "Failed to save lyrics");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/search", async (req, res) => {
  const ids = parseIds(req.params);
  if (!ids) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  try {
    const song = await db.setlistSong.findFirst({
      where: { id: ids.songId, setlistId: ids.setlistId },
    });

    if (!song) {
      res.status(404).json({ error: "Song not found" });
      return;
    }

    const lyrics = await fetchLrclibLyrics({
      trackName: song.title,
      artistName: song.artist,
      durationMs: song.durationMs,
    });

    if (!lyrics) {
      res.status(404).json({ error: "Lyrics not found on LRCLIB" });
      return;
    }

    res.json(lyrics);
  } catch (err) {
    req.log.error({ err }, "LRCLIB search failed");
    res.status(500).json({ error: "Failed to search LRCLIB" });
  }
});

export default router;
