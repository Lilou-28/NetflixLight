const crypto = require("crypto")
const db = require("./database"); 

function generateToken() {
    return crypto.randomBytes(32).toString("hex")
}

function parseExpirationValue(expiresAt) {
    const numericValue = Number(expiresAt)
    if (Number.isFinite(numericValue)) {
        return numericValue
    }

    const parsedDate = Date.parse(expiresAt)
    return Number.isFinite(parsedDate) ? parsedDate : NaN
}

function cleanupExpiredTokens(callback) {
    db.all("SELECT id, expires_at FROM tokens", [], (err, rows) => {
        if (err) {
            if (typeof callback === "function") {
                callback()
            }
            return
        }

        const now = Date.now()
        const expiredIds = Array.isArray(rows)
            ? rows
                .filter((row) => !Number.isFinite(parseExpirationValue(row.expires_at)) || parseExpirationValue(row.expires_at) <= now)
                .map((row) => row.id)
            : []

        if (!expiredIds.length) {
            if (typeof callback === "function") {
                callback()
            }
            return
        }

        const placeholders = expiredIds.map(() => "?").join(", ")
        db.run(`DELETE FROM tokens WHERE id IN (${placeholders})`, expiredIds, () => {
            if (typeof callback === "function") {
                callback()
            }
        })
    })
}

function checkToken(token, callback) {
    cleanupExpiredTokens(() => {
        db.get("SELECT user_id, expires_at FROM tokens WHERE token = ? ORDER BY id DESC LIMIT 1", [token], (err, row) => {
            if (err || !row) {
                callback(false)
                return
            }

            const expiresAt = parseExpirationValue(row.expires_at)
            if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
                db.run("DELETE FROM tokens WHERE token = ?", [token])
                callback(false)
                return
            }

            callback(true, row.user_id)
        })
    })
}

function getSessionTokenFromCookie(req) {
    const cookieHeader = req.headers.cookie || ""
    const cookies = cookieHeader.split(";")

    for (const cookie of cookies) {
        const trimmed = cookie.trim()
        if (trimmed.startsWith("session_token=")) {
            try {
                return decodeURIComponent(trimmed.slice("session_token=".length))
            } catch (_err) {
                return null
            }
        }
    }

    return null
}

module.exports = {
    generateToken,
    checkToken,
    getSessionTokenFromCookie,
    cleanupExpiredTokens,
}