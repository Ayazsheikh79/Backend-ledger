import mongoose from "mongoose";

const tokenBlackListSchema = new mongoose.Schema({
    token: {
        type: String,
        required: [true, 'Token is required for blacklisting'],
        unique: [true, 'Token already exists in the blacklist'],
    }
}, {
    timestamps: true
})

tokenBlackListSchema.index({createdAt: 1},{
    expireAfterSeconds: 3600 * 24 * 3
})

const tokenBlackListModel = mongoose.model('tokenBlackList', tokenBlackListSchema);

export default tokenBlackListModel;