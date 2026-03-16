const sqlite3 = require("sqlite3").verbose()
const path = require("path")

const dbPath = path.join(__dirname, "dbNetflixLight.db")

const db = new sqlite3.Database(dbPath, (err) => {
    if (err){
        console.error(err.message)
    }
    console.log("Connecté a SQLite")
})

db.run(`
    CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password TEXT
    )
`)

function registerUser(name, email, username, password, callback) {
    const query = `
        INSERT INTO users (name, username, email, password)
        VALUES (?, ?, ?, ?)
    `

    db.run(query, [name, username, email, password], function (err) {
        if (callback) {
            callback(err, this ? this.lastID : null)
        }
    })
}

db.registerUser = registerUser

module.exports = db