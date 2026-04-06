// router.js — Système de routing SPA (hash-based)

const routes = {
  '/':          '/acceuil',
  '/acceuil':   '/acceuil',
  '/films':     '/films',
  '/series':    '/series',
  '/detail':    '/detail',
  '/ma-liste':  '/ma-liste',
  '/profil':    '/userinfo',
  '/connexion': '/login',
  '/inscription': '/register',
};

async function loadPage(path) {
  const target = routes[path] || '/acceuil';
  const app = document.getElementById('app');
  if (!app) return;

  try {
    const res = await fetch(target);
    if (!res.ok) throw new Error(`Page introuvable : ${target}`);
    const html = await res.text();

    // Extraire uniquement le contenu du <main>
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const main = doc.querySelector('main');

    app.innerHTML = main ? main.innerHTML : html;

    // Re-exécuter les scripts de la page chargée
    _executeScripts(app);

  } catch (err) {
    console.error(err);
    app.innerHTML = '<p style="color:white;padding:2rem">Page introuvable.</p>';
  }
}

function _executeScripts(container) {
  container.querySelectorAll('script').forEach(oldScript => {
    const newScript = document.createElement('script');
    if (oldScript.src) {
      newScript.src = oldScript.src;
    } else {
      newScript.textContent = oldScript.textContent;
    }
    oldScript.replaceWith(newScript);
  });
}

function getHashPath() {
  return window.location.hash.replace('#', '') || '/';
}

function navigate(path) {
  window.location.hash = path;
}

function initRouter() {
  // Chargement initial
  loadPage(getHashPath());

  // Changement de hash
  window.addEventListener('hashchange', () => {
    loadPage(getHashPath());
  });

  // Intercepter les clics sur les liens data-link
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-link]');
    if (!link) return;
    e.preventDefault();
    const path = link.getAttribute('href').replace('#', '');
    navigate(path);
  });
}

export { initRouter, navigate };