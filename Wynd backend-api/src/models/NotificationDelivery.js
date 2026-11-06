const mongoose = require("mongoose");

const notificationDeliverySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    dedupeKey: { type: String, required: true },
    kind: { type: String, required: true },
    locationName: { type: String },
    status: { type: String, enum: ["sending", "sent"], default: "sending" },
    sentAt: { type: Date, default: null }
}, { timestamps: { createdAt: true, updatedAt: true }, versionKey: false });

notificationDeliverySchema.index({ userId: 1, dedupeKey: 1 }, { unique: true });
notificationDeliverySchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model("NotificationDelivery", notificationDeliverySchema);
