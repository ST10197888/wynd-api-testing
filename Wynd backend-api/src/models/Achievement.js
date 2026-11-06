const mongoose = require("mongoose");

const achievementSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    requirement: { type: String },
    progress: { type: Number, default: 0 },
    target: { type: Number, required: true },
    isUnlocked: { type: Boolean, default: false },
    unlockedAt: { type: Date }
});

module.exports = mongoose.model("Achievement", achievementSchema);