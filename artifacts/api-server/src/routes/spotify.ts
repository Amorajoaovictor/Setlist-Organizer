import { Router, type IRouter } from "express";
import { searchTracks } from "../lib/spotify";

const router: IRouter = Router();

router.get("/search", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

  if (!q) {
    res.status(400).json({ error: "Query parameter 'q' is required" });
    return;
  }

  try {
    const tracks = await searchTracks(q);
    res.json(tracks);
  } catch (err) {
    req.log.error({ err }, "Spotify search failed");
    res.status(500).json({ error: "Failed to search Spotify" });
  }
});

export default router;
