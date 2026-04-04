function initMoviesSwiper() {
  const totalSlides = document.querySelectorAll("#movies-wrapper .swiper-slide").length;

  new Swiper(".movies-swiper", {
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

async function loadMovies() {
  const wrapper = document.getElementById("movies-wrapper");
  if (!wrapper) {
    return;
  }

  try {
    const response = await fetch("/api/popular-movies", { credentials: "same-origin" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les films");
    }

    const movies = Array.isArray(data.results) ? data.results.slice(0, 40) : [];
    if (movies.length === 0) {
      throw new Error("Aucun film recu depuis l'API");
    }

    wrapper.innerHTML = "";

    for (const movie of movies) {
      const button = document.createElement("button");
      button.className = "swiper-slide movie-slide-btn";
      button.type = "button";
      button.onclick = () => window.location.href = '/details?type=movie&id=' + movie.id;

      const image = document.createElement("img");
      image.src = movie.poster_path
        ? `https://image.tmdb.org/t/p/w500${movie.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image";
      image.alt = movie.title || "Affiche film";

      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = movie.title || "Titre inconnu";

      button.appendChild(image);
      button.appendChild(title);
      wrapper.appendChild(button);
    }

    initMoviesSwiper();
  } catch (error) {
    wrapper.innerHTML = `<div class="swiper-slide">${error.message}</div>`;
    initMoviesSwiper();
  }
}

document.addEventListener("DOMContentLoaded", loadMovies);