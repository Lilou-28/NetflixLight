// router.js — Système de routing SPA (hash-based)

import { showSessionExpiredPopup } from './auth.js'

const routes = {
  '/':            '/api/page/acceuil',
  '/acceuil':     '/api/page/acceuil',
  '/films':       '/api/page/films',
  '/series':      '/api/page/series',
  '/detail':      '/api/page/detail',
  '/ma-liste':    '/api/page/ma-liste',
  '/profil':      '/api/page/userinfo',
  '/connexion':   '/api/page/login',
  '/inscription': '/api/page/register',
  '/film':        '/api/page/film',
}

async function loadPage(path) {
  const target = routes[path] || '/acceuil';
  const app = document.getElementById('app');
  if (!app) return;

  try {
    const res = await fetch(target);
    if (res.status === 401) {
      showSessionExpiredPopup('/login');
      return;
    }

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
      newScript.defer = true;
    } else {
      newScript.textContent = oldScript.textContent;
    }
    if (oldScript.type) newScript.type = oldScript.type;
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