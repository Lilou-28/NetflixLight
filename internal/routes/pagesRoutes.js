const express = require("express")

const { getSessionTokenFromCookie } = require("../token")
const { getExpiredSessionCookie } = require("../cookies")
const { clearSessionAndRedirectToLogin, clearSessionAndSendUnauthorized, serve500 } = require("../responseHandlers")
const { getLocalizedDetails } = require("../tmdbUtils")
const { renderMovieDetailsTemplate } = require("../detailTemplate")
const { readTemplate, parseRequestUrl, checkTokenAsync, requirePageSession, dbRunAsync } = require("../serverRuntime")

const pageTemplateMap = {
    acceuil: "acceuil.html",
    login: "login.html",
    register: "register.html",
    userinfo: "userinfo.html",
    detail: "detail.html",
    films: "films.html",
    series: "series.html",
    "ma-liste": "ma-liste.html",
}

function createPagesRoutes({ templatesDir, tmdbBearerToken }) {
    const router = express.Router()

    router.get("/", async (req, res) => {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.redirect("/login")
            return
        }

        const { isValid } = await checkTokenAsync(sessionToken)
        if (!isValid) {
            clearSessionAndRedirectToLogin(res)
            return
        }

        res.redirect("/acceuil")
    })

    router.get("/details", async (req, res) => {
        const session = await requirePageSession(req, res)
        if (!session) return

        const requestUrl = parseRequestUrl(req)
        const movieId = requestUrl.searchParams.get("id")
        const contentType = requestUrl.searchParams.get("type") === "tv" ? "tv" : "movie"

        if (!movieId) {
            res.status(400).type("text/plain").send("Aucun id fourni")
            return
        }

        try {
            const [movie, template] = await Promise.all([
                getLocalizedDetails(contentType, movieId, tmdbBearerToken, "fr-FR"),
                readTemplate(templatesDir, "detail.html"),
            ])

            const html = renderMovieDetailsTemplate(template, movie, contentType)
            res.status(200).type("text/html").send(html)
        } catch (_error) {
            serve500(res)
        }
    }) 
    // Routes pour les pages accessibles après connexion et eviter la duplication de code pour chaque page
    for (const [route, fileName] of Object.entries({
        userinfo: "userinfo.html",
        acceuil: "acceuil.html",
        series: "series.html",
        films: "films.html",
        "ma-liste": "ma-liste.html",
    })) {
        router.get(`/${route}`, async (req, res) => {
            const session = await requirePageSession(req, res)
            if (!session) return

            try {
                const data = await readTemplate(templatesDir, fileName)
                res.status(200).type("text/html").send(data)
            } catch (_error) {
                serve500(res)
            }
        })
    }

    router.get("/logout", async (req, res) => {
        const sessionToken = getSessionTokenFromCookie(req)

        const finalizeLogout = () => {
            res.writeHead(302, {
                "Set-Cookie": getExpiredSessionCookie(),
                "Location": "/",
            })
            res.end()
        }

        if (!sessionToken) {
            finalizeLogout()
            return
        }

        try {
            await dbRunAsync("DELETE FROM tokens WHERE token = ?", [sessionToken])
        } catch (_error) {
            // Même en cas d'erreur DB, on termine la déconnexion côté client.
        }
        finalizeLogout()
    })
    // Route pour le SPA retourne uniquement le contenu dans <main>
    router.get("/api/page/:page", async (req, res) => {
        const { page } = req.params
        const isPublic = page === "login" || page === "register"

        const fileName = pageTemplateMap[page]
        if (!fileName) {
            res.status(404).type("text/plain").send("Page introuvable")
            return
        }

        if (!isPublic) {
            const sessionToken = getSessionTokenFromCookie(req)
            if (!sessionToken) {
                res.writeHead(401, { "Content-Type": "application/json" })
                res.end(JSON.stringify({ error: "Non connecté" }))
                return
            }

            const { isValid } = await checkTokenAsync(sessionToken)
            if (!isValid) {
                clearSessionAndSendUnauthorized(res)
                return
            }
        }

        try {
            const data = await readTemplate(templatesDir, fileName)
            const match = data.match(/<main[^>]*>([\s\S]*?)<\/main>/)
            const content = match ? `<main>${match[1]}</main>` : data
            res.status(200).type("text/html").send(content)
        } catch (_error) {
            serve500(res)
        }
    })

    return router
}

module.exports = {
    createPagesRoutes,
}
