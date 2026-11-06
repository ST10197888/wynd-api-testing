const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    lastLoginAt: { type: Date },
    biometricEnabled: { type: Boolean, default: false },
    defaultLocationId: { type: mongoose.Schema.Types.ObjectId, ref: "SavedLocation" }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model("User", userSchema);