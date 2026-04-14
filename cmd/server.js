const http = require('http')
const fs = require('fs')
const path = require("path");
require("dotenv").config()
const db = require("../internal/database")
const { generateToken, checkToken, getSessionTokenFromCookie, cleanupExpiredTokens } = require("../internal/token");
const { hashPassword, verifyPassword } = require('../internal/hashmdp');
const { getMovies, getSeries, getTopRatedMovies, getTopRatedSeries, getMoviesAction, getMoviesFantasy, getMoviesThriller, getSeriesActionAdventure, getSeriesSciFiFantasy, getSeriesDrama, searchmovie, getTrendingAllWeek, getSimilar } = require('../internal/appelAPI')
const { shuffleArray } = require("../internal/arrayUtils")
const { escapeHtml } = require("../internal/htmlUtils")
const { getYoutubeTrailer, getLocalizedDetails, getRandomCarouselPage } = require("../internal/tmdbUtils")
const { getSessionCookie, getExpiredSessionCookie } = require("../internal/cookies")
const { formatLocalDateTime, clearSessionAndRedirectToLogin, clearSessionAndSendUnauthorized, serve404, serve500 } = require("../internal/responseHandlers")

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


const server = http.createServer((req, res) => {
    // Nettoyage des tokens expirés à chaque requête pour éviter d'avoir des tokens invalides en base
    if (req.url === "/") {
    const sessionToken = getSessionTokenFromCookie(req);
    if (!sessionToken) {
        res.writeHead(302, { "Location": "/login" });
        res.end();
        return;
    }

    checkToken(sessionToken, (isValid) => {
        if (!isValid) {
            clearSessionAndRedirectToLogin(res)
            return;
        }

        res.writeHead(302, { "Location": "/acceuil" });
        res.end();
    });
    }
    // Route pour la page de détails d'un film/série
    else if (req.url.startsWith("/details")) {
        // Vérification de la session utilisateur avant de servir la page de détails
        const sessionToken = getSessionTokenFromCookie(req);
        if (!sessionToken) {
            res.writeHead(302, { "Location": "/login" });
            res.end();
            return;
        }

        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                clearSessionAndRedirectToLogin(res)
                return;
            }

            const requestUrl = new URL(req.url, `http://${req.headers.host || host}`);
            const movieId = requestUrl.searchParams.get("id");
            const contentType = requestUrl.searchParams.get("type") === "tv" ? "tv" : "movie";

            if (!movieId) {
                res.writeHead(400, { "Content-Type": "text/plain" });
                res.end("Aucun id fourni");
                return;
            }
            // Récupération des détails localisés du film/série avant de servir la page de détails, pour éviter d'avoir une page de détails qui se charge sans données pendant que les détails sont récupérés côté client
            (async () => {
                try {
                    const movie = await getLocalizedDetails(contentType, movieId, tmdbBearerToken, "fr-FR")

                    fs.readFile(path.join(__dirname, "../web/templates/detail.html"), "utf8", (err, data) => {
                        if (err) {
                            res.writeHead(500, { "Content-Type": "text/plain" });
                            res.end("Erreur serveur");
                            return;
                        }

                        const poster = movie.poster_path
                            ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
                            : "https://via.placeholder.com/500x750?text=No+Image";
                        
                        const backdrop = movie.backdrop_path
                            ? `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`
                            : "https://via.placeholder.com/500x750?text=No+Image";

                        const runtimeMinutes = Number.isFinite(movie.runtime)
                            ? movie.runtime
                            : (Array.isArray(movie.episode_run_time) ? movie.episode_run_time[0] : null);

                        const formattedRuntime = Number.isFinite(runtimeMinutes) && runtimeMinutes > 0
                            ? `${Math.floor(runtimeMinutes / 60)}h ${String(runtimeMinutes % 60).padStart(2, "0")}min`
                            : "Durée inconnue";

                        const seasonsCount = Number.isFinite(movie.number_of_seasons) ? movie.number_of_seasons : null;
                        const runtimeLabel = contentType === "tv" ? "Saisons" : "Durée";
                        const runtimeValue = contentType === "tv"
                            ? (seasonsCount === null ? "Nombre de saisons inconnu" : `${seasonsCount} saison${seasonsCount > 1 ? "s" : ""}`)
                            : formattedRuntime;

                        const castMembers = Array.isArray(movie.credits && movie.credits.cast)
                            ? movie.credits.cast.slice(0, 14)
                            : [];

                        const castSummary = castMembers.length
                            ? castMembers
                                .map(c => {
                                    const cleanRole = typeof c.character === "string"
                                        ? c.character.replace(/[()]/g, "").replace(/\s+/g, " ").trim()
                                        : "";
                                    const formattedRole = cleanRole.replace(/\s+voice$/i, " - voice");
                                    return formattedRole ? `${escapeHtml(c.name)} (${escapeHtml(formattedRole)})` : escapeHtml(c.name);
                                })
                                .join(", ")
                            : "Casting inconnu";

                        const castCards = castMembers.length
                            ? castMembers
                                .map(c => {
                                    const actorName = escapeHtml(c.name || "Acteur inconnu");
                                    const cleanRole = typeof c.character === "string"
                                        ? c.character.replace(/[()]/g, "").replace(/\s+/g, " ").trim()
                                        : "";
                                    const formattedRole = cleanRole.replace(/\s+voice$/i, " - voice");
                                    const roleText = escapeHtml(formattedRole || "Rôle inconnu");
                                    const portrait = c.profile_path
                                        ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
                                        : "https://via.placeholder.com/185x278?text=No+Image";

                                    return `
                                        <article class="cast-card">
                                            <img src="${portrait}" alt="${actorName}" class="cast-card__image" />
                                            <h3 class="cast-card__name">${actorName}</h3>
                                            <p class="cast-card__role">${roleText}</p>
                                        </article>
                                    `;
                                })
                                .join("")
                            : `<p class="cast-empty">Casting inconnu</p>`;

                        const trailer = getYoutubeTrailer(movie.videos)
                        const movieTitle = movie.title || movie.original_name || "Titre inconnu"
                        const trailerSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(`bande annonce ${movieTitle}`)}`
                        const trailerBlock = trailer
                            ? `
                                <div class="trailer-player">
                                    <iframe
                                        id="iframeSon"
                                        src="https://www.youtube.com/embed/${encodeURIComponent(trailer.key)}?enablejsapi=1&playsinline=1"
                                        title="Bande annonce de ${escapeHtml(movieTitle)}"
                                        loading="lazy"
                                        referrerpolicy="strict-origin-when-cross-origin"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowfullscreen
                                    ></iframe>
                                </div>
                                <a class="trailer-link" href="https://www.youtube.com/watch?v=${encodeURIComponent(trailer.key)}" target="_blank" rel="noopener noreferrer">Ouvrir sur YouTube</a>
                                <button class="play" id="buttonPlay">Lecture</button>
                                <button class="mute" id="buttonMute">Couper le son</button>
                                <button class="fullscreen" id="buttonFullscreen">Plein écran</button>
                            `
                            : `
                                <p class="trailer-empty">Bande annonce indisponible pour ce contenu.</p>
                                <a class="trailer-link" href="${trailerSearchUrl}" target="_blank" rel="noopener noreferrer">Rechercher sur YouTube</a>
                            `
                        // Insertion des données du film/série dans le template HTML
                        const html = data
                            .replace("{{title}}", movieTitle)
                            .replace("{{overview}}", movie.overview || "Aucune description disponible")
                            .replace("{{poster}}", poster)
                            .replace("{{backdrop_path}}", backdrop)
                            .replace("{{vote_average}}", movie.vote_average || "Pas de note moyenne")
                            .replace("{{vote_count}}", movie.vote_count || "Pas de nombre de votes")
                            .replace("{{genres}}", Array.isArray(movie.genres) ? movie.genres.map(g => g.name).join(", ") : "Genres inconnus")
                            .replace("{{release_date}}", movie.release_date || "Date de sortie inconnue")
                            .replace("{{runtime_label}}", runtimeLabel)
                            .replace("{{runtime}}", runtimeValue)
                            .replace("{{cast}}", castSummary)
                            .replace("{{cast_cards}}", castCards)
                            .replace("{{trailer_block}}", trailerBlock)
                        res.writeHead(200, { "Content-Type": "text/html" });
                        res.end(html);
                    });
                } catch (error) {
                    serve500(res);
                }
            })();
        });
    }
    // Route pour la page d'accueil après connexion
    else if (req.method === "GET" && req.url.startsWith("/login")){
        fs.readFile(path.join(__dirname, "../web/templates/login.html"), (err,data) => {
            if (err) {
                serve500(res);
                return;
            }
            res.writeHead(200, {"Content-Type" :  "text/html"})
            res.end(data)
        })
    }
    // Recupération des données de l'utilisateur connecté pour la page userinfo
    else if (req.method === "POST" && req.url === "/login") {
        let body = ""
        req.on("data", chunk => {
            body += chunk.toString()
        })
        req.on("end", async () => {
            const params = new URLSearchParams(body)
            const username = params.get("username")
            const password = params.get("password")

            const query = `SELECT * FROM users WHERE username = ?`
            db.get(query, [username], async (err, row) => {
                if (err) {
                    serve500(res)
                    return
                }

                if (!row) {
                    res.writeHead(401, {"Content-Type" : "text/plain"})
                    res.end("Nom d'utilisateur ou mot de passe incorrect")
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
                // Verification du mot de passe et création d'une session si le mot de passe est correct
                if (isPasswordValid) {
                    const token = generateToken()
                    const sessionLifetimeMs = 2 * 60 * 60 * 1000 
                    const expiresAt = formatLocalDateTime(new Date(Date.now() + sessionLifetimeMs))
                    cleanupExpiredTokens(() => {
                        db.run(
                            `INSERT INTO tokens (user_id, token, expires_at)
                             VALUES (?, ?, ?)
                             ON CONFLICT(user_id) DO UPDATE SET
                                token = excluded.token,
                                expires_at = excluded.expires_at`,
                            [row.id, token, expiresAt],
                            (insertErr) => {
                                if (insertErr) {
                                    console.error("Erreur lors de la création du token :", insertErr)
                                    serve500(res)
                                    return
                                }

                                res.writeHead(302, {
                                    "Set-Cookie": getSessionCookie(token, 7200),
                                    "Location": `/acceuil`
                                })
                                res.end()
                            }
                        )
                    })
                } else {
                    res.writeHead(401, {"Content-Type" : "text/plain"})
                    res.end("Nom d'utilisateur ou mot de passe incorrect")
                }
            })
        })
    }
    // Route pour la page d'inscription
    else if (req.method === "GET" && req.url === "/register"){
        fs.readFile(path.join(__dirname, "../web/templates/register.html"), (err,data) => {
            if (err) {
                serve500(res)
                return
            }
            res.writeHead(200, {"Content-Type" :  "text/html"})
            res.end(data)
        })
    }
    // Route pour la page d'informations de l'utilisateur connecté
    else if (req.method === "GET" && req.url === "/userinfo") {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(302, {"Location": "/login"})
            res.end()
            return
        }

        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                clearSessionAndRedirectToLogin(res)
                return
            }

            fs.readFile(path.join(__dirname, "../web/templates/userinfo.html"), (err, data) => {
                if (err) {
                    serve500(res)
                    return
                }

                res.writeHead(200, {"Content-Type": "text/html"})
                res.end(data)
            })
        })
    }
    // Route pour le traitement de l'inscription d'un nouvel utilisateur
    else if (req.method === "POST" && req.url === "/register") {
        let body = ""
        req.on("data", chunk => {
            body += chunk.toString()
        })
        req.on("end", async () => {
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

            let hashedpassword = ""
            try {
                hashedpassword = await hashPassword(password)
            } catch (hashErr) {
                console.error("Erreur lors du hash du mot de passe:", hashErr)
                serve500(res)
                return
            }

            db.registerUser(name, email, username, hashedpassword, (err) => {
                if (err) {
                    if (err.message.includes("UNIQUE constraint failed")) {
                        res.writeHead(409, {"Content-Type" : "text/plain"})
                        res.end("Email ou nom d'utilisateur déjà utilisé")
                        return
                    }
                    serve500(res)
                    return
                }

                res.writeHead(302, {"Location": "/login"})
                res.end()
            })
        })
    }
    // Route pour récupérer les détails localisés d'un film/série depuis TMDB
    else if (req.method === "GET" && req.url.startsWith("/api/tmdb/details")) {
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

            const requestUrl = new URL(req.url, `http://${req.headers.host || host}`)
            const movieId = requestUrl.searchParams.get("id")
            const requestedType = requestUrl.searchParams.get("type")
            const contentType = requestedType === "tv" || requestedType === "person" ? requestedType : "movie"
            const language = requestUrl.searchParams.get("language") || "fr-FR"

            if (!movieId) {
                res.writeHead(400, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Aucun id fourni"}))
                return
            }

            getLocalizedDetails(contentType, movieId, tmdbBearerToken, language)
                .then(details => {
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify(details))
                })
                .catch(error => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors du chargement des détails TMDB"}))
                })
        })
    }
    // Route pour servir les fichiers statiques (CSS, JS, images)
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
    // Route pour recupérer les données de l'utilisateur connecté pour la page userinfo
    else if (req.url === "/api/userinfo" && req.method === "GET") {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json", "Cache-Control": "no-store"})
            res.end(JSON.stringify({error: "Session manquante"}))
            return
        }

        checkToken(sessionToken, (isValid, userId) => {
            if (!isValid || !userId) {
                res.writeHead(401, {
                    "Content-Type": "application/json",
                    "Cache-Control": "no-store",
                    "Set-Cookie": getExpiredSessionCookie(),
                })
                res.end(JSON.stringify({error: "Session invalide"}))
                return
            }

            db.get("SELECT username, email, name FROM users WHERE id = ?", [userId], (err, userRow) => {
                if (err || !userRow) {
                    res.writeHead(404, {"Content-Type": "application/json", "Cache-Control": "no-store"})
                    res.end(JSON.stringify({error: "Utilisateur introuvable"}))
                    return
                }

                res.writeHead(200, {"Content-Type": "application/json", "Cache-Control": "no-store"})
                res.end(JSON.stringify({
                    username: userRow.username,
                    email: userRow.email,
                    name: userRow.name,
                }))
            })
        })
    }
    // Routes pour récupérer les données de TMDB pour les carrousels de la page d'accueil
    else if (req.url === "/api/popular-mixed" && req.method === "GET") {
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
            // Récupération simultanée des films et séries populaires pour créer un carrousel mixte
            Promise.all([
                getRandomCarouselPage(getMovies, tmdbBearerToken, 500),
                getRandomCarouselPage(getSeries, tmdbBearerToken, 500),
            ])
                .then(([moviesData, seriesData]) => {
                    const movies = Array.isArray(moviesData.results)
                        ? moviesData.results.map((item) => ({ ...item, media_type: "movie" }))
                        : []
                    const series = Array.isArray(seriesData.results)
                        ? seriesData.results.map((item) => ({ ...item, media_type: "tv" }))
                        : []

                    const results = shuffleArray([...movies, ...series]).slice(0, 40)
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération du carrousel populaire mixte"}))
                })
        })
    }
    // Route pour récupérer les films populaires pour le carrousel de la page d'accueil
    else if (req.url === "/api/popular-movies" && req.method === "GET") {
        // Vérification de la session utilisateur avant de récupérer les données de TMDB
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

            getRandomCarouselPage(getMovies, tmdbBearerToken, 500)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                        : []
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des films populaires"}))
                })
        })
    }
    // Route pour récupérer les séries populaires pour le carrousel de la page d'accueil
    else if (req.url === "/api/popular-series" && req.method === "GET") {
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

            getRandomCarouselPage(getSeries, tmdbBearerToken, 500)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                        : []
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des séries populaires"}))
                })
        })
    }
    // Route pour récupérer les films et séries tendances de la semaine pour le carrousel de la page d'accueil
    else if (req.url === "/api/trending-mixed" && req.method === "GET") {
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

            getRandomCarouselPage(getTrendingAllWeek, tmdbBearerToken, 500)
                .then((data) => {
                    const items = Array.isArray(data.results)
                        ? data.results.filter((item) => item && (item.media_type === "movie" || item.media_type === "tv"))
                        : []
                    const results = shuffleArray(items).slice(0, 40)
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération du carrousel tendance mixte"}))
                })
        })
    }
    // Route pour récupérer les films et séries mieux notés pour le carrousel de la page d'accueil
    else if (req.url === "/api/top-rated-mixed" && req.method === "GET") {
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

            Promise.all([
                getRandomCarouselPage(getTopRatedMovies, tmdbBearerToken, 143),
                getRandomCarouselPage(getTopRatedSeries, tmdbBearerToken, 143),
            ])
                .then(([moviesData, seriesData]) => {
                    const movies = Array.isArray(moviesData.results)
                        ? moviesData.results.map((item) => ({ ...item, media_type: "movie" }))
                        : []
                    const series = Array.isArray(seriesData.results)
                        ? seriesData.results.map((item) => ({ ...item, media_type: "tv" }))
                        : []
                    const results = shuffleArray([...movies, ...series]).slice(0, 40)

                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération du carrousel mieux note mixte"}))
                })
        })
    }
    // Route pour récupérer les films mieux notés pour le carrousel de la page d'accueil
    else if (req.url === "/api/top-rated-movies" && req.method === "GET") {
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

            getRandomCarouselPage(getTopRatedMovies, tmdbBearerToken, 143)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                        : []
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des films mieux notés"}))
                })
        })
    }
    // Route pour récupérer les séries mieux notés pour le carrousel de la page d'accueil
    else if (req.url === "/api/top-rated-series" && req.method === "GET") {
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

            getRandomCarouselPage(getTopRatedSeries, tmdbBearerToken, 143)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                        : []
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des séries mieux notées"}))
                })
        })
    }
    // Route pour récupérer les films/séries similaires à un film/série donné pour la page de détails
    else if (req.url.startsWith("/api/similar") && req.method === "GET") {
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

            const requestUrl = new URL(req.url, `http://${req.headers.host || host}`)
            const movieId = requestUrl.searchParams.get("id")
            const requestedType = requestUrl.searchParams.get("type")
            const contentType = requestedType === "tv" ? "tv" : "movie"
            const pageParam = Number.parseInt(requestUrl.searchParams.get("page") || "1", 10)
            const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1

            if (!movieId) {
                res.writeHead(400, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Aucun id fourni"}))
                return
            }

            getSimilar(tmdbBearerToken, movieId, page, "fr-FR", contentType)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: contentType }))
                        : []
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des contenus similaires"}))
                })
        })
    }
    // Route pour récupérer les films/séries d'action et fantasy pour les carrousels de la page d'accueil
    else if (req.url === "/discover/movie-action" && req.method === "GET"){
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify
            ({error: "Session manquante"}))
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
            Promise.all([
                getRandomCarouselPage(getMoviesAction, tmdbBearerToken, 500),
                getRandomCarouselPage(getSeriesActionAdventure, tmdbBearerToken, 500),
            ])
            .then(([moviesData, seriesData]) => {
                const movies = Array.isArray(moviesData.results)
                    ? moviesData.results.map((item) => ({ ...item, media_type: "movie" }))
                    : []
                const series = Array.isArray(seriesData.results)
                    ? seriesData.results.map((item) => ({ ...item, media_type: "tv" }))
                    : []

                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify({ results: shuffleArray([...movies, ...series]) }))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des contenus action"}))
            })
        })
    }
    // Route pour récupérer uniquement les films d'action pour le carrousel de la page d'accueil
    else if (req.url === "/discover/movie-action-only" && req.method === "GET"){
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify
            ({error: "Session manquante"}))
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
            getRandomCarouselPage(getMoviesAction, tmdbBearerToken, 500)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                        : []

                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des films action"}))
                })
        })
    }
    // Route pour récupérer les films et séries fantasy pour les carrousels de la page d'accueil
    else if (req.url === "/discover/movie-fantasy" && req.method === "GET"){
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify
            ({error: "Session manquante"}))
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
            Promise.all([
                getRandomCarouselPage(getMoviesFantasy, tmdbBearerToken, 500),
                getRandomCarouselPage(getSeriesSciFiFantasy, tmdbBearerToken, 500),
            ])
            .then(([moviesData, seriesData]) => {
                const movies = Array.isArray(moviesData.results)
                    ? moviesData.results.map((item) => ({ ...item, media_type: "movie" }))
                    : []
                const series = Array.isArray(seriesData.results)
                    ? seriesData.results.map((item) => ({ ...item, media_type: "tv" }))
                    : []

                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify({ results: shuffleArray([...movies, ...series]) }))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des contenus fantasy"}))
            })
        })
    }
    // Route pour récupérer uniquement les films fantasy pour le carrousel de la page d'accueil
    else if (req.url === "/discover/movie-fantasy-only" && req.method === "GET"){
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify
            ({error: "Session manquante"}))
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
            getRandomCarouselPage(getMoviesFantasy, tmdbBearerToken, 500)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                        : []

                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des films fantasy"}))
                })
        })
    }
    // Route pour récupérer uniquement les films thriller pour le carrousel de la page d'accueil
    else if (req.url === "/discover/movie-thriller-only" && req.method === "GET"){
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
            getRandomCarouselPage(getMoviesThriller, tmdbBearerToken, 500)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "movie" }))
                        : []

                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des films thriller"}))
                })
        })
    }
    // Route pour récupérer uniquement les séries d'action et d'aventure pour le carrousel de la page d'accueil
    else if (req.url === "/discover/series-action-only" && req.method === "GET"){
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
            getRandomCarouselPage(getSeriesActionAdventure, tmdbBearerToken, 500)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                        : []

                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des séries d'action"}))
                })
        })
    }
    // Route pour récupérer uniquement les séries de science-fiction et fantasy pour le carrousel de la page d'accueil
    else if (req.url === "/discover/series-sci-fi-only" && req.method === "GET"){
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
            getRandomCarouselPage(getSeriesSciFiFantasy, tmdbBearerToken, 500)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                        : []

                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des séries science-fiction et fantasy"}))
                })
        })
    }
    // Route pour récupérer uniquement les séries dramatiques pour le carrousel de la page d'accueil
    else if (req.url === "/discover/series-drama-only" && req.method === "GET"){
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
            getRandomCarouselPage(getSeriesDrama, tmdbBearerToken, 500)
                .then((data) => {
                    const results = Array.isArray(data.results)
                        ? data.results.map((item) => ({ ...item, media_type: "tv" }))
                        : []

                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({ results }))
                })
                .catch((error) => {
                    console.error("Erreur TMDB:", error.message)
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur lors de la récupération des séries dramatiques"}))
                })
        })
    }
    // Route pour gérer la déconnexion de l'utilisateur
    else if (req.url === "/logout") {
        const sessionToken = getSessionTokenFromCookie(req)
        const finalizeLogout = () => {
            res.writeHead(302, {
                "Set-Cookie": getExpiredSessionCookie(),
                "Location": "/"
            })
            res.end()
        }

        if (!sessionToken) {
            finalizeLogout()
            return
        }
        // Suppression du token de session de la base de données pour invalider la session
        db.run("DELETE FROM tokens WHERE token = ?", [sessionToken], () => {
            finalizeLogout()
        })
    }
    
    else if (req.url === "/acceuil") {
        const sessionToken = getSessionTokenFromCookie(req)
        if (!sessionToken) {
            res.writeHead(302, {"Location": "/login"})
            res.end()
            return
        }

        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                clearSessionAndRedirectToLogin(res)
                return
            }

            fs.readFile(path.join(__dirname,"../web/templates/acceuil.html"), (err, data) => {
                if (err) {
                    serve500(res)
                    return
                }

                res.writeHead(200, {"Content-Type" : "text/html" })
                res.end(data)
            })
        })
    }
    else if (req.method === "GET" && req.url === "/series") {
        const sessionToken = getSessionTokenFromCookie(req);
        if (!sessionToken) {
            res.writeHead(302, { "Location": "/login" });
            res.end();
            return;
        }
        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                clearSessionAndRedirectToLogin(res)
                return;
            }
            fs.readFile(path.join(__dirname, "../web/templates/series.html"), (err, data) => {
                if (err) {
                    serve500(res)
                    return
                }
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(data);
            });
        });
    }
    else if (req.method === "GET" && req.url === "/films") {
        const sessionToken = getSessionTokenFromCookie(req);
        if (!sessionToken) {
            res.writeHead(302, { "Location": "/login" });
            res.end();
            return;
        }
        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                clearSessionAndRedirectToLogin(res)
                return;
            }
            fs.readFile(path.join(__dirname, "../web/templates/films.html"), (err, data) => {
                if (err) {
                    serve500(res)
                    return
                }
                res.writeHead(200, { "Content-Type": "text/html" });
                res.end(data);
            });
        });
    }

    else if (req.method === "GET" && req.url === "/ma-liste") {
    const sessionToken = getSessionTokenFromCookie(req);
    if (!sessionToken) {
        res.writeHead(302, { "Location": "/login" });
        res.end();
        return;
    }
    checkToken(sessionToken, (isValid) => {
        if (!isValid) {
            clearSessionAndRedirectToLogin(res)
            return;
        }
        fs.readFile(path.join(__dirname, "../web/templates/ma-liste.html"), (err, data) => {
            if (err) {
                serve500(res)
                return
            }
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(data);
        });
    });
}

    else if (req.url.startsWith("/search-movie") && req.method === "GET") {

        const urlObj = new URL(req.url, `http://${req.headers.host}`);
        const query = urlObj.searchParams.get("query");

        const sessionToken = getSessionTokenFromCookie(req);
          if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify
            ({error: "Session manquante"}))
            return
        }
        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                res.writeHead(401, {"Content-Type": "application/json"});
                res.end(JSON.stringify({error: "Session invalide"}));
                return;
            }
            searchmovie(tmdbBearerToken, 1, query)
                .then(data => {
                    res.writeHead(200, {"Content-Type": "application/json"});
                    res.end(JSON.stringify(data)); 
                })
                .catch(error => {
                    res.writeHead(500, {"Content-Type": "application/json"});
                    res.end(JSON.stringify({error: "Erreur TMDB"}));
                });
        });
    }

    else if (req.url === "/api/favoris" && req.method === "GET") {
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
        db.all("SELECT * FROM favoris WHERE user_id = ?", [userId], (err, rows) => {
            if (err) {
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur base de données"}))
                return
            }
            res.writeHead(200, {"Content-Type": "application/json"})
            res.end(JSON.stringify(rows))
        })
    })
}
else if (req.url === "/api/favoris" && req.method === "POST") {
    const sessionToken = getSessionTokenFromCookie(req)
    if (!sessionToken) {
        res.writeHead(401, {"Content-Type": "application/json"})
        res.end(JSON.stringify({error: "Session manquante"}))
        return
    }
    let body = ""
    req.on("data", chunk => { body += chunk.toString() })
    req.on("end", () => {
        checkToken(sessionToken, (isValid, userId) => {
            if (!isValid || !userId) {
                res.writeHead(401, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Session invalide"}))
                return
            }

            let parsedBody
            try {
                parsedBody = JSON.parse(body)
            } catch (_error) {
                res.writeHead(400, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "JSON invalide"}))
                return
            }

            const { media_id, media_type, title, poster_path } = parsedBody
            db.run(
                "INSERT OR IGNORE INTO favoris (user_id, media_id, media_type, title, poster_path) VALUES (?, ?, ?, ?, ?)",
                [userId, media_id, media_type, title, poster_path],
                (err) => {
                    if (err) {
                        res.writeHead(500, {"Content-Type": "application/json"})
                        res.end(JSON.stringify({error: "Erreur base de données"}))
                        return
                    }
                    res.writeHead(200, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({success: true}))
                }
            )
        })
    })
}
else if (req.url.startsWith("/api/favoris/") && req.method === "DELETE") {
    const sessionToken = getSessionTokenFromCookie(req)
    if (!sessionToken) {
        res.writeHead(401, {"Content-Type": "application/json"})
        res.end(JSON.stringify({error: "Session manquante"}))
        return
    }

    const mediaId = req.url.replace("/api/favoris/", "")
    if (!/^\d+$/.test(mediaId)) {
        res.writeHead(400, {"Content-Type": "application/json"})
        res.end(JSON.stringify({error: "media_id invalide"}))
        return
    }

    checkToken(sessionToken, (isValid, userId) => {
        if (!isValid || !userId) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify({error: "Session invalide"}))
            return
        }
        db.run(
            "DELETE FROM favoris WHERE user_id = ? AND media_id = ?",
            [userId, mediaId],
            (err) => {
                if (err) {
                    res.writeHead(500, {"Content-Type": "application/json"})
                    res.end(JSON.stringify({error: "Erreur base de données"}))
                    return
                }
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify({success: true}))
            }
        )
    })
}

    else if (req.url.startsWith("/api/page/") && req.method === "GET") {
    const sessionToken = getSessionTokenFromCookie(req)
    const page = req.url.replace("/api/page/", "")

    const publicPages = ["login", "register"]
    const isPublic = publicPages.includes(page)

    const servePartial = () => {
        const templateMap = {
            "acceuil":  "../web/templates/acceuil.html",
            "login":    "../web/templates/login.html",
            "register": "../web/templates/register.html",
            "userinfo": "../web/templates/userinfo.html",
            "detail":   "../web/templates/detail.html",
            "films":    "../web/templates/films.html",
            "series":   "../web/templates/series.html",
            "ma-liste": "../web/templates/ma-liste.html",
        }

        const filePath = templateMap[page]
        if (!filePath) {
            res.writeHead(404, {"Content-Type": "text/plain"})
            res.end("Page introuvable")
            return
        }

        fs.readFile(path.join(__dirname, filePath), "utf8", (err, data) => {
            if (err) {
                serve500(res)
                return
            }

            // Extraire uniquement le contenu du <main>
            const match = data.match(/<main[^>]*>([\s\S]*?)<\/main>/)
            const content = match ? `<main>${match[1]}</main>` : data

            res.writeHead(200, {"Content-Type": "text/html"})
            res.end(content)
        })
    }

    if (isPublic) {
        servePartial()
    } else {
        if (!sessionToken) {
            res.writeHead(401, {"Content-Type": "application/json"})
            res.end(JSON.stringify({error: "Non connecté"}))
            return
        }
        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                clearSessionAndSendUnauthorized(res)
                return
            }
            servePartial()
        })
    }
}

    else {
        serve404(res)
    }
})

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`)
})