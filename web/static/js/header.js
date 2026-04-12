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
        <a href="/tendances" class="nl-nav__link" data-route="tendances">Tendances</a>
        <a href="/ma-liste" class="nl-nav__link nl-nav__link--auth" data-route="watchlist">Ma liste</a>
      </nav>

      <!-- Zone droite : recherche + profil -->
      <div class="nl-header__right">
        <!-- Recherche -->
        <div class="nl-search" id="nl-search" role="search">
          <button class="nl-search__toggle" id="nl-search-toggle" aria-label="Ouvrir la recherche" aria-expanded="false">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <div class="nl-search__box" id="nl-search-box" hidden>
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
            <a href="#/profil" class="nl-dropdown__item" data-link role="menuitem">Mon profil</a>
            <a href="#/ma-liste" class="nl-dropdown__item nl-nav__link--auth" data-link role="menuitem">Ma liste</a>
            <a href="#/parametres" class="nl-dropdown__item" data-link role="menuitem">Paramètres</a>
            <hr class="nl-dropdown__sep" />
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
   RECHERCHE avec debounce 300ms
 */

function _bindSearchBehavior(header) {
  const toggle = header.querySelector("#nl-search-toggle");
  const box = header.querySelector("#nl-search-box");
  const input = header.querySelector("#nl-search-input");

  let debounceTimer = null;

  // Ouvrir/fermer la barre de recherche
  toggle.addEventListener("click", () => {
    const isOpen = !box.hidden;
    box.hidden = isOpen;
    toggle.setAttribute("aria-expanded", String(!isOpen));
    if (!isOpen) {
      input.focus();
    } else {
      input.value = "";
      // Effacer les résultats si besoin
      document.dispatchEvent(new CustomEvent("nl:search:clear"));
    }
  });

  // Fermer avec Escape
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      box.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      input.value = "";
      document.dispatchEvent(new CustomEvent("nl:search:clear"));
    }
  });

  // Debounce sur la frappe
  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();

    debounceTimer = setTimeout(() => {
      if (query.length < 2) {
        document.dispatchEvent(new CustomEvent("nl:search:clear"));
        return;
      }
      // Émet un event global que la page de résultats écoute
      document.dispatchEvent(
        new CustomEvent("nl:search", {
          detail: { query },
        }),
      );
      // Navigation vers la page de recherche
      if (!window.location.hash.startsWith("#/recherche")) {
        window.location.hash = `#/recherche?q=${encodeURIComponent(query)}`;
      }
    }, 300);
  });
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
