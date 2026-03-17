import userModel from '../models/user.model.js'
import jwt from 'jsonwebtoken';
import tokenBlackListModel from "../models/blackList.model.js";

/**
    * Register User
    * @route POST /api/auth/register
    * @access Public
*/

async function userRegisterController(req, res) {
    const {email, name, password} = req.body;
    const isExist = await userModel.findOne({email})
    if(isExist) return res.status(400).json({msg: 'User already exists'})
    const user = await userModel.create({email, name,password})
    if(!user) return res.status(400).json({msg: 'Invalid user data'})
    const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '3d'})
    res.cookie('access_token', token)
    res.status(201).json({msg: 'User registered successfully'})
}

/**
 * Login User
 * @route POST /api/auth/login
 * @access Public
*/

async function userLoginController(req, res) {
    const {email, password} = req.body
    const user = await userModel.findOne({email}).select('+password')
    if (!user) return res.status(401).json({msg: 'Invalid credentials'})
    const isValid = await user.comparePassword(password)
    if(!isValid) return res.status(401).json({msg: 'Invalid credentials'})
    const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '3d'})
    res.cookie('access_token', token)
    res.status(200).json({msg: 'User logged in successfully'})
}

/**
 * Logout User
 * @route POST /api/auth/logout
 * @access Public
*/

async function userLogoutController(req, res) {
    const token = req.cookies.access_token || req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(200).json({msg: 'User logged out successfully'})
    res.clearCookie('access_token')
    try {
        await tokenBlackListModel.create({
            token
        })
        return res.status(200).json({msg: 'User logged out successfully'})
    } catch (err) {
        return res.status(200).json({
            msg: 'User logged out successfully'
        })
    }
}

export default {
    userRegisterController,
    userLoginController,
    userLogoutController,
}