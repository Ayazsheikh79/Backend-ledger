import transactionModel from "../models/transaction.model.js";
import ledgerModel from "../models/ledger.model.js";
import emailService from "../services/email.service.js";
import accountModel from "../models/account.model.js";
import mongoose from "mongoose";

/**
 * - Create a new transaction
 * - THE 10-STEP TRANSFER FLOW:
 * 1. Validate request
 * 2. Validate an idempotency key
 * 3. Check account status
 * 4. Derive sender balance from ledger
 * 5. Create transaction (PENDING)
 * 6. Create a DEBIT ledger entry
 * 7. Create a CREDIT ledger entry
 * 8. Mark transaction as COMPLETED
 * 9. Commit MongoDB session
 * 10. send email notification
*/


/**
 * 1. Validate request
*/
async function createTransaction(req, res) {
    const {fromAccount, toAccount, amount, idempotencyKey} = req.body
    if (!fromAccount || !toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({msg: 'All fields are required'})
    }

    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount,
    })

    const toUserAccount = await accountModel.findOne({
        _id: toAccount,
    })

    if (!fromUserAccount || !toUserAccount) {
        return res.status(404).json({msg: 'Account not found'})
    }

    /**
     * 2. Validate an idempotency key
     */
    const existingTransaction = await transactionModel.findOne({idempotencyKey})
    if (existingTransaction) {
        if (existingTransaction.status === 'COMPLETED') {
            return res.status(200).json({msg: 'Transaction already completed'})
        }
        if (existingTransaction.status === 'PENDING') {
            return res.status(409).json({msg: 'Transaction already in progress'})
        }
        if (existingTransaction.status === 'FAILED') {
            return res.status(409).json({msg: 'Previous transaction attempt failed. Please try again.'})
        }
        if (existingTransaction.status === 'REVERSED') {
            return res.status(409).json({msg: 'Previous transaction attempt was reversed. Please try again.'})
        }
    }

    /**
     * 3. Check Account Status
     */
    if (fromUserAccount.status !== 'ACTIVE' || toUserAccount.status !== 'ACTIVE') {
        return res.status(403).json({msg: 'Both accounts must be active to perform a transaction'})
    }

    /**
     * 4. Derive sender balance from ledger
     */
    const balance = await fromUserAccount.getBalance()
    if (balance < amount) {
        return res.status(400).json({msg: 'Insufficient funds'})
    }

    /**
     * 5. Create transaction (PENDING)
     */
    const session = await mongoose.startSession()
    session.startTransaction()
    const transaction = await transactionModel.create({
        fromAccount,
        toAccount,
        amount,
        idempotencyKey,
        status: 'PENDING'
    },{session})

    const debitLedgerEntry = await ledgerModel.create({
        account: fromAccount,
        amount,
        transaction: transaction._id,
        type: 'DEBIT'
    }, {session})

    const creditLedgerEntry = await ledgerModel.create({
        account: toAccount,
        amount,
        transaction: transaction._id,
        type: 'CREDIT'
    }, {session})

    transaction.satus = 'COMPLETED'
    await transaction.save({session})

    await session.commitTransaction()
    session.endSession()

    /**
     * 10. Send email notification
     */

    await emailService.sendTransactionEmail(
        req.user.email,
        req.user.name,
        amount,
        fromAccount,
        toAccount
    )
    return res.status(201).json({msg: 'Transaction successful', transaction})
}

async function createInitialFundsTransaction(req, res) {
    const {toAccount, amount, idempotencyKey} = req.body
    if (!toAccount || !amount || !idempotencyKey) {
        return res.status(400).json({msg: 'All fields are required'})
    }

    const toUserAccount = await accountModel.findOne({
        _id: toAccount,
    })

    if(!toUserAccount) {
        return res.status(404).json({msg: 'Account not found'})
    }

    const fromUserAccount = await accountModel.findOne({
        user: req.user._id
    })

    if(!fromUserAccount) {
        return res.status(404).json({msg: 'System user account not found'})
    }

    /**
     * Creating a transaction
     */

    const session = await mongoose.startSession()
    session.startTransaction()

    const transaction = new transactionModel({
        fromAccount: fromUserAccount._id,
        toAccount,
        amount,
        idempotencyKey,
        status: 'PENDING'
    })

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        amount,
        transaction: transaction._id,
        type: 'DEBIT'
    }], {session})

    const creditLedgerEntry = await ledgerModel.create([{
        account: toAccount,
        amount,
        transaction: transaction._id,
        type: 'CREDIT'
    }], {session})

    transaction.status = 'COMPLETED'
    await transaction.save({session})
    await session.commitTransaction()
    session.endSession()
    return res.status(201).json({msg: 'Initial funds transaction successful', transaction})
}

export default {
    createTransaction,
    createInitialFundsTransaction
}