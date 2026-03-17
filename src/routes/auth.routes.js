import express from "express";
import authController from "../controllers/auth.controller.js";

const router = express.Router();

/**
 * @route POST /api/auth/register
 * @access Public
 * @desc Register User
 */

router.post('/register', authController.userRegisterController);

/**
 * @route POST /api/auth/login
 * @access Public
 * @desc Login User
*/

router.post("/login", authController.userLoginController)

/**
 * @route POST /api/auth/logout
 * @access Public
 * @desc Logout User
 */

router.get("/logout", authController.userLogoutController)

export default router;