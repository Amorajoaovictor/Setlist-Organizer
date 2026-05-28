import { Router, type IRouter } from "express";
import healthRouter from "./health";
import setlistsRouter from "./setlists";
import deezerRouter from "./deezer";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/setlists", setlistsRouter);
router.use("/deezer", deezerRouter);

export default router;
