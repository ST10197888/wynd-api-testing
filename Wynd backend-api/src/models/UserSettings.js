const mongoose = require("mongoose");

const userSettingsSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    temperatureUnit: { type: String, enum: ["C", "F"], default: "C" },
    windSpeedUnit: { type: String, enum: ["km/h", "mph"], default: "km/h" },
    precipitationUnit: { type: String, enum: ["mm", "in"], default: "mm" },
    timeFormat: { type: String, enum: ["12h", "24h"], default: "24h" },
    theme: { type: String, enum: ["Light", "Dark", "System"], default: "System" },
    language: { type: String, enum: ["English", "Afrikaans", "isiZulu"], default: "English" },
    notificationsEnabled: { type: Boolean, default: true },
    smartAlertsEnabled: { type: Boolean, default: true },
    automaticLocationEnabled: { type: Boolean, default: true },
    biometricEnabled: { type: Boolean, default: false }
});

module.exports = mongoose.model("UserSettings", userSettingsSchema);