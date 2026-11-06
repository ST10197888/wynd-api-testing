const express = require("express");
const { body, validationResult } = require("express-validator");
const authenticateToken = require("../middleware/authMiddleware");
const requireOwner = require("../middleware/requireOwner");
const SavedLocation = require("../models/SavedLocation");

const router = express.Router();
const MAX_SAVED_LOCATIONS = 10;

router.post("/users/:userId/sync/locations", authenticateToken, requireOwner, [
    body("items").isArray({ min: 1, max: 25 }).withMessage("items must be an array of 1 to 25 entries."),
    body("items.*.clientId").isString().trim().notEmpty().withMessage("clientId is required."),
    body("items.*.locationName").isString().trim().notEmpty().withMessage("locationName is required."),
    body("items.*.timestamp").optional().isISO8601().withMessage("timestamp must be an ISO 8601 date."),
    body("items.*.latitude").optional().isFloat().withMessage("latitude must be a number."),
    body("items.*.longitude").optional().isFloat().withMessage("longitude must be a number."),
    body("items.*.country").optional().isString()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const userId = req.params.userId;
        const results = [];

        for (const item of req.body.items) {
            const existing = await SavedLocation.findOne({
                userId,
                $or: [{ clientId: item.clientId }, { locationName: item.locationName }]
            }).collation({ locale: "en", strength: 2 });

            if (existing) {
                results.push({ clientId: item.clientId, status: "exists" });
                continue;
            }

            const count = await SavedLocation.countDocuments({ userId });
            if (count >= MAX_SAVED_LOCATIONS) {
                results.push({
                    clientId: item.clientId,
                    status: "rejected",
                    reason: `You can save a maximum of ${MAX_SAVED_LOCATIONS} locations.`
                });
                continue;
            }

            try {
                await SavedLocation.create({
                    userId,
                    clientId: item.clientId,
                    locationName: item.locationName,
                    latitude: item.latitude,
                    longitude: item.longitude,
                    country: item.country,
                    clientTimestamp: item.timestamp ? new Date(item.timestamp) : undefined
                });
                results.push({ clientId: item.clientId, status: "created" });
            } catch (err) {
                if (err.code === 11000) {
                    results.push({ clientId: item.clientId, status: "exists" });
                } else {
                    throw err;
                }
            }
        }

        const locations = await SavedLocation.find({ userId });
        return res.status(200).json({ message: "Sync complete.", results, locations });
    } catch (err) {
        console.error("Sync locations error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

module.exports = router;