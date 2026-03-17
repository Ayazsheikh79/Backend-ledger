import express from 'express';
import authMiddleware from "../middleware/auth.middleware.js";
import accountController from '../controllers/account.controller.js'

const router = express.Router()

/**
 * @route POST /api/accounts
 * @access Protected
 * @desc Create a new account
 */
router.post('/', authMiddleware.authMiddleware, accountController.createAccountController)

/**
 * @route GET /api/accounts
 * @access Protected
 * @desc Get all accounts
 */
router.get('/', authMiddleware.authMiddleware, accountController.getUserAccountsController)

/**
 * @route GET /api/accounts/balance/:accountId
 * @access Protected
 * @desc Get account balance
 */
router.get('/balance/:accountId', authMiddleware.authMiddleware, accountController.getAccountBalanceController)


export default router;