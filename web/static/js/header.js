/**
 * header.js — Composant Header Global NetflixLight
 * Appeler initHeader() au chargement du DOM.
 * Nécessite Tailwind CSS chargé dans la page.
 */

export function initHeader() {
  const header = document.getElementById("main-header");
  if (!header) return;

  _renderHeader(header);
  _bindScrollBehavior(header);
  _bindSearchBehavior(header);
  _bindDropdown(header);
  _bindNavHighlight(header);
}

/*
   RENDER
 */

function _renderHeader(header) {
  header.innerHTML = `
    <div class="nl-header__inner">
      <!-- Logo -->
      <a href="/acceuil" class="nl-logo">NETFLIXLIGHT</a>

      <!-- Navigation principale -->
      <nav class="nl-nav" aria-label="Navigation principale">
        <a href="/acceuil" class="nl-nav__link" data-route="home">Accueil</a>
        <a href="/series" class="nl-nav__link" data-route="series">Séries</a>
        <a href="/films" class="nl-nav__link" data-route="films">Films</a>
        <a href="/ma-liste" class="nl-nav__link nl-nav__link--auth" data-route="watchlist">Ma liste</a>
      </nav>

      <!-- Zone droite : recherche + profil -->
      <div class="nl-header__right">
       <!-- Recherche -->
      <div class="nl-search" id="nl-search" role="search">
        <div class="nl-search__box" id="nl-search-box">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            id="nl-search-input"
            class="nl-search__input"
            placeholder="Titres, personnes, genres…"
            autocomplete="off"
            aria-label="Rechercher"
          />
        </div>
        <div id="nl-suggestions-list" class="nl-suggestions-list"></div>
      </div>

        <!-- Profil (affiché si connecté) -->
        <div class="nl-profile" id="nl-profile" hidden>
          <button class="nl-profile__toggle" id="nl-profile-toggle" aria-haspopup="true" aria-expanded="false" aria-label="Menu profil">
            <div class="nl-avatar" id="nl-avatar">M</div>
            <svg class="nl-profile__caret" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 10l5 5 5-5z"/>
            </svg>
          </button>
          <div class="nl-dropdown" id="nl-dropdown" hidden role="menu">
             <a href="/userinfo" class="nl-dropdown__item" role="menuitem">Mon profil</a>
            <button class="nl-dropdown__item nl-dropdown__item--danger" id="nl-logout-btn" role="menuitem">Déconnexion</button>
          </div>
        </div>

        <!-- Boutons auth (affiché si déconnecté) -->
        <div class="nl-auth-btns" id="nl-auth-btns">
          <a href="/login" class="nl-btn nl-btn--ghost">Connexion</a>
          <a href="/register" class="nl-btn nl-btn--primary">S'inscrire</a>
    </div>
  </div>
  `;
}

/*
   COMPORTEMENT SCROLL : transparent → plein
 */

function _bindScrollBehavior(header) {
  const onScroll = () => {
    if (window.scrollY > 20) {
      header.classList.add("nl-header--scrolled");
    } else {
      header.classList.remove("nl-header--scrolled");
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll(); // état initial
}

/*
   RECHERCHE avec debounce 300ms et suggestions
 */

let searchLatestQueryId = 0;

function _bindSearchBehavior(header) {
  const input = header.querySelector("#nl-search-input");
  const searchBox = header.querySelector("#nl-search-box");
  console.log("Binding search behavior", { inputFound: !!input, searchBoxFound: !!searchBox });
  if (!input || !searchBox) return;

  let debounceTimer = null;

  // Créer le conteneur de suggestions s'il n'existe pas
  let suggestionsList = header.querySelector("#nl-suggestions-list");
  console.log("Found suggestions list:", !!suggestionsList);
  if (!suggestionsList) {
    suggestionsList = document.createElement("div");
    suggestionsList.id = "nl-suggestions-list";
    suggestionsList.className = "nl-suggestions-list";
    searchBox.parentElement.appendChild(suggestionsList);
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.value = "";
      suggestionsList.innerHTML = "";
      suggestionsList.style.display = "none";
    }
  });

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    console.log("Search input:", query);

    debounceTimer = setTimeout(() => {
      if (query.length < 2) {
        console.log("Query too short");
        suggestionsList.innerHTML = "";
        suggestionsList.style.display = "none";
        return;
      }
      console.log("Performing search for:", query);
      _performHeaderSearch(query, suggestionsList);
    }, 300);
  });

  // Fermer les suggestions en cliquant ailleurs
  document.addEventListener("click", (e) => {
    if (!header.contains(e.target) && !suggestionsList.contains(e.target)) {
      suggestionsList.style.display = "none";
    }
  });
}

async function _performHeaderSearch(query, suggestionsList) {
  const queryId = ++searchLatestQueryId;
  console.log("Starting search", { query, queryId });

  try {
    const response = await fetch(`/search-movie?query=${encodeURIComponent(query)}`, {
      credentials: "same-origin",
    });

    console.log("Response status:", response.status);

    if (queryId !== searchLatestQueryId) {
      console.log("Query outdated, skipping");
      return;
    }

    const payload = await response.json();
    console.log("Search results:", payload);
    
    const items = Array.isArray(payload?.results) ? payload.results : [];
    console.log("Items count:", items.length);

    suggestionsList.innerHTML = "";

    for (const item of items) {
      const title = item.title || item.name || "Titre inconnu";
      const mediaType = item.media_type === "tv" ? "tv" : "movie";
      const poster = item.poster_path
        ? `https://image.tmdb.org/t/p/w185${item.poster_path}`
        : "https://via.placeholder.com/92x138?text=No+Image";

      const suggestion = document.createElement("button");
      suggestion.type = "button";
      suggestion.className = "nl-suggestion-item";
      suggestion.innerHTML = `
        <img src="${poster}" alt="${title}" class="nl-suggestion-img">
        <span>${title}</span>
      `;

      suggestion.addEventListener("click", () => {
        window.location.href = `/details?type=${mediaType}&id=${item.id}`;
      });

      suggestionsList.appendChild(suggestion);
    }

    const displayStyle = items.length ? "flex" : "none";
    console.log("Setting display style:", displayStyle);
    suggestionsList.style.display = displayStyle;
  } catch (err) {
    console.error("Erreur recherche header:", err);
    suggestionsList.innerHTML = "";
    suggestionsList.style.display = "none";
  }
}

/*
   DROPDOWN PROFIL
 */

function _bindDropdown(header) {
  const toggle = header.querySelector("#nl-profile-toggle");
  const dropdown = header.querySelector("#nl-dropdown");
  const logoutBtn = header.querySelector("#nl-logout-btn");

  if (!toggle || !dropdown) return;

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !dropdown.hidden;
    dropdown.hidden = isOpen;
    toggle.setAttribute("aria-expanded", String(!isOpen));
  });

  // Fermer en cliquant ailleurs
  document.addEventListener("click", () => {
    dropdown.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  });

  dropdown.addEventListener("click", (e) => e.stopPropagation());

  // Déconnexion
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      document.dispatchEvent(new CustomEvent("nl:auth:logout"));
    });
  }
}

/*
   LIEN ACTIF selon la route courante
*/

function _bindNavHighlight(header) {
  const updateActive = () => {
    const hash = window.location.hash || "#/";
    const links = header.querySelectorAll(".nl-nav__link[data-route]");
    links.forEach((link) => {
      const route = link.getAttribute("data-route");
      const isActive = hash.includes(
        link.getAttribute("href").replace("#", ""),
      );
      link.classList.toggle("nl-nav__link--active", isActive);
      link.setAttribute("aria-current", isActive ? "page" : "false");
    });
  };

  window.addEventListener("hashchange", updateActive);
  updateActive();
}

/*
   API PUBLIQUE — gestion auth
 */

/**
 * Met à jour le header selon l'état d'authentification.
 * @param {{ isLoggedIn: boolean, username?: string }} state
 */
export function updateHeaderAuth({ isLoggedIn, username = "M" }) {
  const profile = document.getElementById("nl-profile");
  const authBtns = document.getElementById("nl-auth-btns");
  const avatar = document.getElementById("nl-avatar");
  const authLinks = document.querySelectorAll(".nl-nav__link--auth");

  if (!profile || !authBtns) return;

  if (isLoggedIn) {
    profile.hidden = false;
    authBtns.hidden = true;
    authLinks.forEach((l) => (l.style.display = ""));
    if (avatar) avatar.textContent = username.charAt(0).toUpperCase();
  } else {
    profile.hidden = true;
    authBtns.hidden = false;
    authLinks.forEach((l) => (l.style.display = "none"));
  }
}
