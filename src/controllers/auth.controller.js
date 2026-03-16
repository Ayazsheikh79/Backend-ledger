import userModel from '../models/user.model.js'
import jwt from 'jsonwebtoken';
import emailService from '../services/email.service.js'

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
    const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '30d'})
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
    const token = jwt.sign({id: user._id}, process.env.JWT_SECRET, {expiresIn: '30d'})
    res.cookie('access_token', token)
    res.status(200).json({msg: 'User logged in successfully'})
    await emailService.sendRegistrationEmail(user.email, user.name)
}

export default {
    userRegisterController,
    userLoginController
}