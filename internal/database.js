const sqlite3 = require("sqlite3").verbose()
const path = require("path")

const dbPath = path.join(__dirname, "dbNetflixLight.db")

const db = new sqlite3.Database(dbPath, (err) => {
    if (err){
        console.error(err.message)
    }
    console.log("Connecté a SQLite")
})

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        username TEXT UNIQUE,
        email TEXT UNIQUE,
        password TEXT
        );
    `)
    db.run(`
        CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        token TEXT,
        expires_at TEXT
        );
    `)

    db.run(`
        DELETE FROM tokens
        WHERE id NOT IN (
            SELECT MAX(id)
            FROM tokens
            GROUP BY user_id
        );
    `)

    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_user_unique
        ON tokens(user_id);
    `)

    db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_tokens_token_unique
        ON tokens(token);
    `)
    db.run(`
        CREATE TABLE IF NOT EXISTS favoris (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        media_id INTEGER,
        media_type TEXT,
        title TEXT,
        poster_path TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `)
})

function registerUser(name, email, username, password, callback) {
    const query = `
        INSERT INTO users (name, email, username,password)
        VALUES (?, ?, ?, ?)
    `

    db.run(query, [name, email, username, password], function (err) {
        if (callback) {
            callback(err, this ? this.lastID : null)
        }
    })
}

db.registerUser = registerUser

module.exports = db