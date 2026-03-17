import mongoose from "mongoose";

const ledgerSchema = new mongoose.Schema({
    account: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'Ledger must be associated with an account'],
        index: true,
        immutable: true
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required for creating a ledger'],
        immutable: true
    },
    transaction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'transaction',
        required: [true, 'Ledger must be associated with a transaction'],
        index: true,
        immutable: true
    },
    type: {
        type: String,
        enum: {
            values: ['CREDIT', 'DEBIT'],
            message: 'Type must be CREDIT or DEBIT',
        },
        required: [true, 'Type is required for creating a ledger'],
        immutable: true
    }
})

function preventLedgerModification() {
    throw new Error('Ledger modification is not allowed.')
}

ledgerSchema.pre('findOneAndUpdate', preventLedgerModification)
ledgerSchema.pre('updateOne', preventLedgerModification)
ledgerSchema.pre('updateMany', preventLedgerModification)
ledgerSchema.pre('deleteOne', preventLedgerModification)
ledgerSchema.pre('deleteMany', preventLedgerModification)
ledgerSchema.pre('findOneAndDelete', preventLedgerModification)
ledgerSchema.pre('findOneAndUpdate', preventLedgerModification)
ledgerSchema.pre('findOneAndReplace', preventLedgerModification)
ledgerSchema.pre('bulkWrite', preventLedgerModification)

const ledgerModel = mongoose.model('ledger', ledgerSchema);
export default ledgerModel;