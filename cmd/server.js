const http = require('http')
const fs = require('fs')
const path = require("path");
const { randomInt } = require("crypto");
require("dotenv").config()
const db = require("../internal/database")
const { generateToken, checkToken, getSessionTokenFromCookie } = require("../internal/token");
const { hashPassword, verifyPassword } = require('../internal/hashmdp');
const { getMovies, getSeries, getTopRatedMovies, getTopRatedSeries, getMoviesAction, getMoviesFantasy, getSeriesActionAdventure, getSeriesSciFiFantasy, searchmovie, getTrendingAllWeek, getSimilar } = require('../internal/appelAPI')
const { shuffleArray } = require("../internal/arrayUtils")
const { escapeHtml } = require("../internal/htmlUtils")
const { getYoutubeTrailer, getLocalizedDetails } = require("../internal/tmdbUtils")

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
    if (req.url === "/") {
        fs.readFile(path.join(__dirname,"../web/templates/index.html"), (err, data) => {
            res.writeHead(200, {"Content-Type" : "text/html" })
            res.end(data)
        })
    }
    else if (req.url.startsWith("/details")) {
        const sessionToken = getSessionTokenFromCookie(req);
        if (!sessionToken) {
            res.writeHead(302, { "Location": "/login" });
            res.end();
            return;
        }

        checkToken(sessionToken, (isValid) => {
            if (!isValid) {
                res.writeHead(302, { "Location": "/login" });
                res.end();
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
                            ? movie.credits.cast.slice(0, 5)
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
                    res.writeHead(500, { "Content-Type": "text/plain" });
                    res.end("Erreur lors du chargement du film");
                }
            })();
        });
    }
    
    else if (req.method === "GET" && req.url === "/login"){
        fs.readFile(path.join(__dirname, "../web/templates/login.html"), (err,data) => {
            res.writeHead(200, {"Content-Type" :  "text/html"})
            res.end(data)
        })
    }
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
                    res.writeHead(500, {"Content-Type" : "text/plain"})
                    res.end("Erreur lors de la connexion")
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
                    res.writeHead(500, {"Content-Type" : "text/plain"})
                    res.end("Erreur lors de la connexion")
                    return
                }

                if (isPasswordValid) {
                    const token = generateToken()
                    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
                    db.run(`DELETE FROM tokens WHERE user_id = ?`, [row.id], (deleteErr) => {
                        if (deleteErr) {
                            console.error("Erreur lors du nettoyage des anciens tokens :", deleteErr)
                            res.writeHead(500, {"Content-Type" : "text/plain"})
                            res.end("Erreur lors de la creation de session")
                            return
                        }

                        db.run(`INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)`, [row.id, token, expiresAt], (insertErr) => {
                            if (insertErr) {
                                console.error("Erreur lors de la création du token :", insertErr)
                                res.writeHead(500, {"Content-Type" : "text/plain"})
                                res.end("Erreur lors de la creation de session")
                                return
                            }

                            res.writeHead(302, {
                                "Set-Cookie": `session_token=${encodeURIComponent(token)}; Path=/; Max-Age=7200; SameSite=Lax`,
                                "Location": `/acceuil`
                            })
                            res.end()
                        })
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
                res.writeHead(500, {"Content-Type" : "text/plain"})
                res.end("Erreur lors de l'inscription")
                return
            }

            db.registerUser(name, email, username, hashedpassword, (err) => {
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

            const page = randomInt(1, 501)
            Promise.all([
                getMovies(tmdbBearerToken, page),
                getSeries(tmdbBearerToken, page),
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

            const page = randomInt(1, 501)
            getTrendingAllWeek(tmdbBearerToken, page)
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

            const page = randomInt(1, 143)
            Promise.all([
                getTopRatedMovies(tmdbBearerToken, page),
                getTopRatedSeries(tmdbBearerToken, page),
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
            let page = randomInt(1, 500)
            Promise.all([
                getMoviesAction(tmdbBearerToken, page),
                getSeriesActionAdventure(tmdbBearerToken, page),
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
    }else if (req.url === "/discover/movie-fantasy" && req.method === "GET"){
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
            let page = randomInt(1, 500)
            Promise.all([
                getMoviesFantasy(tmdbBearerToken, page),
                getSeriesSciFiFantasy(tmdbBearerToken, page),
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
    else if (req.url === "/logout") {
        res.writeHead(302, {
            "Set-Cookie": `session_token=; Path=/; Max-Age=0; SameSite=Lax`,
            "Location": "/"
        })
        res.end()
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
                res.writeHead(302, {"Location": "/login"})
                res.end()
                return
            }

            fs.readFile(path.join(__dirname,"../web/templates/acceuil.html"), (err, data) => {
                if (err) {
                    res.writeHead(500, {"Content-Type" : "text/plain" })
                    res.end("Erreur lors du chargement de la page d'accueil")
                    return
                }

                res.writeHead(200, {"Content-Type" : "text/html" })
                res.end(data)
            })
        })
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
    else {
        res.writeHead(404, {"Content-Type" : "text/plain"})
        res.end("Page non trouvée")
    }
})

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`)
})