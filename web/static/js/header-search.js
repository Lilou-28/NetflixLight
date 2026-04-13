/**
 * header-search.js — Gère les suggestions de recherche du header
 * Écoute les événements nl:search et nl:search:clear
 */

let debounceTimer;
let latestQueryId = 0;

document.addEventListener('nl:search', async (e) => {
  const query = e.detail.query;
  await performSearch(query);
});

document.addEventListener('nl:search:clear', () => {
  hideSuggestions();
});

function hideSuggestions() {
  const suggestionsList = document.getElementById('nl-suggestions-list');
  if (suggestionsList) {
    suggestionsList.innerHTML = '';
    suggestionsList.style.display = 'none';
  }
}

async function performSearch(query) {
  const queryId = ++latestQueryId;

  try {
    const response = await fetch(`/search-movie?query=${encodeURIComponent(query)}`, {
      credentials: 'same-origin',
    });

    if (queryId !== latestQueryId) {
      return;
    }

    const payload = await response.json();
    const items = Array.isArray(payload?.results) ? payload.results : [];

    const suggestionsList = document.getElementById('nl-suggestions-list');
    if (!suggestionsList) return;

    suggestionsList.innerHTML = '';

    for (const item of items) {
      const title = item.title || item.name || 'Titre inconnu';
      const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
      const poster = item.poster_path
        ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
        : 'https://via.placeholder.com/92x138?text=No+Image';

      const suggestion = document.createElement('button');
      suggestion.type = 'button';
      suggestion.className = 'nl-suggestion-item';
      suggestion.innerHTML = `
        <img src="${poster}" alt="${title}" class="nl-suggestion-img">
        <span>${title}</span>
      `;

      suggestion.addEventListener('click', () => {
        window.location.href = `/details?type=${mediaType}&id=${item.id}`;
      });

      suggestionsList.appendChild(suggestion);
    }

    suggestionsList.style.display = items.length ? 'flex' : 'none';
  } catch (err) {
    console.error('Erreur recherche header:', err);
    hideSuggestions();
  }
}
