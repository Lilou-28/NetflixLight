function deleteCookie(name) {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;   
}

document.getElementById("logout-btn").addEventListener("click", () => {
    deleteCookie("session_token");
    window.location.href = "/";
});

function initMoviesSwiper() {
  new Swiper(".movies-swiper", {
    slidesPerView: 1.2,
    spaceBetween: 10,
    navigation: {
      nextEl: ".movies-next",
        prevEl: ".movies-prev",
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