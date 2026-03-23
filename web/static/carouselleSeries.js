function initSeriesSwiper() {
  const totalSlides = document.querySelectorAll("#series-wrapper .swiper-slide").length;

  new Swiper(".series-swiper", {
    loop: totalSlides > 1,
    slidesPerView: 1.2,
    spaceBetween: 12,
    pagination: {
      el: ".series-pagination",
      clickable: true,
    },
    navigation: {
      nextEl: ".series-next",
      prevEl: ".series-prev",
    },
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

    const series = Array.isArray(data.results) ? data.results.slice(0, 20) : [];
    if (series.length === 0) {
      throw new Error("Aucune série reçue depuis l'API");
    }

    wrapper.innerHTML = "";

    for (const serie of series) {
      const slide = document.createElement("div");
      slide.className = "swiper-slide";

      const image = document.createElement("img");
      image.src = serie.poster_path
        ? `https://image.tmdb.org/t/p/w500${serie.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image";
      image.alt = serie.name || "Affiche série";

      slide.appendChild(image);
      wrapper.appendChild(slide);
    }

    initSeriesSwiper();
  } catch (error) {
    wrapper.innerHTML = `<div class="swiper-slide">${error.message}</div>`;
    initSeriesSwiper();
  }
}

document.addEventListener("DOMContentLoaded", loadSeries);