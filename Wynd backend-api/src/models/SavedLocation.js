const mongoose = require("mongoose");

const savedLocationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    locationName: { type: String, required: true },
    latitude: { type: Number },
    longitude: { type: Number },
    country: { type: String },
    isDefault: { type: Boolean, default: false },
    clientId: { type: String },
    clientTimestamp: { type: Date }
}, { timestamps: { createdAt: true, updatedAt: false } });

savedLocationSchema.index(
    { userId: 1, clientId: 1 },
    { unique: true, partialFilterExpression: { clientId: { $type: "string" } } }
);

module.exports = mongoose.model("SavedLocation", savedLocationSchema);