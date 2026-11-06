const express = require("express");
const optionalAuth = require("../middleware/optionalAuth");
const WeatherCache = require("../models/WeatherCache");
const { fetchCurrentWeather, fetchForecast } = require("../services/weatherProvider");

const router = express.Router();
const CACHE_TTL_MINUTES = 30;

router.get("/weather/current", optionalAuth, async (req, res) => {
    try {
        const location = req.query.location;
        if (!location) {
            return res.status(400).json({ success: false, message: "location query parameter is required." });
        }

        let cache = await WeatherCache.findOne({ locationName: location });
        if (!cache || cache.expiresAt < new Date()) {
            const weatherData = await fetchCurrentWeather(location);
            const forecastData = await fetchForecast(location);
            const now = new Date();
            const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000);
            cache = await WeatherCache.findOneAndUpdate(
                { locationName: location },
                { weatherData, forecastData, cachedAt: now, expiresAt },
                { new: true, upsert: true }
            );
        }

        const weather = cache.weatherData;
        const basicResponse = {
            location: weather.locationName,
            temperature: weather.temperature,
            condition: weather.condition,
            humidity: weather.humidity
        };

        if (req.user) {
            return res.status(200).json({
                ...basicResponse,
                windSpeed: weather.windSpeed,
                rainProbability: weather.rainProbability,
                uvIndex: weather.uvIndex
            });
        }
        return res.status(200).json(basicResponse);
    } catch (err) {
        console.error("Current weather error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.get("/weather/forecast", optionalAuth, async (req, res) => {
    try {
        const location = req.query.location;
        if (!location) {
            return res.status(400).json({ success: false, message: "location query parameter is required." });
        }

        let cache = await WeatherCache.findOne({ locationName: location });
        if (!cache || cache.expiresAt < new Date()) {
            const weatherData = await fetchCurrentWeather(location);
            const forecastData = await fetchForecast(location);
            const now = new Date();
            const expiresAt = new Date(now.getTime() + CACHE_TTL_MINUTES * 60 * 1000);
            cache = await WeatherCache.findOneAndUpdate(
                { locationName: location },
                { weatherData, forecastData, cachedAt: now, expiresAt },
                { new: true, upsert: true }
            );
        }

        const forecast = cache.forecastData.map(day => {
            const basicDay = {
                date: day.date,
                minTemperature: day.minTemperature,
                maxTemperature: day.maxTemperature,
                condition: day.condition
            };
            return req.user
                ? { ...basicDay, rainProbability: day.rainProbability, humidity: day.humidity, windSpeed: day.windSpeed }
                : basicDay;
        });

        return res.status(200).json({ location, forecast });
    } catch (err) {
        console.error("Forecast error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

module.exports = router;