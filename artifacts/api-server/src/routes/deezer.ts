import { Router, type IRouter } from "express";
import { searchTracks } from "../lib/deezer";

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
    req.log.error({ err }, "Deezer search failed");
    res.status(500).json({ error: "Failed to search Deezer" });
  }
});

export default router;
