const express = require("express")

const { requireApiSession, dbAllAsync, dbRunAsync } = require("../serverRuntime")

function createFavoritesRoutes() {
    const router = express.Router()

    router.get("/api/favoris", async (req, res) => {
        const session = await requireApiSession(req, res, { needUserId: true })
        if (!session) return

        try {
            const rows = await dbAllAsync("SELECT * FROM favoris WHERE user_id = ?", [session.userId])
            res.status(200).json(rows)
        } catch (_error) {
            res.status(500).json({ error: "Erreur base de données" })
        }
    })

    router.post("/api/favoris", async (req, res) => {
        const session = await requireApiSession(req, res, { needUserId: true })
        if (!session) return

        const { media_id, media_type, title, poster_path } = req.body || {}

        try {
            await dbRunAsync(
                "INSERT OR IGNORE INTO favoris (user_id, media_id, media_type, title, poster_path) VALUES (?, ?, ?, ?, ?)",
                [session.userId, media_id, media_type, title, poster_path],
            )
            res.status(200).json({ success: true })
        } catch (_error) {
            res.status(500).json({ error: "Erreur base de données" })
        }
    })

    router.delete("/api/favoris/:mediaId", async (req, res) => {
        const session = await requireApiSession(req, res, { needUserId: true })
        if (!session) return

        const { mediaId } = req.params
        if (!/^\d+$/.test(mediaId)) {
            res.status(400).json({ error: "media_id invalide" })
            return
        }

        try {
            await dbRunAsync("DELETE FROM favoris WHERE user_id = ? AND media_id = ?", [session.userId, mediaId])
            res.status(200).json({ success: true })
        } catch (_error) {
            res.status(500).json({ error: "Erreur base de données" })
        }
    })

    return router
}

module.exports = {
    createFavoritesRoutes,
}
