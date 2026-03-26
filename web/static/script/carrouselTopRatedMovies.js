function initTopRatedMoviesSwiper() {
  const totalSlides = document.querySelectorAll("#top-rated-movies-wrapper .swiper-slide").length;

  new Swiper(".top-rated-movies-swiper", {
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

async function loadTopRatedMovies() {
  const wrapper = document.getElementById("top-rated-movies-wrapper");
  if (!wrapper) {
    return;
  }

  try {
    const response = await fetch("/movie/top_rated", { credentials: "same-origin" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les séries");
    }

    const topRatedMovies = Array.isArray(data.results) ? data.results.slice(0, 40) : [];
    if (topRatedMovies.length === 0) {
      throw new Error("Aucun film top-rated reçu depuis l'API");
    }

    wrapper.innerHTML = "";

    for (const movie of topRatedMovies) {
      const slide = document.createElement("div");
      slide.className = "swiper-slide";

      const image = document.createElement("img");
      image.src = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image";
      image.alt = movie.title || "Affiche film";

      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = movie.title || "Titre inconnu";

      slide.appendChild(image);
      slide.appendChild(title);
      wrapper.appendChild(slide);
    }

    initTopRatedMoviesSwiper();
  } catch (error) {
    wrapper.innerHTML = `<div class="swiper-slide">${error.message}</div>`;
    initTopRatedMoviesSwiper();
  }
}

document.addEventListener("DOMContentLoaded", loadTopRatedMovies);