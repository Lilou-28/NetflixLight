const http = require('http')
const fs = require('fs')
const path = require("path");
const { randomInt } = require("crypto");
require("dotenv").config()
const db = require("../internal/database")
const { generateToken, checkToken, getSessionTokenFromCookie } = require("../internal/token");
const { hashPassword, verifyPassword } = require('../internal/hashmdp');
const { getMovies, getSeries, getTopRatedMovies, getTopRatedSeries, getMoviesAction, getMoviesFantasy, searchmovie, getMovieDetails, getTvDetails } = require('../internal/appelAPI')

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
                    let movie = contentType === "tv"
                        ? await getTvDetails(tmdbBearerToken, movieId)
                        : await getMovieDetails(tmdbBearerToken, movieId)

                    // Some TMDB entries have an empty French overview; fallback to English.
                    if (!movie.overview || !movie.overview.trim()) {
                        const fallbackMovie = contentType === "tv"
                            ? await getTvDetails(tmdbBearerToken, movieId, "en-US")
                            : await getMovieDetails(tmdbBearerToken, movieId, "en-US");

                        if (fallbackMovie.overview && fallbackMovie.overview.trim()) {
                            movie = { ...movie, overview: fallbackMovie.overview };
                        }
                    }

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

                        const html = data
                            .replace("{{title}}", movie.title || movie.original_name || "Titre inconnu")
                            .replace("{{overview}}", movie.overview || "Aucune description disponible")
                            .replace("{{poster}}", poster)
                            .replace("{{backdrop_path}}", backdrop)
                            .replace("{{vote_average}}", movie.vote_average || "Pas de note moyenne")
                            .replace("{{vote_count}}", movie.vote_count || "Pas de nombre de votes")
                            .replace("{{genres}}", Array.isArray(movie.genres) ? movie.genres.map(g => g.name).join(", ") : "Genres inconnus")
                            .replace("{{release_date}}", movie.release_date || "Date de sortie inconnue")
                            .replace("{{runtime_label}}", runtimeLabel)
                            .replace("{{runtime}}", runtimeValue)
                            .replace("{{cast}}", Array.isArray(movie.credits && movie.credits.cast)
                                ? movie.credits.cast
                                    .slice(0, 5)
                                    .map(c => {
                                        const cleanRole = typeof c.character === "string"
                                            ? c.character.replace(/[()]/g, "").replace(/\s+/g, " ").trim()
                                            : "";
                                        const formattedRole = cleanRole.replace(/\s+voice$/i, " - voice");
                                        return formattedRole ? `${c.name} (${formattedRole})` : c.name;
                                    })
                                    .join(", ")
                                : "Casting inconnu");
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
                    db.run(`INSERT INTO tokens (user_id, token, expires_at) VALUES (?, ?, ?)`, [row.id, token, expiresAt], (err) => {
                        if (err) {
                            console.error("Erreur lors de la création du token :", err)
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
            let page = randomInt(1, 501)
            getMovies(tmdbBearerToken, page)
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des films populaires"}))
            })
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
            let page = randomInt(1, 501)
            getSeries(tmdbBearerToken, page)
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des séries populaires"}))
            })
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
            let page = randomInt(1, 501)
            getMovies(tmdbBearerToken, page)
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des films populaires"}))
            })
        })
    }
    else if (req.url === "/movie/top_rated" && req.method === "GET") {
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
            let page = randomInt(1, 501)
            getTopRatedMovies(tmdbBearerToken, page)
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des films les mieux notés"}))
            })
        })
    }
    else if (req.url === "/tv/top_rated" && req.method === "GET") {
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
            let page = randomInt(1, 143)
            getTopRatedSeries(tmdbBearerToken, page)
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des séries les mieux notées"}))
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
            getMoviesAction(tmdbBearerToken, page)
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des films d'actions"}))
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
            getMoviesFantasy(tmdbBearerToken, page)
            .then(data => {
                res.writeHead(200, {"Content-Type": "application/json"})
                res.end(JSON.stringify(data))
            })
            .catch(error => {
                console.error("Erreur TMDB:", error.message)
                res.writeHead(500, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Erreur lors de la récupération des films d'actions"}))
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
        fs.readFile(path.join(__dirname,"../web/templates/acceuil.html"), (err, data) => {
            res.writeHead(200, {"Content-Type" : "text/html" })
            res.end(data)
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
                res.writeHead(500, {"Content-Type": "text/plain"})
                res.end("Erreur serveur")
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
                res.writeHead(401, {"Content-Type": "application/json"})
                res.end(JSON.stringify({error: "Session invalide"}))
                return
            }
            servePartial()
        })
    }
}

    else {
        res.writeHead(404, {"Content-Type" : "text/plain"})
        res.end("Page non trouvée")
    }
})

server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`)
})