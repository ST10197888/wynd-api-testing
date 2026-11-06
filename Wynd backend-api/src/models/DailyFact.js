const mongoose = require("mongoose");

const dailyFactSchema = new mongoose.Schema({
    factText: { type: String, required: true },
    date: { type: Date, required: true },
    relatedCondition: { type: String },
    isDisplayed: { type: Boolean, default: false }
});

module.exports = mongoose.model("DailyFact", dailyFactSchema);