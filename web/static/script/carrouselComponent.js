function initCarouselSwiper(wrapperId, swiperSelector) {
  const totalSlides = document.querySelectorAll(`#${wrapperId} .swiper-slide`).length;
  const canLoop = totalSlides > 3;

  new Swiper(swiperSelector, {
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
        slidesPerView: 5,
      },
    },
  });
}

window.loadCarousel = async function loadCarousel(config) {
  const {
    wrapperId,
    swiperSelector,
    endpoint,
    emptyErrorMessage,
    fetchErrorMessage,
    fallbackMediaType = "movie",
    limit = 40,
  } = config;

  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) {
    return;
  }

  try {
    const response = await fetch(endpoint, { credentials: "same-origin" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || fetchErrorMessage || "Impossible de charger le carrousel");
    }

    const items = Array.isArray(data.results) ? data.results.slice(0, limit) : [];
    if (items.length === 0) {
      throw new Error(emptyErrorMessage || "Aucun contenu recu depuis l'API");
    }

    wrapper.innerHTML = "";

    for (const item of items) {
      const mediaType = item.media_type === "tv" || item.media_type === "movie"
        ? item.media_type
        : fallbackMediaType;
      const titleText = item.title || item.name || "Titre inconnu";

      const slide = document.createElement("button");
      slide.className = "swiper-slide movie-slide-btn";
      slide.type = "button";
      slide.onclick = () => {
        window.location.href = `/details?type=${mediaType}&id=${item.id}`;
      };

      const image = document.createElement("img");
      image.src = item.poster_path
        ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
        : "https://via.placeholder.com/500x750?text=No+Image";
      image.alt = titleText;

      const title = document.createElement("div");
      title.className = "slide-title";
      title.textContent = titleText;

      window.setupHoverPreview?.(slide, item, mediaType);

      slide.appendChild(image);
      slide.appendChild(title);
      wrapper.appendChild(slide);
    }

    initCarouselSwiper(wrapperId, swiperSelector);
  } catch (error) {
    wrapper.innerHTML = `<div class="swiper-slide">${error.message}</div>`;
    initCarouselSwiper(wrapperId, swiperSelector);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const movieId = params.get("id");

  const configs = [
    {
      wrapperId: "trending-mixed-wrapper",
      swiperSelector: ".trending-mixed-swiper",
      endpoint: "/api/trending-mixed",
      fetchErrorMessage: "Impossible de charger les tendances",
      emptyErrorMessage: "Aucun contenu tendance recu depuis l'API",
    },
    {
      wrapperId: "popular-mixed-wrapper",
      swiperSelector: ".popular-mixed-swiper",
      endpoint: "/api/popular-mixed",
      fetchErrorMessage: "Impossible de charger les contenus populaires",
      emptyErrorMessage: "Aucun contenu populaire recu depuis l'API",
    },
    {
      wrapperId: "top-rated-mixed-wrapper",
      swiperSelector: ".top-rated-mixed-swiper",
      endpoint: "/api/top-rated-mixed",
      fetchErrorMessage: "Impossible de charger les contenus mieux notes",
      emptyErrorMessage: "Aucun contenu mieux note recu depuis l'API",
    },
    {
      wrapperId: "movie-action-wrapper",
      swiperSelector: ".genre-action-swiper",
      endpoint: "/discover/movie-action",
      fetchErrorMessage: "Impossible de charger les contenus action",
      emptyErrorMessage: "Aucun contenu action recu depuis l'API",
    },
    {
      wrapperId: "movie-fantasy-wrapper",
      swiperSelector: ".genre-fantasy-swiper",
      endpoint: "/discover/movie-fantasy",
      fetchErrorMessage: "Impossible de charger les contenus fantasy",
      emptyErrorMessage: "Aucun contenu fantasy recu depuis l'API",
    },
  ];

  if (movieId) {
    configs.push({
      wrapperId: "similar-wrapper",
      swiperSelector: ".similar-swiper",
      endpoint: `/api/similar?id=${encodeURIComponent(movieId)}`,
      fetchErrorMessage: "Impossible de charger les contenus similaires",
      emptyErrorMessage: "Aucun contenu similaire recu depuis l'API",
    });
  }

  for (const config of configs) {
    window.loadCarousel?.(config);
  }
});