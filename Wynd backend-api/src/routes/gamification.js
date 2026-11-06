const express = require("express");
const authenticateToken = require("../middleware/authMiddleware");
const { dummyFacts, dummyAchievements } = require("../data/dummyData");

const router = express.Router();

router.get("/gamification/daily-fact", authenticateToken, (req, res) => {
    const fact = dummyFacts[Math.floor(Math.random() * dummyFacts.length)];
    return res.status(200).json({ fact: fact.factText });
});

router.get("/gamification/achievements", authenticateToken, (req, res) => {
    return res.status(200).json({ achievements: dummyAchievements });
});

module.exports = router;