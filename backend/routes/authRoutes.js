import { Router } from "express";
import { register, login, logout, getMe } from "../controllers/authController.js";
import { protect } from "../middleware/protect.js";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", protect, logout);
router.get("/me", protect, getMe);

export default router;
