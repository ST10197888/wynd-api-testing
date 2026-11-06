const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");

const router = express.Router();

router.post("/auth/register", [
    body("email").notEmpty().isEmail().withMessage("A valid email is required.").normalizeEmail(),
    body("password").notEmpty().isLength({ min: 8 }).withMessage("Password must be at least 8 characters.")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { email, password } = req.body;
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }
        const passwordHash = await bcrypt.hash(password, 10);
        const newUser = await User.create({ email, passwordHash });
        return res.status(201).json({ message: "User registered successfully.", userId: newUser._id });
    } catch (err) {
        console.error("Register error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.post("/auth/login", [
    body("email").notEmpty().isEmail().withMessage("A valid email is required.").normalizeEmail(),
    body("password").notEmpty().withMessage("Password is required.")
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ success: false, message: "Incorrect email or password." });
        }
        const matched = await bcrypt.compare(password, user.passwordHash);
        if (!matched) {
            return res.status(401).json({ success: false, message: "Incorrect email or password." });
        }
        user.lastLoginAt = new Date();
        await user.save();
        const token = jwt.sign({ userId: user._id, email: user.email }, process.env.JWT_SECRET, {
            expiresIn: process.env.JWT_EXPIRES_IN
        });
        return res.status(200).json({ token, userId: user._id });
    } catch (err) {
        console.error("Login error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

module.exports = router;