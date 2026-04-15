const express = require("express")
const path = require("path")
require("dotenv").config()

require("../internal/database")

const { serve404 } = require("../internal/responseHandlers")
const { createAuthRoutes } = require("../internal/routes/authRoutes")
const { createPagesRoutes } = require("../internal/routes/pagesRoutes")
const { createCatalogRoutes } = require("../internal/routes/APIRoutes")
const { createFavoritesRoutes } = require("../internal/routes/favoritesRoutes")

const host = process.env.HOST || "localhost"
const port = process.env.PORT || 8080
const tmdbBearerToken = process.env.TMDB_BEARER_TOKEN || ""

const app = express()
const templatesDir = path.join(__dirname, "../web/templates")
const staticDir = path.join(__dirname, "../web/static")

app.use(express.urlencoded({ extended: false })) 
app.use(express.json({ limit: "10kb" }))

app.use("/static", express.static(staticDir))
app.use("/static", (_req, res) => {
    res.status(404).type("text/plain").send("Fichier statique introuvable")
})

app.use(createAuthRoutes({ templatesDir }))
app.use(createPagesRoutes({ templatesDir, tmdbBearerToken }))
app.use(createCatalogRoutes({ tmdbBearerToken }))
app.use(createFavoritesRoutes())

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        if (req.path.startsWith("/api/")) {
            res.status(400).json({ error: "JSON invalide" })
            return
        }
    }
    next(err)
})

app.use((_req, res) => {
    serve404(res)
})

app.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`)
})
