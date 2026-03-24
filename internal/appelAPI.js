function buildTmdbRequest(pathname, credential, page = 1) {
    const token = (credential || "").trim()
    if (!token) {
        throw new Error("TMDB_BEARER_TOKEN manquant")
    }

    const isV3ApiKey = /^[a-f0-9]{32}$/i.test(token)
    if (isV3ApiKey) {
        return {
            url: `https://api.themoviedb.org/3/${pathname}?api_key=${encodeURIComponent(token)}&language=fr-FR&page=${page}`,
            options: {},
        }
    }

    return {
        url: `https://api.themoviedb.org/3/${pathname}?language=fr-FR&page=${page}`,
        options: {
            headers: {
                Authorization: `Bearer ${token}`,
            },
        },
    }
}

async function fetchTmdbJson(pathname, credential, page = 1) {
    const request = buildTmdbRequest(pathname, credential, page)
    const response = await fetch(request.url, request.options)

    if (!response.ok) {
        throw new Error(`TMDB HTTP ${response.status}`)
    }

    return response.json()
}

async function getMovies(credential, page = 1) {
    return fetchTmdbJson("movie/popular", credential, page)
}

async function getSeries(credential, page = 1) {
    return fetchTmdbJson("tv/popular", credential, page)
}

async function getTopRatedMovies(credential, page = 1) {
    return fetchTmdbJson("movie/top_rated", credential, page)
}

async function getTopRatedSeries(credential, page = 1) {
    return fetchTmdbJson("tv/top_rated", credential, page)
}

module.exports = {
    getMovies,
    getSeries,
    getTopRatedMovies,
    getTopRatedSeries,
}