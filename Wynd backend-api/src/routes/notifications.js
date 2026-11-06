const express = require("express");
const { body, validationResult } = require("express-validator");
const authenticateToken = require("../middleware/authMiddleware");
const requireOwner = require("../middleware/requireOwner");
const NotificationPreference = require("../models/NotificationPreference");
const UserSettings = require("../models/UserSettings");
const { sendPushToUser } = require("../services/notificationService");

const router = express.Router();
const PREFERENCE_FIELDS = [
    "enabled",
    "smartAlertsEnabled",
    "rainAlertsEnabled",
    "severeWeatherAlertsEnabled",
    "dailyWeatherEnabled",
    "rainProbabilityThreshold",
    "dailyNotificationHour",
    "timezone",
    "locationName"
];

function validationFailed(req, res) {
    const errors = validationResult(req);
    if (errors.isEmpty()) return false;
    res.status(400).json({ success: false, errors: errors.array() });
    return true;
}

function serializePreferences(preference) {
    return {
        enabled: preference?.enabled ?? true,
        smartAlertsEnabled: preference?.smartAlertsEnabled ?? true,
        rainAlertsEnabled: preference?.rainAlertsEnabled ?? true,
        severeWeatherAlertsEnabled: preference?.severeWeatherAlertsEnabled ?? true,
        dailyWeatherEnabled: preference?.dailyWeatherEnabled ?? true,
        rainProbabilityThreshold: preference?.rainProbabilityThreshold ?? 60,
        dailyNotificationHour: preference?.dailyNotificationHour ?? 8,
        timezone: preference?.timezone || "UTC",
        locationName: preference?.locationName || null,
        registeredDevices: preference?.devices?.length || (preference?.fcmToken ? 1 : 0)
    };
}

router.get("/users/:userId/notifications/preferences", authenticateToken, requireOwner, async (req, res) => {
    try {
        const [preference, userSettings] = await Promise.all([
            NotificationPreference.findOne({ userId: req.params.userId }).select("+fcmToken"),
            UserSettings.findOne({ userId: req.params.userId })
        ]);
        const preferences = serializePreferences(preference);
        if (!preference && userSettings) {
            preferences.enabled = userSettings.notificationsEnabled;
            preferences.smartAlertsEnabled = userSettings.smartAlertsEnabled;
        }
        return res.status(200).json({ success: true, preferences });
    } catch (err) {
        console.error("Get notification preferences error:", err.message);
        return res.status(500).json({ success: false, message: "Could not load notification preferences." });
    }
});

router.put("/users/:userId/notifications/preferences", authenticateToken, requireOwner, [
    body("enabled").optional().isBoolean(),
    body("smartAlertsEnabled").optional().isBoolean(),
    body("rainAlertsEnabled").optional().isBoolean(),
    body("severeWeatherAlertsEnabled").optional().isBoolean(),
    body("dailyWeatherEnabled").optional().isBoolean(),
    body("rainProbabilityThreshold").optional().isInt({ min: 1, max: 100 }),
    body("dailyNotificationHour").optional().isInt({ min: 0, max: 23 }),
    body("timezone").optional().isString().isLength({ min: 1, max: 80 }),
    body("locationName").optional({ nullable: true }).isString().isLength({ min: 1, max: 120 })
], async (req, res) => {
    try {
        if (validationFailed(req, res)) return;
        const update = {};
        for (const field of PREFERENCE_FIELDS) {
            if (req.body[field] !== undefined) update[field] = req.body[field];
        }
        if (update.timezone) {
            try {
                new Intl.DateTimeFormat("en", { timeZone: update.timezone });
            } catch (_) {
                return res.status(400).json({ success: false, message: "timezone must be a valid IANA timezone." });
            }
        }

        const preference = await NotificationPreference.findOneAndUpdate(
            { userId: req.params.userId },
            { $set: update },
            { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
        ).select("+fcmToken");

        const settingsUpdate = {};
        if (update.enabled !== undefined) settingsUpdate.notificationsEnabled = update.enabled;
        if (update.smartAlertsEnabled !== undefined) settingsUpdate.smartAlertsEnabled = update.smartAlertsEnabled;
        if (Object.keys(settingsUpdate).length) {
            await UserSettings.findOneAndUpdate(
                { userId: req.params.userId },
                { $set: settingsUpdate },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Notification preferences updated.",
            preferences: serializePreferences(preference)
        });
    } catch (err) {
        console.error("Update notification preferences error:", err.message);
        return res.status(500).json({ success: false, message: "Could not update notification preferences." });
    }
});

router.put("/users/:userId/fcm-token", authenticateToken, requireOwner, [
    body("fcmToken").isString().isLength({ min: 20, max: 4096 }),
    body("deviceId").optional().isString().isLength({ min: 8, max: 128 }),
    body("platform").optional().isIn(["android", "ios", "web", "unknown"]),
    body("timezone").optional().isString().isLength({ min: 1, max: 80 }),
    body("locationName").optional().isString().isLength({ min: 1, max: 120 })
], async (req, res) => {
    try {
        if (validationFailed(req, res)) return;
        const userId = req.params.userId;
        const { fcmToken } = req.body;
        const deviceId = req.body.deviceId || `legacy-${fcmToken.slice(0, 24)}`;
        const timezone = req.body.timezone || "UTC";
        try {
            new Intl.DateTimeFormat("en", { timeZone: timezone });
        } catch (_) {
            return res.status(400).json({ success: false, message: "timezone must be a valid IANA timezone." });
        }

        // A single FCM token must never remain attached to two user accounts.
        await NotificationPreference.updateMany(
            { "devices.token": fcmToken, userId: { $ne: userId } },
            { $pull: { devices: { token: fcmToken } } }
        );
        await NotificationPreference.updateMany(
            { fcmToken, userId: { $ne: userId } },
            { $unset: { fcmToken: 1 } }
        );

        const existingPreference = await NotificationPreference.findOne({ userId }).select("+fcmToken");
        const existingSettings = existingPreference ? null : await UserSettings.findOne({ userId });
        const existingDevice = existingPreference?.devices.find(device => device.token === fcmToken);
        const effectiveDeviceId = existingDevice?.deviceId || deviceId;

        // Migrate the single-token field used by older app builds into the multi-device list.
        if (existingPreference?.fcmToken && existingPreference.fcmToken !== fcmToken &&
            !existingPreference.devices.some(device => device.token === existingPreference.fcmToken)) {
            const oldToken = existingPreference.fcmToken;
            existingPreference.devices.push({
                token: oldToken,
                deviceId: `legacy-${oldToken.slice(0, 24)}`,
                platform: "android",
                timezone: existingPreference.timezone || timezone,
                lastSeenAt: new Date()
            });
            await existingPreference.save();
        }

        const preference = await NotificationPreference.findOneAndUpdate(
            { userId },
            {
                $set: {
                    fcmToken,
                    timezone,
                    ...(req.body.locationName ? { locationName: req.body.locationName.trim() } : {})
                },
                $setOnInsert: {
                    enabled: existingSettings?.notificationsEnabled ?? true,
                    smartAlertsEnabled: existingSettings?.smartAlertsEnabled ?? true
                },
                $pull: { devices: { $or: [{ token: fcmToken }, { deviceId: effectiveDeviceId }] } }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).select("+fcmToken");
        preference.devices.push({
            token: fcmToken,
            deviceId: effectiveDeviceId,
            platform: req.body.platform || "android",
            timezone,
            lastSeenAt: new Date()
        });
        await preference.save();

        return res.status(200).json({
            success: true,
            message: "Device token registered.",
            registeredDevices: preference.devices.length
        });
    } catch (err) {
        console.error("Save FCM token error:", err.message);
        return res.status(500).json({ success: false, message: "Could not register this device." });
    }
});

router.delete("/users/:userId/fcm-token", authenticateToken, requireOwner, [
    body("deviceId").optional().isString().isLength({ min: 8, max: 128 }),
    body("fcmToken").optional().isString().isLength({ min: 20, max: 4096 })
], async (req, res) => {
    try {
        if (validationFailed(req, res)) return;
        const selector = [];
        if (req.body.deviceId) selector.push({ deviceId: req.body.deviceId });
        if (req.body.fcmToken) selector.push({ token: req.body.fcmToken });
        if (!selector.length) return res.status(400).json({ success: false, message: "deviceId or fcmToken is required." });

        const preference = await NotificationPreference.findOne({ userId: req.params.userId }).select("+fcmToken");
        if (!preference) return res.status(200).json({ success: true, registeredDevices: 0 });
        const removedTokens = preference.devices
            .filter(device => selector.some(match =>
                (match.deviceId && device.deviceId === match.deviceId) ||
                (match.token && device.token === match.token)
            ))
            .map(device => device.token);
        preference.devices = preference.devices.filter(device => !removedTokens.includes(device.token));
        if (req.body.fcmToken === preference.fcmToken || removedTokens.includes(preference.fcmToken) || preference.devices.length === 0) {
            preference.fcmToken = undefined;
        }
        await preference.save();
        return res.status(200).json({ success: true, message: "Device registration removed.", registeredDevices: preference.devices.length });
    } catch (err) {
        console.error("Remove FCM token error:", err.message);
        return res.status(500).json({ success: false, message: "Could not remove this device." });
    }
});

router.post("/users/:userId/notifications/test", authenticateToken, requireOwner, [
    body("title").optional().isString().isLength({ min: 1, max: 100 }),
    body("body").optional().isString().isLength({ min: 1, max: 300 })
], async (req, res) => {
    try {
        if (validationFailed(req, res)) return;
        const result = await sendPushToUser(req.params.userId, {
            title: req.body.title || "Wynd weather alert",
            body: req.body.body || "This is a test notification from the Wynd API.",
            data: { type: "test", screen: "home" }
        }, { force: true });

        if (result.successCount === 0) {
            return res.status(502).json({ success: false, message: "Firebase did not accept the notification for any registered device.", result });
        }
        return res.status(200).json({
            success: true,
            message: "Test notification accepted by Firebase.",
            messageId: result.messageIds[0],
            successCount: result.successCount,
            failureCount: result.failureCount,
            invalidTokenCount: result.invalidTokenCount
        });
    } catch (err) {
        if (err.code === "notifications/no-device") {
            return res.status(404).json({ success: false, message: "No device registered for this user." });
        }
        if (err.code === "notifications/disabled") {
            return res.status(403).json({ success: false, message: err.message });
        }
        if (String(err.code || "").startsWith("notifications/firebase-") ||
            err.message?.includes("FIREBASE_SERVICE_ACCOUNT_BASE64")) {
            console.error("Firebase configuration error:", err.message);
            return res.status(503).json({ success: false, message: "Push notifications are not configured correctly on the server." });
        }
        console.error("Send test notification error:", err.code || "unknown", err.message);
        return res.status(502).json({ success: false, message: "Firebase could not send the notification." });
    }
});

module.exports = router;
