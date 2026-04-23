import { chooseTable, state } from '../core/state.js';
import { escapeHtml, html } from '../core/dom.js';
import { FEATURED_TABLES, TOPIC_FILTERS } from '../data/presets.js';

export function renderHomePage(main) {
  main.replaceChildren();

  const section = html(`
    <div class="home-stack">
      <section class="hero-section super-hero">
        <div class="hero-copy">
          <p class="eyebrow">Open source StatBank explorer</p>
          <h1>Find svaret i Danmarks data uden at kæmpe med tabellerne.</h1>
          <p class="hero-lede">
            Søg på almindelige ord som vold, kriminalitet, klima, befolkning eller bolig.
            Talrum finder relevante DST-tabeller, hjælper med filtre og viser data som
            graf, kort, tabel og CSV.
          </p>
          <form class="hero-command" data-home-search>
            <label>
              <span>Hvad vil du undersøge?</span>
              <input name="query" type="search" placeholder="Prøv fx vold, kriminalitet, kommune, energi..." />
            </label>
            <button class="button primary" type="submit">Søg data</button>
          </form>
          <div class="hero-actions">
            <a class="button ghost" href="#/byg">Jeg kender tabelkoden</a>
            <a class="button ghost" href="#/api">Se hvordan data hentes</a>
          </div>
        </div>
        <div class="topic-orbit" aria-label="Datatemaer">
          <div class="orbit-core">
            <strong>DST</strong>
            <span>live data</span>
          </div>
          <button type="button" data-topic="crime" class="orbit-chip chip-one">Kriminalitet</button>
          <button type="button" data-topic="maps" class="orbit-chip chip-two">Kortdata</button>
          <button type="button" data-topic="people" class="orbit-chip chip-three">Borgere</button>
          <button type="button" data-topic="climate" class="orbit-chip chip-four">Klima</button>
          <div class="metric-card floating-card">
            <span>Smart start</span>
            <strong>12</strong>
            <small>seneste perioder som standard</small>
          </div>
        </div>
      </section>

      <section class="section-heading">
        <p class="eyebrow">Start med et tema</p>
        <h2>Vælg den måde du tænker på, ikke den måde Statistikbanken er bygget på.</h2>
      </section>
    </div>
  `);

  const topics = document.createElement('div');
  topics.className = 'topic-grid';
  TOPIC_FILTERS.forEach((topic) => {
    const card = html(`
      <button class="topic-card" type="button">
        <span>${escapeHtml(topic.label)}</span>
        <strong>${escapeHtml(topic.description)}</strong>
      </button>
    `);
    card.addEventListener('click', () => openTopic(topic.id));
    topics.append(card);
  });

  const featuredHeading = html(`
    <section class="section-heading compact-heading">
      <p class="eyebrow">Færdige startere</p>
      <h2>Klik ind i et datasæt med fornuftige filtre sat på forhånd.</h2>
    </section>
  `);

  const featured = document.createElement('div');
  featured.className = 'featured-grid';
  FEATURED_TABLES.forEach((table) => {
    const card = html(`
      <article class="dataset-card">
        <span>${escapeHtml(table.accent)}</span>
        <h3>${escapeHtml(table.title)}</h3>
        <p>${escapeHtml(table.description)}</p>
        <button class="button compact" type="button">Åbn ${escapeHtml(table.id)}</button>
      </article>
    `);
    card.querySelector('button').addEventListener('click', () => {
      chooseTable(table.id, table, table.view || 'chart');
      location.hash = '#/byg';
    });
    featured.append(card);
  });

  section.querySelector('[data-home-search]').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.exploreFilters.query = String(form.get('query') || '').trim();
    state.exploreFilters.topic = null;
    location.hash = '#/udforsk';
  });

  section.querySelectorAll('[data-topic]').forEach((button) => {
    button.addEventListener('click', () => openTopic(button.dataset.topic));
  });

  main.append(section, topics, featuredHeading, featured);
}

function openTopic(topicId) {
  state.exploreFilters.topic = topicId;
  state.exploreFilters.query = '';
  state.exploreFilters.mapOnly = false;
  location.hash = '#/udforsk';
}
