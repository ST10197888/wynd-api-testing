# Wynd notifications implementation patch

This patch updates the existing Wynd backend and Android application. It preserves the existing Express/MongoDB/Firebase Admin API and native Android Activities/XML/Retrofit architecture.

## Files to add

### Backend API
- `Wynd backend-api/.env.example`
- `Wynd backend-api/src/models/NotificationDelivery.js`
- `Wynd backend-api/src/services/notificationService.js`
- `Wynd backend-api/src/services/weatherNotificationScheduler.js`

### Android app
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/NotificationModels.kt`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/PushTokenUploadWorker.kt`
- `Wynd mobile app/app/src/main/res/drawable/ic_stat_wynd.xml`

## Files to replace (edited files)

### Backend API
- `Wynd backend-api/.gitignore`
- `Wynd backend-api/README.md`
- `Wynd backend-api/Wynd_API_Final_POE_Tests.postman_collection.json`
- `Wynd backend-api/src/app.js`
- `Wynd backend-api/src/config/firebase.js`
- `Wynd backend-api/src/models/NotificationPreference.js`
- `Wynd backend-api/src/routes/notifications.js`

### Android app
- `Wynd mobile app/.gitignore`
- `Wynd mobile app/app/src/main/AndroidManifest.xml`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/ApiService.kt`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/HomeActivity.kt`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/PushRegistrar.kt`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/SessionManager.kt`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/SettingsActivity.kt`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/SettingsManager.kt`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/UserSettings.kt`
- `Wynd mobile app/app/src/main/java/com/example/wynd_frontend/WyndMessagingService.kt`
- `Wynd mobile app/app/src/main/res/layout/activity_settings.xml`

`PushTokenUploadWorker.kt` is a new Android file, not an existing file replacement. `NotificationModels.kt` and the status-bar icon are also new files.

## What this implementation does

- Registers the current FCM token after the user signs in and whenever Firebase refreshes it.
- Queues token registration with WorkManager when the network is unavailable and retries transient server/network failures.
- Stores multiple device tokens for one account. Registering a token under another account removes that token from the previous account.
- Unregisters the current device when the user logs out.
- Stores global, smart, rain, severe-weather and daily-summary preferences on the backend and mirrors the user's global/smart settings to the existing UserSettings record.
- Adds individual Android settings switches for the four notification categories.
- Sends a test push to all registered devices for an account.
- Displays foreground/data notifications with a dedicated monochrome status-bar icon. FCM notification payloads are displayed by Android when the app is backgrounded.
- Starts a backend weather scan after MongoDB connects. The scan runs every 15 minutes by default and sends enabled weather alerts using the configured OpenWeather data.
- Deduplicates weather notifications per user/event and retains delivery records for 90 days.
- Adds Postman tests for real-device token registration and notification preference retrieval/update.

## Implemented alert rules

- Severe weather: current or forecast condition names including Thunderstorm, Tornado, Squall, Hurricane, Tropical storm or Extreme.
- Rain: at least one forecast day meets the user's rain-probability threshold (default 60%).
- Smart advisory: temperature at least 35°C, at or below 0°C, or wind speed at least 15 m/s.
- Daily summary: once per local date, during the hour beginning at the user's configured daily notification hour (default 08:00).

The Android app sends the current selected location and device timezone to the backend when it registers its token, when the user searches for a new location, and when notification settings are saved. If a preference location is unavailable, the scheduler tries the user's default saved location and then their most recently saved location. Users without a registered device or usable location are skipped.

## Railway configuration required

Set these environment variables in the Wynd API Railway service:

- `FIREBASE_SERVICE_ACCOUNT_BASE64`: Base64-encoded Firebase Admin SDK service-account JSON. The service account must belong to Firebase project `wynd-weather`, matching the existing Android `google-services.json`.
- `OPENWEATHER_API_KEY`: OpenWeather API key used for current weather and forecast checks.
- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (optional; defaults to `1h`)
- `NOTIFICATION_SCAN_INTERVAL_MS` (optional; defaults to `900000`)

Do not commit the Firebase service-account JSON, private key, or Railway secrets to GitHub. The patch does not contain any service-account credentials.

## Postman test steps

Import the updated `Wynd_API_Final_POE_Tests.postman_collection.json`.

1. Set `baseUrl` to the deployed Wynd API URL.
2. Set `phoneEmail` and `phonePassword` to an existing test account.
3. Install the Android app on a physical Android device and sign in to that account. Allow notification permission when Android asks.
4. The app automatically registers its FCM token. To test the direct Postman registration request too, set `phoneFcmToken` to the current FCM token for the device and set `phoneDeviceId` to any stable test ID. Do not invent an FCM token. If `phoneFcmToken` is blank, request 33 skips only the direct registration step; request 34 still tests the token already registered by the Android app. If the app has not registered a token, request 34 should return 404.
5. Run the collection in order. Request 34 sends a real test push. Verify the notification on the physical phone.

A successful HTTP response from Firebase means the message was accepted by Firebase; it is not proof that Android displayed it. Android notification permission and the `wynd_alerts` channel must be enabled on the phone.

## Verification performed for this patch

- All backend JavaScript files passed `node --check`.
- The Postman collection parsed as valid JSON and contains 36 requests.
- The edited Android manifest, settings layout and notification vector drawable parsed as valid XML.
- An Android Gradle compile could not be completed in this environment because the project's Gradle 9.4.1 distribution was not cached and this environment could not reach `services.gradle.org`. Open the project in Android Studio and run `Build > Make Project` before deploying.
