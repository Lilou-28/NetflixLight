const express = require("express")

const db = require("../database")
const { hashPassword, verifyPassword } = require("../hashmdp")
const { generateToken } = require("../token")
const { getSessionCookie } = require("../cookies")
const { formatLocalDateTime, serve500 } = require("../responseHandlers")
const { readTemplate, dbGetAsync, dbRunAsync, cleanupExpiredTokensAsync } = require("../serverRuntime")

function createAuthRoutes({ templatesDir }) {
    const router = express.Router()
    // Route pour afficher le formulaire de connexion
    router.get("/login", async (_req, res) => {
        try {
            const data = await readTemplate(templatesDir, "login.html")
            res.status(200).type("text/html").send(data)
        } catch (_error) {
            serve500(res)
        }
    })
    // Route pour traiter le formulaire de connexion
    router.post("/login", async (req, res) => {
        const { username, password } = req.body

        if (!username || username.length < 3) {
            res.status(400).send("Username min 3 chars")
            return
        }

        if (!password || password.length < 6) {
            res.status(400).send("Password min 6 chars")
            return
        }

        try {
            const row = await dbGetAsync("SELECT * FROM users WHERE username = ?", [username])
            if (!row) {
                res.status(401).type("text/plain").send("Nom d'utilisateur ou mot de passe incorrect")
                return
            }

            let isPasswordValid = false
            try {
                isPasswordValid = await verifyPassword(password, row.password)
            } catch (verifyErr) {
                console.error("Erreur lors de la verification du mot de passe:", verifyErr)
                serve500(res)
                return
            }

            if (!isPasswordValid) {
                res.status(401).type("text/plain").send("Nom d'utilisateur ou mot de passe incorrect")
                return
            }

            const token = generateToken()
            const sessionLifetimeMs = 2 * 60 * 60 * 1000
            const expiresAt = formatLocalDateTime(new Date(Date.now() + sessionLifetimeMs))

            await cleanupExpiredTokensAsync()
            await dbRunAsync(
                `INSERT INTO tokens (user_id, token, expires_at)
                 VALUES (?, ?, ?)
                 ON CONFLICT(user_id) DO UPDATE SET
                    token = excluded.token,
                    expires_at = excluded.expires_at`,
                [row.id, token, expiresAt],
            )

            res.setHeader("Set-Cookie", getSessionCookie(token, 7200))
            res.redirect("/acceuil")
        } catch (error) {
            console.error("Erreur lors de la création de session:", error)
            serve500(res)
        }
    })
    // Route pour afficher le formulaire d'inscription
    router.get("/register", async (_req, res) => {
        try {
            const data = await readTemplate(templatesDir, "register.html")
            res.status(200).type("text/html").send(data)
        } catch (_error) {
            serve500(res)
        }
    })
    // Route pour traiter le formulaire d'inscription
    router.post("/register", async (req, res) => {
        const { name, email, username, password, confirm_password: confirmPassword } = req.body

        if (password !== confirmPassword) {
            res.status(400).type("text/plain").send("Les mots de passe ne correspondent pas")
            return
        }

        try {
            const hashedPassword = await hashPassword(password)

            db.registerUser(name, email, username, hashedPassword, (err) => {
                if (err) {
                    if (err.message.includes("UNIQUE constraint failed")) {
                        res.status(409).type("text/plain").send("Cette donnée existe déjà")
                        return
                    }
                    serve500(res)
                    return
                }

                res.redirect("/login")
            })
        } catch (hashErr) {
            console.error("Erreur lors du hash du mot de passe:", hashErr)
            serve500(res)
        }
    })

    return router
}

module.exports = {
    createAuthRoutes,
}
