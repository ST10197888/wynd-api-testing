const NotificationPreference = require("../models/NotificationPreference");
const { getMessaging } = require("../config/firebase");

const INVALID_TOKEN_CODES = new Set([
    "messaging/registration-token-not-registered",
    "messaging/invalid-registration-token"
]);

async function removeInvalidTokens(userId, invalidTokens) {
    if (!invalidTokens.length) return;
    await NotificationPreference.updateOne(
        { userId },
        { $pull: { devices: { token: { $in: invalidTokens } } } }
    );
    await NotificationPreference.updateOne(
        { userId, fcmToken: { $in: invalidTokens } },
        { $unset: { fcmToken: 1 } }
    );
}

async function sendPushToUser(userId, payload, options = {}) {
    const preference = await NotificationPreference.findOne({ userId }).select("+fcmToken");
    if (!preference) {
        const error = new Error("No notification registration exists for this user.");
        error.code = "notifications/no-device";
        throw error;
    }

    if (!options.force && !preference.enabled) {
        const error = new Error("Notifications are disabled for this user.");
        error.code = "notifications/disabled";
        throw error;
    }

    const tokens = [...new Set([
        ...(preference.devices || []).map(device => device.token),
        preference.fcmToken
    ].filter(Boolean))];

    if (!tokens.length) {
        const error = new Error("No device registered for this user.");
        error.code = "notifications/no-device";
        throw error;
    }

    const data = {};
    for (const [key, value] of Object.entries(payload.data || {})) {
        if (value !== undefined && value !== null) data[key] = String(value);
    }

    const response = await getMessaging().sendEachForMulticast({
        tokens: tokens.slice(0, 500),
        notification: {
            title: String(payload.title || "Wynd weather alert").slice(0, 100),
            body: String(payload.body || "Open Wynd to view your weather update.").slice(0, 300)
        },
        data,
        android: {
            priority: "high",
            notification: {
                channelId: "wynd_alerts",
                sound: "default",
                priority: "high"
            }
        }
    });

    const invalidTokens = [];
    response.responses.forEach((result, index) => {
        if (!result.success && INVALID_TOKEN_CODES.has(result.error?.code)) {
            invalidTokens.push(tokens[index]);
        }
    });

    await removeInvalidTokens(userId, invalidTokens);

    return {
        successCount: response.successCount,
        failureCount: response.failureCount,
        invalidTokenCount: invalidTokens.length,
        messageIds: response.responses.filter(item => item.success).map(item => item.messageId)
    };
}

module.exports = { sendPushToUser };
