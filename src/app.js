import { state } from './core/state.js';
import { renderHomePage } from './components/homePage.js';
import { renderExplorePage } from './components/explorePage.js';
import { renderBuilderPage } from './components/builderPage.js';
import { renderApiPage } from './components/apiPage.js';

const main = document.querySelector('#main');
const toastRegion = document.querySelector('#toast-region');
const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('#site-nav');

const context = {
  main,
  toastRegion,
};

navToggle.addEventListener('click', () => {
  const expanded = navToggle.getAttribute('aria-expanded') === 'true';
  navToggle.setAttribute('aria-expanded', String(!expanded));
  siteNav.classList.toggle('is-open', !expanded);
});

window.addEventListener('hashchange', renderRoute);
window.addEventListener('DOMContentLoaded', () => {
  if (!location.hash) {
    history.replaceState(null, '', '#/');
  }
  renderRoute();
});

async function renderRoute() {
  state.route = currentRoute();
  closeMobileNav();
  markActiveRoute();

  if (state.route === '/udforsk') {
    await renderExplorePage(main, context);
    return;
  }

  if (state.route === '/byg') {
    await renderBuilderPage(main, context);
    return;
  }

  if (state.route === '/api') {
    renderApiPage(main);
    return;
  }

  renderHomePage(main);
}

function currentRoute() {
  return location.hash.replace(/^#/, '') || '/';
}

function closeMobileNav() {
  siteNav.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', 'false');
}

function markActiveRoute() {
  document.querySelectorAll('[data-route-link]').forEach((link) => {
    link.toggleAttribute('aria-current', link.dataset.routeLink === state.route);
  });
}
