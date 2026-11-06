function requireOwner(req, res, next) {
    if (!req.user || String(req.user.userId) !== String(req.params.userId)) {
        return res.status(403).json({ success: false, message: "You can only access your own data." });
    }
    next();
}

module.exports = requireOwner;