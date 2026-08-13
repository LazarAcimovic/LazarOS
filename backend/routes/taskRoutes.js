import { Router } from "express";
import {
  getDashboard,
  getAllTasks,
  getUpcoming,
  getArchive,
  createTask,
  updateTask,
  deleteTask,
  restoreTask,
} from "../controllers/taskController.js";
import { protect } from "../middleware/protect.js";

const router = Router();

router.use(protect);

router.get("/dashboard", getDashboard);
router.get("/upcoming", getUpcoming);
router.get("/archive", getArchive);
router.get("/", getAllTasks);
router.post("/", createTask);
router.put("/:id", updateTask);
router.delete("/:id", deleteTask);
router.put("/:id/restore", restoreTask);

export default router;
