const { randomInt } = require("crypto")
const { getMovieDetails, getTvDetails, getPersonDetails } = require("./appelAPI")
// recupere le nombre de page total pour prendre une page aleatoire 
async function getRandomCarouselPage(fetchPage, credential, maxPage = 500) {
    const firstPage = await fetchPage(credential, 1)
    const totalPages = Number.isFinite(firstPage.total_pages) ? firstPage.total_pages : 1
    const safeMaxPage = Math.max(1, Math.min(maxPage, totalPages))

    if (safeMaxPage === 1) {
        return firstPage
    }

    const page = randomInt(1, safeMaxPage + 1)
    if (page === 1) {
        return firstPage
    }

    try {
        const selectedPage = await fetchPage(credential, page)
        if (Array.isArray(selectedPage.results) && selectedPage.results.length > 0) {
            return selectedPage
        }
    } catch (_error) {
        return firstPage
    }

    return firstPage
}
// Fonction générique pour faire une requête à l'API TMDB et retourner le JSON, avec gestion des erreurs HTTP
function getYoutubeTrailer(videos) {
    const videoResults = Array.isArray(videos && videos.results) ? videos.results : []
    const youtubeVideos = videoResults.filter((video) =>
        video
        && video.site === "YouTube"
        && typeof video.key === "string"
        && video.key.trim()
    )

    if (!youtubeVideos.length) return null

    const officialTrailer = youtubeVideos.find((video) => video.type === "Trailer" && video.official)
    if (officialTrailer) return officialTrailer

    const trailer = youtubeVideos.find((video) => video.type === "Trailer")
    if (trailer) return trailer

    const teaser = youtubeVideos.find((video) => video.type === "Teaser")
    if (teaser) return teaser

    return youtubeVideos[0]
}
// Normalise une langue donnée en format "xx-XX", avec des règles spécifiques pour les cas courants et un fallback par défaut.
function normalizeLanguage(language) {
    if (!language || typeof language !== "string") return "fr-FR"

    const trimmed = language.trim()
    if (!trimmed) return "fr-FR"

    if (trimmed.includes("-")) {
        const [lang, region] = trimmed.split("-")
        if (!lang) return "fr-FR"
        return `${lang.toLowerCase()}-${(region || lang).toUpperCase()}`
    }

    return `${trimmed.toLowerCase()}-${trimmed.toUpperCase()}`
}

function hasText(value) {
    return typeof value === "string" && value.trim().length > 0
}

function hasResults(list) {
    return Array.isArray(list) && list.length > 0
}
//fusionne les details de plusieur langues pour max d'infos sur un film ou une serie
function mergeLocalizedDetails(base, candidate) {
    const merged = { ...base }

    if (hasText(candidate && candidate.overview) && !hasText(merged.overview)) merged.overview = candidate.overview
    if (hasText(candidate && candidate.tagline) && !hasText(merged.tagline)) merged.tagline = candidate.tagline
    if (hasText(candidate && candidate.homepage) && !hasText(merged.homepage)) merged.homepage = candidate.homepage
    if (hasText(candidate && candidate.release_date) && !hasText(merged.release_date)) merged.release_date = candidate.release_date
    if (hasText(candidate && candidate.first_air_date) && !hasText(merged.first_air_date)) merged.first_air_date = candidate.first_air_date

    if (!Number.isFinite(merged.runtime) && Number.isFinite(candidate && candidate.runtime)) {
        merged.runtime = candidate.runtime
    }

    if ((!Array.isArray(merged.episode_run_time) || !merged.episode_run_time.length)
        && Array.isArray(candidate && candidate.episode_run_time)
        && candidate.episode_run_time.length) {
        merged.episode_run_time = candidate.episode_run_time
    }

    if (!Number.isFinite(merged.number_of_seasons) && Number.isFinite(candidate && candidate.number_of_seasons)) {
        merged.number_of_seasons = candidate.number_of_seasons
    }

    if (!Array.isArray(merged.genres) || !merged.genres.length) {
        merged.genres = Array.isArray(candidate && candidate.genres) ? candidate.genres : merged.genres
    }

    if (hasText(candidate && candidate.biography) && !hasText(merged.biography)) merged.biography = candidate.biography
    if (hasText(candidate && candidate.birthday) && !hasText(merged.birthday)) merged.birthday = candidate.birthday
    if (hasText(candidate && candidate.place_of_birth) && !hasText(merged.place_of_birth)) merged.place_of_birth = candidate.place_of_birth

    const mergedVideos = merged.videos && merged.videos.results
    const candidateVideos = candidate && candidate.videos && candidate.videos.results
    if (!hasResults(mergedVideos) && hasResults(candidateVideos)) {
        merged.videos = { ...(merged.videos || {}), results: candidateVideos }
    }

    const mergedCast = merged.credits && merged.credits.cast
    const candidateCast = candidate && candidate.credits && candidate.credits.cast
    if (!hasResults(mergedCast) && hasResults(candidateCast)) {
        merged.credits = { ...(merged.credits || {}), cast: candidateCast }
    }

    return merged
}

async function getLocalizedDetails(contentType, id, credential, preferredLanguage = "fr-FR") {
    const loader = contentType === "tv"
        ? (language) => getTvDetails(credential, id, language)
        : contentType === "person"
            ? (language) => getPersonDetails(credential, id, language)
            : (language) => getMovieDetails(credential, id, language)

    const languagesTried = []
    const languageSet = new Set() //collection de valeur unique

    const primaryLanguage = normalizeLanguage(preferredLanguage)
    languageSet.add(primaryLanguage)

    let details = await loader(primaryLanguage)
    languagesTried.push(primaryLanguage)

    const originalLanguage = normalizeLanguage(details.original_language)
 
    languageSet.add("en-US")
    languageSet.add(originalLanguage)
    // on regarde les details des langues du tableau
    for (const language of languageSet) {
        if (languagesTried.includes(language)) continue

        try {
            const localized = await loader(language)
            details = mergeLocalizedDetails(details, localized)
            languagesTried.push(language)
        } catch (_error) {
            languagesTried.push(language)
        }
    }

    details._resolved_languages = languagesTried
    return details
}

module.exports = {
    getYoutubeTrailer,
    getLocalizedDetails,
    getRandomCarouselPage,
}
