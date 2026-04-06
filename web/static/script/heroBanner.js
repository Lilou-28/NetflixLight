const heroBanner = document.getElementById("hero-banner");
const heroTitle = document.getElementById("hero-title");
const heroOverview = document.getElementById("hero-overview");
const heroDetailsBtn = document.getElementById("hero-details-btn");

let heroMovieId = null;
let heroMediaType = "movie";

const FALLBACK_BACKDROP =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="100%" height="100%" fill="#111"/><text x="50%" y="50%" fill="#e5e5e5" font-size="38" font-family="Arial" text-anchor="middle" dominant-baseline="middle">NetflixLight</text></svg>'
  );

function pickMovie(results) {
  const withBackdrop = results.filter((movie) => movie && movie.backdrop_path && movie.id);
  if (withBackdrop.length) return withBackdrop[0];
  return results.find((movie) => movie && movie.id) || null;
}

async function getHeroMovie() {
  try {
    const response = await fetch("/api/trending-mixed", { credentials: "same-origin" });
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    if (!results.length) {
      return null;
    }
    return pickMovie(results);
  } catch (_err) {
    return null;
  }
}

function renderHero(movie) {
  if (!heroBanner || !heroTitle || !heroOverview || !heroDetailsBtn) return;

  if (!movie) {
    heroTitle.textContent = "Aucun film disponible";
    heroOverview.textContent = "Impossible de charger un film mis en avant pour le moment.";
    heroBanner.style.backgroundImage = `url(${FALLBACK_BACKDROP})`;
    heroDetailsBtn.disabled = true;
    return;
  }

  const title = movie.title || movie.original_title || "Titre inconnu";
  const overview = movie.overview || "Pas de description disponible.";

  heroMovieId = movie.id;
  heroMediaType = movie.media_type === "tv" ? "tv" : "movie";
  heroTitle.textContent = title;
  heroOverview.textContent = overview;

  if (movie.backdrop_path) {
    heroBanner.style.backgroundImage = `url(https://image.tmdb.org/t/p/original${movie.backdrop_path})`;
  } else {
    heroBanner.style.backgroundImage = `url(${FALLBACK_BACKDROP})`;
  }
}

async function loadHeroBanner() {
  const movie = await getHeroMovie();
  renderHero(movie);
}

if (heroDetailsBtn) {
  heroDetailsBtn.addEventListener("click", () => {
    if (!heroMovieId) return;
    window.location.href = `/details?type=${heroMediaType}&id=${heroMovieId}`;
  });
}

document.addEventListener("DOMContentLoaded", loadHeroBanner);
