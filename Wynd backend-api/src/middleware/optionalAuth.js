const jwt = require("jsonwebtoken");

function optionalAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split(" ")[1];
        try {
            req.user = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
        } catch (err) {
            req.user = null;
        }
    }
    next();
}

module.exports = optionalAuth;