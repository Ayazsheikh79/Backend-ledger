import userModel from "../models/user.model.js";
import jwt from "jsonwebtoken";

async function authMiddleware(req, res, next) {
    const token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({
        msg: 'Unauthorized'
    })

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await userModel.findById(decoded.id);
        return next();
    } catch (err) {
        return res.status(401).json({
            msg: 'Unauthorized'
        })
    }
}

async function authSystemUserMiddleware(req, res, next) {
    const token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({
        msg: 'Unauthorized'
    })
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.id).select('+systemUser');
        if(!user.systemUser) return res.status(403).json({
            msg: 'Forbidden: Requires system user privileges'
        })
        req.user = user;
        return next();
    } catch (err) {
        return res.status(401).json({
            msg: 'Unauthorized'
        })
    }
}

export default {
    authMiddleware,
    authSystemUserMiddleware
}
