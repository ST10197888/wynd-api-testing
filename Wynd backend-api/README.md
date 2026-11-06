# Wynd API

This is the Wynd API deployment repository used by the Android application and hosted on Railway.

## Push notification configuration

The API uses Firebase Cloud Messaging (FCM) for Android push notifications. Configure these Railway environment variables:

- `FIREBASE_SERVICE_ACCOUNT_BASE64`: the Base64-encoded Firebase Admin SDK service-account JSON. The service account must belong to the same Firebase project as the Android `google-services.json` file (`wynd-weather`). Never commit the service-account JSON or private key.
- `OPENWEATHER_API_KEY`: required by the weather notification scheduler to retrieve current conditions and forecasts.
- `MONGODB_URI`: MongoDB connection string.
- `JWT_SECRET`: API JWT signing secret.
- `JWT_EXPIRES_IN`: optional; defaults to `1h`.
- `NOTIFICATION_SCAN_INTERVAL_MS`: optional scheduler interval in milliseconds; defaults to `900000` (15 minutes).

The Android project must have its matching `google-services.json` under `app/` and must request the Android 13+ `POST_NOTIFICATIONS` permission.

## Notification endpoints

All user notification endpoints require a valid Bearer JWT and the authenticated user must own the `{userId}` in the URL.

- `PUT /users/:userId/fcm-token` — register or refresh one device token. The API stores multiple devices per account and moves a token away from any previous account owner.
- `DELETE /users/:userId/fcm-token` — unregister a device using `deviceId` or `fcmToken`.
- `GET /users/:userId/notifications/preferences` — retrieve notification preferences.
- `PUT /users/:userId/notifications/preferences` — update global, smart, rain, severe-weather and daily-summary preferences, plus timezone and monitored location.
- `POST /users/:userId/notifications/test` — send a test push to all registered devices for the account.

## Automatic weather notifications

After MongoDB connects, the API starts a server-side weather scan. It checks enabled accounts with registered devices and a configured location. Weather data is retrieved once per distinct location during each scan.

Default rules:

- Severe weather: current or forecast conditions such as thunderstorms, tornadoes, squalls, hurricanes or extreme conditions.
- Rain: a forecast day reaches the user's `rainProbabilityThreshold` (default 60%).
- Smart advisory: temperature is at least 35°C, at or below 0°C, or wind speed is at least 15 m/s.
- Daily summary: sent once per local date during the hour beginning at `dailyNotificationHour` (default 08:00), using the device's IANA timezone.

The notification delivery collection reserves a unique user/event key before sending to prevent duplicate pushes when multiple API instances scan at the same time. Delivery records expire after 90 days.

A user's monitored location is taken from notification preferences first, then their saved default/most recent saved location. The Android app sends its current selected location and timezone when it registers its FCM token, when the user searches for a new location, and when notification settings are saved.

## Postman tests

Import `Wynd_API_Final_POE_Tests.postman_collection.json`. Set `baseUrl`, `phoneEmail` and `phonePassword`. The phone account must exist and the app must have been installed and signed into that account at least once.

The real-device push requests use the `phoneFcmToken` collection variable. Set it to the current FCM token from that Android installation and run requests 33–36. Do not use a made-up token. If it is blank, request 33 skips the direct token-registration and test-push steps; the preference tests still run.

A successful FCM API response means Firebase accepted the message for delivery; it does not prove that Android displayed it. Confirm display on a physical device with notification permission enabled and the `wynd_alerts` notification channel enabled.
