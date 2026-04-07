const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const suggestionsList = document.getElementById("suggestions-list");

let debounceTimer;

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 3) {
    suggestionsList.innerHTML = "";
    suggestionsList.style.display = "none";
    return;
  }

  debounceTimer = setTimeout(() => {
    performSearch(query);
  }, 300);
});

async function performSearch(query) {
  try {
    const response = await fetch(`/search-movie?query=${encodeURIComponent(query)}`, {
      credentials: "same-origin",
    });

    const payload = await response.json();
    const items = Array.isArray(payload?.results) ? payload.results : [];

    suggestionsList.innerHTML = "";

    for (const item of items) {
      const title = item.title || item.name || "Titre inconnu";
      const mediaType = item.media_type === "tv" ? "tv" : "movie";
      const poster = item.poster_path
        ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
        : "https://via.placeholder.com/92x138?text=No+Image";

      const suggestion = document.createElement("button");
      suggestion.type = "button";
      suggestion.className = "suggestion-item";
      suggestion.innerHTML = `
        <img src="${poster}" alt="${title}" class="suggestion-img">
        <span>${title}</span>
      `;

      suggestion.addEventListener("click", () => {
        window.location.href = `/details?type=${mediaType}&id=${item.id}`;
      });

      suggestionsList.appendChild(suggestion);
    }

    suggestionsList.style.display = items.length ? "block" : "none";
  } catch (err) {
    console.error("Erreur recherche:", err);
    suggestionsList.innerHTML = "";
    suggestionsList.style.display = "none";
  }
}