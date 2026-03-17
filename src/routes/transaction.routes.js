import { Router } from 'express';
import authMiddleware from '../middleware/auth.middleware.js';
import transactionController from '../controllers/transaction.controller.js';

const transactionRoutes = Router();

/**
 * @route POST /api/transactions
 * @access Protected
 * @desc Create a new transaction
*/
transactionRoutes.post('/', authMiddleware.authMiddleware, transactionController.createTransaction)

/**
 * @route POST /api/transactions/system/initial-funds
 * @access Protected
 * @desc Create initial funds for the system
 */
transactionRoutes.post('/system/initial-funds', authMiddleware.authSystemUserMiddleware, transactionController.createInitialFundsTransaction)

export default transactionRoutes;