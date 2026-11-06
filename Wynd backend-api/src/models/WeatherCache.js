const mongoose = require("mongoose");

const currentWeatherSchema = new mongoose.Schema({
    locationName: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    temperature: { type: Number, required: true },
    condition: { type: String, required: true },
    humidity: { type: Number, required: true },
    windSpeed: { type: Number, required: true },
    rainProbability: { type: Number },
    uvIndex: { type: Number },
    observedAt: { type: Date, required: true }
}, { _id: false });

const forecastDaySchema = new mongoose.Schema({
    date: { type: Date, required: true },
    minTemperature: { type: Number, required: true },
    maxTemperature: { type: Number, required: true },
    condition: { type: String, required: true },
    rainProbability: { type: Number },
    humidity: { type: Number },
    windSpeed: { type: Number }
}, { _id: false });

const weatherCacheSchema = new mongoose.Schema({
    locationName: { type: String, required: true, index: true },
    weatherData: { type: currentWeatherSchema, required: true },
    forecastData: { type: [forecastDaySchema], required: true },
    cachedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true }
});

module.exports = mongoose.model("WeatherCache", weatherCacheSchema);