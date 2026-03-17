import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    fromAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'Transaction must be associated with an account'],
        index: true
    },
    toAccount: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'account',
        required: [true, 'Transaction must be associated with an account'],
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ['PENDING', 'COMPLETED', 'FAILED', 'REVERSED'],
            message: 'Status must be PENDING, COMPLETED, FAILED or REVERSED',
        },
        default: 'PENDING'
    },
    amount: {
        type: Number,
        required: [true, 'Amount is required for creating a transaction'],
        min: [0, 'Amount must be greater than or equal to 0']
    },
    idempotencyKey: {
        type: String,
        required: [true, 'Idempotency key is required for creating a transaction'],
        index: true,
        unique: true
    }
}, {
    timestamps: true
})

const transactionModel = mongoose.model('transaction', transactionSchema);

export default transactionModel;