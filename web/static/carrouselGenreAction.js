function initGenreActionSwiper() {
  const totalSlides = document.querySelectorAll("#genre-action-wrapper .swiper-slide").length;

  new Swiper(".genre-action-swiper", {
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

async function loadTopRatedSeries() {
  const wrapper = document.getElementById("top-rated-series-wrapper");
  if (!wrapper) {
    return;
  }

  try {
    const response = await fetch("/tv/top_rated", { credentials: "same-origin" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les séries");
    }

    const topRatedSeries = Array.isArray(data.results) ? data.results.slice(0, 40) : [];
    if (topRatedSeries.length === 0) {
      throw new Error("Aucune série top-rated reçue depuis l'API");
    }

    wrapper.innerHTML = "";

    for (const series of topRatedSeries) {
      const slide = document.createElement("div");
      slide.className = "swiper-slide";

      const image = document.createElement("img");
      image.src = series.poster_path
        ? `https://image.tmdb.org/t/p/w500${series.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image";
      image.alt = series.name || "Affiche série";

      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = series.name || "Titre inconnu";

      slide.appendChild(image);
      wrapper.appendChild(slide);
      title.appendChild(image);
      slide.appendChild(title);
    }

    initTopRatedSeriesSwiper();
  } catch (error) {
    wrapper.innerHTML = `<div class="swiper-slide">${error.message}</div>`;
    initTopRatedSeriesSwiper();
  }
}

document.addEventListener("DOMContentLoaded", loadTopRatedSeries);