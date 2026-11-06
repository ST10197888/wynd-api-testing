const dummyFacts = [
    { factText: "The highest temperature ever recorded on Earth was 56.7°C in Death Valley.", relatedCondition: "Sunny" },
    { factText: "Raindrops are not actually tear-shaped, they're more like tiny hamburger buns.", relatedCondition: "Rainy" },
    { factText: "Lightning strikes the Earth about 8 million times a day.", relatedCondition: "Stormy" }
];

const dummyAchievements = [
    { name: "Weather Watcher", description: "Checked the weather 10 days in a row.", progress: 3, target: 10, isUnlocked: false },
    { name: "Storm Spotter", description: "Viewed a forecast during a storm warning.", progress: 0, target: 1, isUnlocked: false },
    { name: "Explorer", description: "Saved 5 different locations.", progress: 1, target: 5, isUnlocked: false }
];

module.exports = { dummyFacts, dummyAchievements };