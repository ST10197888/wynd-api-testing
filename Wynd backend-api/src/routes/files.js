const express = require("express");
const multer = require("multer");
const authenticateToken = require("../middleware/authMiddleware");
const requireOwner = require("../middleware/requireOwner");
const { getStorage } = require("../config/supabase");

const router = express.Router();

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => cb(null, ALLOWED_TYPES.includes(file.mimetype))
});

function handleUpload(req, res, next) {
    upload.single("file")(req, res, (err) => {
        if (err) {
            const message = err.code === "LIMIT_FILE_SIZE" ? "File must be 2 MB or smaller." : "Upload failed.";
            return res.status(400).json({ success: false, message });
        }
        next();
    });
}

router.post("/users/:userId/avatar", authenticateToken, requireOwner, handleUpload, async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Attach a JPEG, PNG or WebP image in the 'file' field." });
        }
        const { client, bucket } = getStorage();
        const path = `avatars/${req.params.userId}`;
        const { error } = await client.storage.from(bucket).upload(path, req.file.buffer, {
            contentType: req.file.mimetype,
            upsert: true
        });
        if (error) {
            throw error;
        }
        return res.status(201).json({ message: "Avatar uploaded.", path });
    } catch (err) {
        console.error("Avatar upload error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

router.get("/users/:userId/avatar", authenticateToken, requireOwner, async (req, res) => {
    try {
        const { client, bucket } = getStorage();
        const { data, error } = await client.storage.from(bucket).createSignedUrl(`avatars/${req.params.userId}`, 3600);
        if (error || !data) {
            return res.status(404).json({ success: false, message: "No avatar found." });
        }
        return res.status(200).json({ url: data.signedUrl, expiresIn: 3600 });
    } catch (err) {
        console.error("Avatar fetch error:", err.message);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

module.exports = router;