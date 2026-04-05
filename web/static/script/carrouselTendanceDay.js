function initTrendingDaySwiper() {
  const totalSlides = document.querySelectorAll("#trending-day-wrapper .swiper-slide").length;
  const canLoop = totalSlides > 3;

  new Swiper(".trending-day-swiper", {
    loop: canLoop,
    slidesPerView: 1.2,
    spaceBetween: 12,
    watchOverflow: true,
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

async function loadTrendingDayMovies() {
  const wrapper = document.getElementById("trending-day-wrapper");
    if (!wrapper) {
    return;
  } 

    try {
    const response = await fetch("/trending/day", { credentials: "same-origin" });
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
    } catch (error) {
    console.error("Erreur lors du chargement des films :", error);
    wrapper.innerHTML = "<p>Impossible de charger les films pour le moment.</p>";
    }

    initTrendingDaySwiper();
}

  document.addEventListener("DOMContentLoaded", loadTrendingDayMovies);
