import mongoose from 'mongoose'

const accountSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user',
        required: [true, 'Account must be associated with a user']
    },
    status: {
        enum: {
            values: ['ACTIVE', 'FROZEN', 'CLOSED'],
        }
    }
})