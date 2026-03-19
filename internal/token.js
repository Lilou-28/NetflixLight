const sqlite3 = require("sqlite3").verbose()
const path = require("path")
const crypto = require("crypto")
const db = require("./database"); 

const dbPath = path.join(__dirname, "dbNetflixLight.db")

db.run(`
    CREATE TABLE IF NOT EXISTS tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    token TEXT,
    expires_at DATETIME
    );
`)

function generateToken() {
    return crypto.randomBytes(32).toString("hex")
}

function checkToken(token, callback) {
    db.get("SELECT user_id, expires_at FROM tokens WHERE token = ? ORDER BY id DESC LIMIT 1", [token], (err, row) => {
        if (err || !row) {
            callback(false)
            return
        }

        const expiresAt = new Date(row.expires_at).getTime()
        if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
            callback(false)
            return
        }

        callback(true, row.user_id)
    })
}

module.exports = {
    generateToken,
    checkToken
}