const BASE_URL = "https://api.openweathermap.org/data/2.5";

function getApiKey() {
    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) throw new Error("OPENWEATHER_API_KEY is not set in .env");
    return key;
}

async function fetchCurrentWeather(location) {
    const url = `${BASE_URL}/weather?q=${encodeURIComponent(location)}&appid=${getApiKey()}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.cod && Number(data.cod) !== 200) {
        throw new Error(`OpenWeatherMap error: ${data.message || data.cod}`);
    }

    return {
        locationName: data.name || location,
        latitude: data.coord.lat,
        longitude: data.coord.lon,
        temperature: data.main.temp,
        feelsLike: data.main.feels_like,
        condition: data.weather[0].main,
        humidity: data.main.humidity,
        windSpeed: data.wind.speed,
        rainProbability: undefined, // not provided by the current-weather endpoint on the free tier
        uvIndex: undefined,         // requires the paid One Call API on OpenWeatherMap's free tier
        observedAt: new Date(data.dt * 1000)
    };
}

async function fetchForecast(location) {
    const url = `${BASE_URL}/forecast?q=${encodeURIComponent(location)}&appid=${getApiKey()}&units=metric`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.cod && Number(data.cod) !== 200) {
        throw new Error(`OpenWeatherMap error: ${data.message || data.cod}`);
    }

    // The free tier only gives 3-hour steps for 5 days grouping them into daily buckets
    const byDay = {};
    for (const entry of data.list) {
        const day = entry.dt_txt.split(" ")[0];
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(entry);
    }

    const days = Object.entries(byDay).map(([day, entries]) => {
        const temps = entries.map(e => e.main.temp);
        const middayEntry = entries.reduce((closest, e) => {
            const hour = Number(e.dt_txt.split(" ")[1].split(":")[0]);
            const closestHour = Number(closest.dt_txt.split(" ")[1].split(":")[0]);
            return Math.abs(hour - 12) < Math.abs(closestHour - 12) ? e : closest;
        });
        const avgPop = entries.reduce((sum, e) => sum + (e.pop || 0), 0) / entries.length;
        const avgHumidity = entries.reduce((sum, e) => sum + e.main.humidity, 0) / entries.length;
        const avgWind = entries.reduce((sum, e) => sum + e.wind.speed, 0) / entries.length;

        return {
            date: new Date(day),
            minTemperature: Math.min(...temps),
            maxTemperature: Math.max(...temps),
            condition: middayEntry.weather[0].main,
            rainProbability: Math.round(avgPop * 100),
            humidity: Math.round(avgHumidity),
            windSpeed: avgWind
        };
    });

    return days.slice(0, 5);
}

module.exports = { fetchCurrentWeather, fetchForecast };