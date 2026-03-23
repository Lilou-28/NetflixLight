const http = require('http')
const fs = require('fs')
const path = require("path");
require("dotenv").config()
const db = require("../internal/database")
const { generateToken, checkToken } = require("../internal/token")

const host = 'localhost'
const port = 8080
const tmdbBearerToken = process.env.TMDB_BEARER_TOKEN || ""

const mimeTypes = {
    ".css": "text/css",
    ".js": "application/javascript",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".html": "text/html",
};

function getSessionTokenFromCookie(req) {
    const cookieHeader = req.headers.cookie || ""
    const cookies = cookieHeader.split(";")

    for (const cookie of cookies) {
        const trimmed = cookie.trim()
        if (trimmed.startsWith("session_token=")) {
            return decodeURIComponent(trimmed.slice("session_token=".length))
        }
    }

    return null
}

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        fs.readFile(path.join(__dirname,"../web/templates/index.html"), (err, data) => {
            res.writeHead(200, {"Content-Type" : "text/html" })
            res.end(data)
        })
    }

    else if (req.url === "/details"){
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(302, {"Location": "/login"})
            res.end()
            return
        }

        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                res.writeHead(302, {"Location": "/login"})
                res.end()
                return
            }

            fs.readFile(path.join(__dirname, "../web/templates/detail.html"), (err,data) => {
                res.writeHead(200, {"Content-Type" :  "text/html"})
                res.end(data)
            })
        })
    }
    else if (req.method === "GET" && req.url === "/login"){
        fs.readFile(path.join(__dirname, "../web/templates/login.html"), (err,data) => {
            res.writeHead(200, {"Content-Type" :  "text/html"})
            res.end(data)
        })
    }
    else if (req.method === "GET" && req.url.startsWith("/token")) {
        fs.readFile(path.join(__dirname, "../web/templates/token.html"), (err, data) => {
            if (err) {
                res.writeHead(500, {"Content-Type": "text/plain"})
                res.end("Erreur lors du chargement de la page token")
                return
            }

            res.writeHead(200, {"Content-Type": "text/html"})
            res.end(data)
        })
    }
    else if (req.method === "POST" && req.url === "/login") {
        let body = ""
        req.on("data", chunk => {
            body += chunk.toString()
        })
        req.on("end", () => {
            const params = new URLSearchParams(body)
            const username = params.get("username")
            const password = params.get("password")

            const query = `SELECT * FROM users WHERE username = ? AND password = ?`
            db.get(query, [username, password], (err, row) => {
                if (err) {
                    res.writeHead(500, {"Content-Type" : "text/plain"})
                    res.end("Erreur lors de la connexion")
                    return
                }
                if (row) {
                    const token = generateToken()
                    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                    db.run(`INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)`, [row.id, token, expiresAt], (err) => {
                        if (err) {
                            console.error("Erreur lors de la création du token :", err)
                            res.writeHead(500, {"Content-Type" : "text/plain"})
                            res.end("Erreur lors de la creation de session")
                            return
                        }

                        res.writeHead(302, {
                            "Set-Cookie": `session_token=${encodeURIComponent(token)}; Path=/; Max-Age=86400; SameSite=Lax`,
                            "Location": `/token?token=${encodeURIComponent(token)}`
                        })
                        res.end()
                    })
                } else {
                    res.writeHead(401, {"Content-Type" : "text/plain"})
                    res.end("Nom d'utilisateur ou mot de passe incorrect")
                }
            })
        })
    }
    else if (req.method === "GET" && req.url === "/register"){
        fs.readFile(path.join(__dirname, "../web/templates/register.html"), (err,data) => {
            res.writeHead(200, {"Content-Type" :  "text/html"})
            res.end(data)
        })
    }
    else if (req.method === "GET" && req.url === "/userinfo") {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(302, {"Location": "/login"})
            res.end()
            return
        }

        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                res.writeHead(302, {"Location": "/login"})
                res.end()
                return
            }

            fs.readFile(path.join(__dirname, "../web/templates/userinfo.html"), (err, data) => {
                if (err) {
                    res.writeHead(500, {"Content-Type": "text/plain"})
                    res.end("Erreur lors du chargement de la page userinfo")
                    return
                }

                res.writeHead(200, {"Content-Type": "text/html"})
                res.end(data)
            })
        })
    }

    else if (req.method === "POST" && req.url === "/register") {
        let body = ""
        req.on("data", chunk => {
            body += chunk.toString()
        })
        req.on("end", () => {
            const params = new URLSearchParams(body)
            const name = params.get("name")
            const email = params.get("email")
            const username = params.get("username")
            const password = params.get("password")
            const confirmPassword = params.get("confirm_password")
            if (password !== confirmPassword) {
                res.writeHead(400, {"Content-Type" : "text/plain"})
                res.end("Les mots de passe ne correspondent pas")
                return
            }
            db.registerUser(name, email, username, password, (err) => {
                if (err) {
                    if (err.message.includes("UNIQUE constraint failed")) {
                        res.writeHead(409, {"Content-Type" : "text/plain"})
                        res.end("Email ou nom d'utilisateur déjà utilisé")
                        return
                    }
                    res.writeHead(500, {"Content-Type" : "text/plain"})
                    res.end("Erreur lors de l'inscription")
                    return
                }

                fs.readFile(path.join(__dirname, "../web/templates/index.html"), (err,data) => {
                res.writeHead(200, {"Content-Type" :  "text/html"})
                res.end(data)
                })
            })
        })
    }
    else if (req.url && req.url.startsWith("/static/")) {
        const filePath = path.join(__dirname, "../web", req.url)
        const ext = path.extname(filePath).toLowerCase()
        const contentType = mimeTypes[ext] || "application/octet-stream"

        fs.readFile(filePath, (err, data) => {
            if (err) {
                res.writeHead(404, {"Content-Type" : "text/plain"})
                res.end("Fichier statique introuvable")
                return
            }
            res.writeHead(200, {"Content-Type" : contentType})
            res.end(data)
        })
    }
    else if (req.url === "/api/userinfo" && req.method === "GET") {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify({error: "Session manquante"}))
            return
        }

        checkToken(sessionToken, (isValid, userId) => {
            if (!isValid || !userId) {
                res.writeHead(401, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Session invalide"}))
                return
            }

            db.get("SELECT username, email, name FROM users WHERE id = ?", [userId], (err, userRow) => {
                if (err || !userRow) {
                    res.writeHead(404, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Utilisateur introuvable"}))
                    return
                }

                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify({
                    username: userRow.username,
                    email: userRow.email,
                    name: userRow.name,
                }))
            })
        })
    }
    else if ((req.url === "/api/popular-movies") && req.method === "GET") {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify({error: "Session manquante"}))
            return
        }
        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                res.writeHead(401, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Session invalide"}))
                return
            }

            if (!tmdbBearerToken) {
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "TMDB_BEARER_TOKEN manquant dans les variables d'environnement"}))
                return
            }
            fetch(`https://api.themoviedb.org/3/movie/popular?api_key=${tmdbBearerToken}&language=fr-FR&page=1`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`TMDB HTTP ${response.status}`)
                }
                return response.json()
            })
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des films populaires"}))
            })
            console.log("TOKEN:", tmdbBearerToken)
        })
    }
    else if ((req.url === "/api/popular-series") && req.method === "GET") {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify({error: "Session manquante"}))
            return
        }
        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                res.writeHead(401, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Session invalide"}))
                return
            }

            if (!tmdbBearerToken) {
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "TMDB_BEARER_TOKEN manquant dans les variables d'environnement"}))
                return
            }
            fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${tmdbBearerToken}&language=fr-FR&page=1`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`TMDB HTTP ${response.status}`)
                }
                return response.json()
            })
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des séries populaires"}))
            })
            console.log("TOKEN:", tmdbBearerToken)
        })
    }
    else if ((req.url === "/api/") && req.method === "GET") {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify({error: "Session manquante"}))
            return
        }
        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                res.writeHead(401, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Session invalide"}))
                return
            }

            if (!tmdbBearerToken) {
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "TMDB_BEARER_TOKEN manquant dans les variables d'environnement"}))
                return
            }
            fetch(`https://api.themoviedb.org/3/tv/popular?api_key=${tmdbBearerToken}&language=fr-FR&page=1`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`TMDB HTTP ${response.status}`)
                }
                return response.json()
            })
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des séries populaires"}))
            })
            console.log("TOKEN:", tmdbBearerToken)
        })
    }
    else if (req.url === "/logout") {
        res.writeHead(302, {
            "Set-Cookie": `session_token=; Path=/; Max-Age=0; SameSite=Lax`,
            "Location": "/"
        })
        res.end()
    }
    else {
        res.writeHead(404, {"Content-Type" : "text/plain"})
        res.end("Page non trouvée")
    }
})

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`)
})