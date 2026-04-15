const fs = require("fs")
const path = require("path")

const db = require("./database")
const { checkToken, getSessionTokenFromCookie, cleanupExpiredTokens } = require("./token")
const { getExpiredSessionCookie } = require("./cookies")
const { clearSessionAndRedirectToLogin } = require("./responseHandlers")

// fonction pour lire un template HTML depuis le système de fichiers
function readTemplate(templatesDir, fileName) {
    return fs.promises.readFile(path.join(templatesDir, fileName), "utf8")
}
// fonction pour parser l'URL d'une requête et en extraire les paramètres de recherche
function parseRequestUrl(req, host = "localhost") {
    return new URL(req.originalUrl || req.url, `http://${req.headers.host || host}`)
}
// fonction pour vérifier la validité d'un token de session de manière asynchrone
function checkTokenAsync(token) {
    return new Promise((resolve) => {
        checkToken(token, (isValid, userId) => {
            resolve({ isValid, userId })
        })
    })
}
// fonction pour supprimer les tokens expirés de la base de données de manière asynchrone
function cleanupExpiredTokensAsync() {
    return new Promise((resolve) => {
        cleanupExpiredTokens(() => resolve())
    })
}
// fonctions pour interagir avec la base de données SQLite de manière asynchrone en utilisant des Promises, ce qui permet d'utiliser async/await dans les routes et autres parties du code qui nécessitent des opérations de base de données.
function dbGetAsync(query, params = []) {
    return new Promise((resolve, reject) => {
        db.get(query, params, (err, row) => {
            if (err) {
                reject(err)
                return
            }
            resolve(row)
        })
    })
}// recup 1 ligne 

function dbAllAsync(query, params = []) {
    return new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
            if (err) {
                reject(err)
                return
            }
            resolve(rows)
        })
    })
}// recup plusieurs lignes

function dbRunAsync(query, params = []) {
    return new Promise((resolve, reject) => {
        db.run(query, params, function onRun(err) {
            if (err) {
                reject(err)
                return
            }
            resolve(this)
        })
    })
}// excute une requete 

// fonction pour exiger une session valide pour accéder à une page, redirigeant vers la page de connexion si la session est manquante ou invalide   
async function requirePageSession(req, res) {
    const sessionToken = getSessionTokenFromCookie(req)
    if (!sessionToken) {
        res.redirect("/login")
        return null
    }

    const { isValid, userId } = await checkTokenAsync(sessionToken)
    if (!isValid) {
        clearSessionAndRedirectToLogin(res)
        return null
    }

    return { sessionToken, userId }
}
// verife sessions et tokens pour valider les requetes API
async function requireApiSession(req, res, options = {}) {
    const { needUserId = false, withNoStore = false, clearCookieOnInvalid = false } = options
    const sessionToken = getSessionTokenFromCookie(req)

    const commonHeaders = withNoStore ? { "Cache-Control": "no-store" } : {}

    if (!sessionToken) {
        res.writeHead(401, { "Content-Type": "application/json", ...commonHeaders })
        res.end(JSON.stringify({ error: "Session manquante" }))
        return null
    }

    const { isValid, userId } = await checkTokenAsync(sessionToken)
    if (!isValid || (needUserId && !userId)) {
        const headers = {
            "Content-Type": "application/json",
            ...commonHeaders,
        }

        if (clearCookieOnInvalid) {
            headers["Set-Cookie"] = getExpiredSessionCookie()
        }

        res.writeHead(401, headers)
        res.end(JSON.stringify({ error: "Session invalide" }))
        return null
    }

    return { sessionToken, userId }
}
// verife token tmdb 
function ensureTmdbTokenJson(res, tmdbBearerToken) {
    if (tmdbBearerToken) return true

    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ error: "TMDB_BEARER_TOKEN manquant dans les variables d'environnement" }))
    return false
}

module.exports = {
    readTemplate,
    parseRequestUrl,
    checkTokenAsync,
    cleanupExpiredTokensAsync,
    dbGetAsync,
    dbAllAsync,
    dbRunAsync,
    requirePageSession,
    requireApiSession,
    ensureTmdbTokenJson,
}
