const express = require("express")

const {
    getMovies,
    getSeries,
    getTopRatedMovies,
    getTopRatedSeries,
    getMoviesAction,
    getMoviesFantasy,
    getMoviesThriller,
    getSeriesActionAdventure,
    getSeriesSciFiFantasy,
    getSeriesDrama,
    searchmovie,
    getTrendingAllWeek,
    getSimilar,
} = require("../appelAPI")
const { shuffleArray } = require("../arrayUtils")
const { getLocalizedDetails, getRandomCarouselPage } = require("../tmdbUtils")
const { requireApiSession, ensureTmdbTokenJson, dbGetAsync } = require("../serverRuntime")

function createCatalogRoutes({ tmdbBearerToken }) {
    const router = express.Router()

    router.get("/api/tmdb/details", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        const movieId = req.query.id
        const requestedType = req.query.type
        const contentType = requestedType === "tv" || requestedType === "person" ? requestedType : "movie"
        const language = req.query.language || "fr-FR"

        if (!movieId) {
            res.status(400).json({ error: "Aucun id fourni" })
            return
        }

        try {
            const details = await getLocalizedDetails(contentType, movieId, tmdbBearerToken, language)
            res.status(200).json(details)
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors du chargement des détails TMDB" })
        }
    })

    router.get("/api/userinfo", async (req, res) => {
        const session = await requireApiSession(req, res, {
            needUserId: true,
            withNoStore: true,
            clearCookieOnInvalid: true,
        })
        if (!session) return

        try {
            const userRow = await dbGetAsync("SELECT username, email, name FROM users WHERE id = ?", [session.userId])
            if (!userRow) {
                res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" })
                res.end(JSON.stringify({ error: "Utilisateur introuvable" }))
                return
            }

            res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" })
            res.end(JSON.stringify({
                username: userRow.username,
                email: userRow.email,
                name: userRow.name,
            }))
        } catch (_error) {
            res.writeHead(404, { "Content-Type": "application/json", "Cache-Control": "no-store" })
            res.end(JSON.stringify({ error: "Utilisateur introuvable" }))
        }
    })

    router.get("/api/popular-mixed", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const [moviesData, seriesData] = await Promise.all([
                getRandomCarouselPage(getMovies, tmdbBearerToken, 500),
                getRandomCarouselPage(getSeries, tmdbBearerToken, 500),
            ])

            const movies = Array.isArray(moviesData.results)
                ? moviesData.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            const series = Array.isArray(seriesData.results)
                ? seriesData.results.map((item) => ({ ...item, media_type: "tv" }))
                : []

            res.status(200).json({ results: shuffleArray([...movies, ...series]).slice(0, 40) })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération du carrousel populaire mixte" })
        }
    })

    router.get("/api/popular-movies", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getMovies, tmdbBearerToken, 500)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des films populaires" })
        }
    })

    router.get("/api/popular-series", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getSeries, tmdbBearerToken, 500)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des séries populaires" })
        }
    })

    router.get("/api/trending-mixed", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getTrendingAllWeek, tmdbBearerToken, 500)
            const items = Array.isArray(data.results)
                ? data.results.filter((item) => item && (item.media_type === "movie" || item.media_type === "tv"))
                : []

            res.status(200).json({ results: shuffleArray(items).slice(0, 40) })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération du carrousel tendance mixte" })
        }
    })

    router.get("/api/top-rated-mixed", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const [moviesData, seriesData] = await Promise.all([
                getRandomCarouselPage(getTopRatedMovies, tmdbBearerToken, 143),
                getRandomCarouselPage(getTopRatedSeries, tmdbBearerToken, 143),
            ])

            const movies = Array.isArray(moviesData.results)
                ? moviesData.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            const series = Array.isArray(seriesData.results)
                ? seriesData.results.map((item) => ({ ...item, media_type: "tv" }))
                : []

            res.status(200).json({ results: shuffleArray([...movies, ...series]).slice(0, 40) })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération du carrousel mieux note mixte" })
        }
    })

    router.get("/api/top-rated-movies", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getTopRatedMovies, tmdbBearerToken, 143)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des films mieux notés" })
        }
    })

    router.get("/api/top-rated-series", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getTopRatedSeries, tmdbBearerToken, 143)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des séries mieux notées" })
        }
    })

    router.get("/api/similar", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        const movieId = req.query.id
        const requestedType = req.query.type
        const contentType = requestedType === "tv" ? "tv" : "movie"
        const pageParam = Number.parseInt(req.query.page || "1", 10)
        const pageValue = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

        if (!movieId) {
            res.status(400).json({ error: "Aucun id fourni" })
            return
        }

        try {
            const data = await getSimilar(tmdbBearerToken, movieId, pageValue, "fr-FR", contentType)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: contentType }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des contenus similaires" })
        }
    })

    router.get("/discover/movie-action", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const [moviesData, seriesData] = await Promise.all([
                getRandomCarouselPage(getMoviesAction, tmdbBearerToken, 500),
                getRandomCarouselPage(getSeriesActionAdventure, tmdbBearerToken, 500),
            ])

            const movies = Array.isArray(moviesData.results)
                ? moviesData.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            const series = Array.isArray(seriesData.results)
                ? seriesData.results.map((item) => ({ ...item, media_type: "tv" }))
                : []

            res.status(200).json({ results: shuffleArray([...movies, ...series]) })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des contenus action" })
        }
    })

    router.get("/discover/movie-action-only", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getMoviesAction, tmdbBearerToken, 500)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des films action" })
        }
    })

    router.get("/discover/movie-fantasy", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const [moviesData, seriesData] = await Promise.all([
                getRandomCarouselPage(getMoviesFantasy, tmdbBearerToken, 500),
                getRandomCarouselPage(getSeriesSciFiFantasy, tmdbBearerToken, 500),
            ])

            const movies = Array.isArray(moviesData.results)
                ? moviesData.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            const series = Array.isArray(seriesData.results)
                ? seriesData.results.map((item) => ({ ...item, media_type: "tv" }))
                : []

            res.status(200).json({ results: shuffleArray([...movies, ...series]) })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des contenus fantasy" })
        }
    })

    router.get("/discover/movie-fantasy-only", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getMoviesFantasy, tmdbBearerToken, 500)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des films fantasy" })
        }
    })

    router.get("/discover/movie-thriller-only", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getMoviesThriller, tmdbBearerToken, 500)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des films thriller" })
        }
    })

    router.get("/discover/series-action-only", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getSeriesActionAdventure, tmdbBearerToken, 500)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des séries d'action" })
        }
    })

    router.get("/discover/series-sci-fi-only", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getSeriesSciFiFantasy, tmdbBearerToken, 500)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des séries science-fiction et fantasy" })
        }
    })

    router.get("/discover/series-drama-only", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return
        if (!ensureTmdbTokenJson(res, tmdbBearerToken)) return

        try {
            const data = await getRandomCarouselPage(getSeriesDrama, tmdbBearerToken, 500)
            const results = Array.isArray(data.results)
                ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                : []
            res.status(200).json({ results })
        } catch (error) {
            console.error("Erreur TMDB:", error.message)
            res.status(500).json({ error: "Erreur lors de la récupération des séries dramatiques" })
        }
    })

    router.get("/search-movie", async (req, res) => {
        const session = await requireApiSession(req, res)
        if (!session) return

        const query = req.query.query

        try {
            const data = await searchmovie(tmdbBearerToken, 1, query)
            res.status(200).json(data)
        } catch (_error) {
            res.status(500).json({ error: "Erreur TMDB" })
        }
    })

    return router
}

module.exports = {
    createCatalogRoutes,
}
