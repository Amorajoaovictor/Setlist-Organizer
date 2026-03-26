import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import setlistsRouter from "./setlists";
import spotifyRouter from "./spotify";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use("/setlists", setlistsRouter);
router.use("/spotify", spotifyRouter);

export default router;
