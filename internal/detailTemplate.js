const { escapeHtml } = require("./htmlUtils")
const { getYoutubeTrailer } = require("./tmdbUtils")
// Fonction pour rendre le template de détails d'un film ou d'une série
function renderMovieDetailsTemplate(data, movie, contentType) {
    //recupere les images 
    const poster = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image"
    //recupere le backdrop ou une image de remplacement
    const backdrop = movie.backdrop_path
        ? `https://image.tmdb.org/t/p/w500${movie.backdrop_path}`
        : "https://via.placeholder.com/500x750?text=No+Image"
    // Calcule la durée formatée pour les films ou le nombre de saisons pour les séries
    const runtimeMinutes = Number.isFinite(movie.runtime)
        ? movie.runtime
        : (Array.isArray(movie.episode_run_time) ? movie.episode_run_time[0] : null)
    // Formate la durée en heures et minutes ou affiche un message si la durée est inconnue
    const formattedRuntime = Number.isFinite(runtimeMinutes) && runtimeMinutes > 0
        ? `${Math.floor(runtimeMinutes / 60)}h ${String(runtimeMinutes % 60).padStart(2, "0")}min`
        : "Durée inconnue"
    // Pour les séries, affiche le nombre de saisons ou un message si ce nombre est inconnu
    const seasonsCount = Number.isFinite(movie.number_of_seasons) ? movie.number_of_seasons : null
    const runtimeLabel = contentType === "tv" ? "Saisons" : "Durée"
    const runtimeValue = contentType === "tv"
        ? (seasonsCount === null ? "Nombre de saisons inconnu" : `${seasonsCount} saison${seasonsCount > 1 ? "s" : ""}`)
        : formattedRuntime
    // Récupère les 14 premiers membres du casting ou affiche un message si le casting est inconnu
    const castMembers = Array.isArray(movie.credits && movie.credits.cast)
        ? movie.credits.cast.slice(0, 14)
        : []
    // Crée un résumé du casting en listant les acteurs et leurs rôles, ou affiche "Casting inconnu" si le casting est vide
    const castSummary = castMembers.length
        ? castMembers
            .map((c) => {
                const cleanRole = typeof c.character === "string"
                    ? c.character.replace(/[()]/g, "").replace(/\s+/g, " ").trim()
                    : ""
                const formattedRole = cleanRole.replace(/\s+voice$/i, " - voice")
                return formattedRole ? `${escapeHtml(c.name)} (${escapeHtml(formattedRole)})` : escapeHtml(c.name)
            })
            .join(", ")
        : "Casting inconnu"
    // Crée les cartes de casting avec les portraits, les noms et les rôles, ou affiche un message si le casting est inconnu
    const castCards = castMembers.length
        ? castMembers
            .map((c) => {
                const actorName = escapeHtml(c.name || "Acteur inconnu")
                const cleanRole = typeof c.character === "string"
                    ? c.character.replace(/[()]/g, "").replace(/\s+/g, " ").trim()
                    : ""
                const formattedRole = cleanRole.replace(/\s+voice$/i, " - voice")
                const roleText = escapeHtml(formattedRole || "Rôle inconnu")
                const portrait = c.profile_path
                    ? `https://image.tmdb.org/t/p/w185${c.profile_path}`
                    : "https://via.placeholder.com/185x278?text=No+Image"

                return `
                    <article class="cast-card">
                        <img src="${portrait}" alt="${actorName}" class="cast-card__image" />
                        <h3 class="cast-card__name">${actorName}</h3>
                        <p class="cast-card__role">${roleText}</p>
                    </article>
                `
            })
            .join("")
        : `<p class="cast-empty">Casting inconnu</p>`
    // Récupère la bande annonce YouTube et crée le bloc de la bande annonce, ou affiche un message si la bande annonce est indisponible
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
        // remplace les placeholders par les donnes recuperees 
    return data
        .replace("{{title}}", movieTitle)
        .replace("{{overview}}", movie.overview || "Aucune description disponible")
        .replace("{{poster}}", poster)
        .replace("{{backdrop_path}}", backdrop)
        .replace("{{vote_average}}", movie.vote_average || "Pas de note moyenne")
        .replace("{{vote_count}}", movie.vote_count || "Pas de nombre de votes")
        .replace("{{genres}}", Array.isArray(movie.genres) ? movie.genres.map((g) => g.name).join(", ") : "Genres inconnus")
        .replace("{{release_date}}", movie.release_date || "Date de sortie inconnue")
        .replace("{{runtime_label}}", runtimeLabel)
        .replace("{{runtime}}", runtimeValue)
        .replace("{{cast}}", castSummary)
        .replace("{{cast_cards}}", castCards)
        .replace("{{trailer_block}}", trailerBlock)
}

module.exports = {
    renderMovieDetailsTemplate,
}
