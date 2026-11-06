const NotificationPreference = require("../models/NotificationPreference");
const NotificationDelivery = require("../models/NotificationDelivery");
const User = require("../models/User");
const SavedLocation = require("../models/SavedLocation");
const { fetchCurrentWeather, fetchForecast } = require("./weatherProvider");
const { sendPushToUser } = require("./notificationService");

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const SEVERE_CONDITIONS = new Set([
    "thunderstorm", "tornado", "squall", "hurricane", "tropical storm", "extreme"
]);

let timer = null;
let scanRunning = false;

function getLocalDateParts(timezone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: timezone || "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23"
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
        date: `${values.year}-${values.month}-${values.day}`,
        hour: Number(values.hour)
    };
}

function isSevere(condition) {
    return SEVERE_CONDITIONS.has(String(condition || "").trim().toLowerCase());
}

async function resolveUserLocation(preference) {
    if (preference.locationName) return preference.locationName;

    const user = await User.findById(preference.userId).select("defaultLocationId");
    if (user?.defaultLocationId) {
        const defaultLocation = await SavedLocation.findById(user.defaultLocationId);
        if (defaultLocation?.locationName) return defaultLocation.locationName;
    }

    const savedLocation = await SavedLocation.findOne({ userId: preference.userId })
        .sort({ isDefault: -1, createdAt: -1 });
    return savedLocation?.locationName || null;
}

async function sendOnce(userId, dedupeKey, kind, locationName, title, body, data = {}) {
    // Reclaim a send reservation left behind by a process that crashed mid-send.
    await NotificationDelivery.deleteOne({
        userId,
        dedupeKey,
        status: "sending",
        updatedAt: { $lt: new Date(Date.now() - 30 * 60 * 1000) }
    });

    // Claim the event before sending so multiple API instances cannot deliver duplicates.
    try {
        await NotificationDelivery.create({
            userId,
            dedupeKey,
            kind,
            locationName,
            status: "sending"
        });
    } catch (err) {
        if (err.code === 11000) return false;
        throw err;
    }

    try {
        const result = await sendPushToUser(userId, {
            title,
            body,
            data: { ...data, type: kind, location: locationName }
        });
        if (result.successCount < 1) {
            await NotificationDelivery.deleteOne({ userId, dedupeKey, status: "sending" });
            return false;
        }
        await NotificationDelivery.updateOne(
            { userId, dedupeKey },
            { $set: { status: "sent", sentAt: new Date() } }
        );
        return true;
    } catch (err) {
        await NotificationDelivery.deleteOne({ userId, dedupeKey, status: "sending" }).catch(() => {});
        throw err;
    }
}

async function processUser(preference, weatherByLocation) {
    const userId = preference.userId;
    const locationName = await resolveUserLocation(preference);
    if (!locationName) return;

    let weather = weatherByLocation.get(locationName.toLowerCase());
    if (!weather) {
        const [current, forecast] = await Promise.all([
            fetchCurrentWeather(locationName),
            fetchForecast(locationName)
        ]);
        weather = { current, forecast };
        weatherByLocation.set(locationName.toLowerCase(), weather);
    }

    const timezone = preference.timezone || "UTC";
    const local = getLocalDateParts(timezone);
    const dayForecast = weather.forecast[0];
    const locationKey = locationName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");

    if (preference.severeWeatherAlertsEnabled) {
        const severeForecast = weather.forecast.find(day => isSevere(day.condition));
        const severeCondition = isSevere(weather.current.condition)
            ? weather.current.condition
            : severeForecast?.condition;
        if (severeCondition) {
            await sendOnce(
                userId,
                `severe:${locationKey}:${local.date}:${String(severeCondition).toLowerCase()}`,
                "severe_weather",
                locationName,
                "Severe weather alert",
                `${severeCondition} conditions are reported for ${locationName}. Check Wynd before travelling or spending time outdoors.`,
                { condition: severeCondition }
            );
        }
    }

    if (preference.rainAlertsEnabled) {
        const rainyDay = weather.forecast.find(day => Number(day.rainProbability || 0) >= preference.rainProbabilityThreshold);
        if (rainyDay) {
            const forecastDate = new Date(rainyDay.date).toISOString().slice(0, 10);
            await sendOnce(
                userId,
                `rain:${locationKey}:${forecastDate}`,
                "rain_alert",
                locationName,
                "Rain expected",
                `There is a ${Math.round(rainyDay.rainProbability)}% chance of rain in ${locationName}. Consider taking an umbrella.`,
                { rainProbability: rainyDay.rainProbability, forecastDate }
            );
        }
    }

    if (preference.smartAlertsEnabled) {
        const temperature = Number(weather.current.temperature);
        const windSpeed = Number(weather.current.windSpeed);
        let smartMessage = null;
        let smartKey = null;
        if (temperature >= 35) {
            smartKey = `heat:${locationKey}:${local.date}`;
            smartMessage = `It is very hot in ${locationName} (${Math.round(temperature)}°C). Stay hydrated and limit prolonged sun exposure.`;
        } else if (temperature <= 0) {
            smartKey = `cold:${locationKey}:${local.date}`;
            smartMessage = `Freezing conditions are possible in ${locationName} (${Math.round(temperature)}°C). Dress warmly.`;
        } else if (windSpeed >= 15) {
            smartKey = `wind:${locationKey}:${local.date}`;
            smartMessage = `Strong winds are being reported in ${locationName}. Secure loose outdoor items and take care outside.`;
        }
        if (smartMessage && smartKey) {
            await sendOnce(userId, smartKey, "smart_weather", locationName, "Weather advisory", smartMessage, {
                temperature,
                windSpeed
            });
        }
    }

    if (preference.dailyWeatherEnabled &&
        local.hour >= preference.dailyNotificationHour &&
        local.hour <= preference.dailyNotificationHour + 1) {
        const summary = dayForecast
            ? `${dayForecast.condition}, with temperatures from ${Math.round(dayForecast.minTemperature)}°C to ${Math.round(dayForecast.maxTemperature)}°C. Rain chance: ${Math.round(dayForecast.rainProbability || 0)}%.`
            : `Current conditions are ${weather.current.condition} at ${Math.round(weather.current.temperature)}°C.`;
        await sendOnce(
            userId,
            `daily:${locationKey}:${local.date}`,
            "daily_weather",
            locationName,
            `Today's weather in ${locationName}`,
            summary,
            { date: local.date }
        );
    }
}

async function runWeatherNotificationScan() {
    if (scanRunning) return;
    scanRunning = true;
    try {
        const preferences = await NotificationPreference.find({ enabled: true })
            .select("userId enabled smartAlertsEnabled rainAlertsEnabled severeWeatherAlertsEnabled dailyWeatherEnabled rainProbabilityThreshold dailyNotificationHour timezone locationName devices +fcmToken");
        const weatherByLocation = new Map();

        for (const preference of preferences) {
            const hasDevice = (preference.devices || []).length > 0 || Boolean(preference.fcmToken);
            if (!hasDevice) continue;
            try {
                await processUser(preference, weatherByLocation);
            } catch (err) {
                console.error(`Weather notification scan failed for user ${preference.userId}:`, err.code || "", err.message);
            }
        }
    } catch (err) {
        console.error("Weather notification scan failed:", err.message);
    } finally {
        scanRunning = false;
    }
}

function startWeatherNotificationScheduler() {
    if (timer) return;
    const configuredInterval = Number(process.env.NOTIFICATION_SCAN_INTERVAL_MS);
    const interval = Number.isFinite(configuredInterval) && configuredInterval >= 60000
        ? configuredInterval
        : DEFAULT_INTERVAL_MS;

    console.log(`Weather notification scheduler started (every ${Math.round(interval / 60000)} minutes).`);
    runWeatherNotificationScan();
    timer = setInterval(runWeatherNotificationScan, interval);
    if (typeof timer.unref === "function") timer.unref();
}

function stopWeatherNotificationScheduler() {
    if (timer) clearInterval(timer);
    timer = null;
}

module.exports = {
    startWeatherNotificationScheduler,
    stopWeatherNotificationScheduler,
    runWeatherNotificationScan
};
