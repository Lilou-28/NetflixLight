function initSeriesSwiper() {
  const totalSlides = document.querySelectorAll("#series-wrapper .swiper-slide").length;
  const canLoop = totalSlides > 3;

  new Swiper(".series-swiper", {
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

async function loadSeries() {
  const wrapper = document.getElementById("series-wrapper");
  if (!wrapper) {
    return;
  }

  try {
    const response = await fetch("/api/popular-series", { credentials: "same-origin" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Impossible de charger les séries");
    }

    const series = Array.isArray(data.results) ? data.results.slice(0, 40) : [];
    if (series.length === 0) {
      throw new Error("Aucune série reçue depuis l'API");
    }

    wrapper.innerHTML = "";

    for (const serie of series) {
      const slide = document.createElement("button");
      slide.className = "swiper-slide movie-slide-btn";
      slide.type = "button";
      slide.onclick = () => window.location.href = '/details?type=tv&id=' + serie.id;

      const image = document.createElement("img");
      image.src = serie.poster_path
        ? `https://image.tmdb.org/t/p/w500${serie.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image";
      image.alt = serie.name || "Affiche série";

      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = serie.name || "Titre inconnu";

      slide.appendChild(image);
      slide.appendChild(title);
      wrapper.appendChild(slide);
    }

    initSeriesSwiper();
  } catch (error) {
    wrapper.innerHTML = `<div class="swiper-slide">${error.message}</div>`;
    initSeriesSwiper();
  }
}

document.addEventListener("DOMContentLoaded", loadSeries);