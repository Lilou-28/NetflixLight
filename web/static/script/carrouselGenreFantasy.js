function initGenreFantasySwiper() {
  const totalSlides = document.querySelectorAll("#movie-fantasy-wrapper .swiper-slide").length;

  new Swiper(".genre-fantasy-swiper", {
    loop: totalSlides > 1,
    slidesPerView: 1.2,
    spaceBetween: 12,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false,
    },
    breakpoints: {
      700: {
        slidesPerView: 2.2,
      },
      1024: {
        slidesPerView: 3,
      },
    },
  });
}

async function loadMovieFantasy() {
  const wrapper = document.getElementById("movie-fantasy-wrapper");
  if (!wrapper) {
    return;
  }

  try {
    const response = await fetch("/discover/movie-fantasy", { credentials: "same-origin" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les films");
    }

    const MoviesFantasy = Array.isArray(data.results) ? data.results.slice(0, 40) : [];
    if (MoviesFantasy.length === 0) {
      throw new Error("Aucun film de comedie reçue depuis l'API");
    }

    wrapper.innerHTML = "";

    for (const movie of MoviesFantasy) {
      const slide = document.createElement("div");
      slide.className = "swiper-slide";

      const image = document.createElement("img");
      image.src = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image";
      image.alt = movie.name || "Affiche série";

      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = movie.title || movie.name || "Titre inconnu";

      slide.appendChild(image);
      wrapper.appendChild(slide);
      slide.appendChild(title);
    }

    initGenreFantasySwiper();
  } catch (error) {
    wrapper.innerHTML = `<div class="swiper-slide">${error.message}</div>`;
    initGenreFantasySwiper();
  }
}

document.addEventListener("DOMContentLoaded", loadMovieFantasy);