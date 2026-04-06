function buildTmdbRequest(pathname, credential, params = {}) {
    const token = (credential || "").trim();

    const baseUrl = `https://api.themoviedb.org/3/${pathname}`;

    const searchParams = new URLSearchParams({
        language: 'fr-FR',
        ...params
    });

    const isV3ApiKey = /^[a-f0-9]{32}$/i.test(token);

    if (isV3ApiKey) {
        searchParams.append('api_key', token);
        return {
            url: `${baseUrl}?${searchParams.toString()}`,
            options: {},
        };
    }

    return {
        url: `${baseUrl}?${searchParams.toString()}`,
        options: {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
        },
    };
}

async function fetchTmdbJson(pathname, credential, params = {}) {
    const request = buildTmdbRequest(pathname, credential, params)
    const response = await fetch(request.url, request.options)

    if (!response.ok) {
        throw new Error(`TMDB HTTP ${response.status}`)
    }

    return response.json()
}



async function getMovies(credential, page = 1) {
    return fetchTmdbJson("movie/popular", credential, { page })
}

async function getSeries(credential, page = 1) {
    return fetchTmdbJson("tv/popular", credential, { page })
}

async function getTopRatedMovies(credential, page = 1) {
    return fetchTmdbJson("movie/top_rated", credential, { page })
}

async function getTopRatedSeries(credential, page = 1) {
    return fetchTmdbJson("tv/top_rated", credential, { page })
}

async function getMoviesAction(credential, page = 1) {
    return fetchTmdbJson("discover/movie", credential, { page: page, with_genres: 28 })
}

async function getMoviesFantasy(credential, page = 1) {
    return fetchTmdbJson("discover/movie", credential, { page: page, with_genres: 14 })
}

async function getSeriesActionAdventure(credential, page = 1) {
    return fetchTmdbJson("discover/tv", credential, { page: page, with_genres: 10759 })
}

async function getSeriesSciFiFantasy(credential, page = 1) {
    return fetchTmdbJson("discover/tv", credential, { page: page, with_genres: 10765 })
}

async function searchmovie(credential, page = 1, query) {
    return fetchTmdbJson("search/movie", credential, {page : page, query : query})
}

async function getMovieDetails(credential, movieId, language = "fr-FR") {
    return fetchTmdbJson(`movie/${movieId}`, credential, { append_to_response: "credits", language })
}

async function getTvDetails(credential, tvId, language = "fr-FR") {
    return fetchTmdbJson(`tv/${tvId}`, credential, { append_to_response: "credits", language })
}

async function getTrendingAllWeek(credential, page = 1, language = "fr-FR") {
    return fetchTmdbJson("trending/all/week", credential, { language, page })
}

async function getSimilar(credential, MovieId, page = 1, language = "fr-FR") {
    return fetchTmdbJson(`movie/${MovieId}/similar`, credential, { language, page })
}

module.exports = {
    getMovies,
    getSeries,
    getTopRatedMovies,
    getTopRatedSeries,
    getMoviesAction,
    getMoviesFantasy,
    getSeriesActionAdventure,
    getSeriesSciFiFantasy,
    searchmovie,
    getMovieDetails,
    getTvDetails,
    getTrendingAllWeek,
    getSimilar,
}