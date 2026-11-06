const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
    token: { type: String, required: true },
    deviceId: { type: String, required: true },
    platform: { type: String, enum: ["android", "ios", "web", "unknown"], default: "android" },
    timezone: { type: String, default: "UTC" },
    lastSeenAt: { type: Date, default: Date.now }
}, { _id: false });

const notificationPreferenceSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    enabled: { type: Boolean, default: true },
    smartAlertsEnabled: { type: Boolean, default: true },
    rainAlertsEnabled: { type: Boolean, default: true },
    severeWeatherAlertsEnabled: { type: Boolean, default: true },
    dailyWeatherEnabled: { type: Boolean, default: true },
    rainProbabilityThreshold: { type: Number, min: 1, max: 100, default: 60 },
    dailyNotificationHour: { type: Number, min: 0, max: 23, default: 8 },
    timezone: { type: String, default: "UTC" },
    locationName: { type: String, trim: true, maxlength: 120 },
    devices: { type: [deviceSchema], default: [] },
    // Kept for compatibility with older app builds and existing Postman requests.
    fcmToken: { type: String, select: false }
}, { timestamps: { createdAt: false, updatedAt: true } });

module.exports = mongoose.model("NotificationPreference", notificationPreferenceSchema);
