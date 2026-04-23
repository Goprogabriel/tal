import { getSubjects, getTables, clearApiCache } from '../statbank.js';
import { state } from '../core/state.js';
import { debounce, escapeHtml, html, loading, pageHeader, renderError, toast } from '../core/dom.js';
import { filterTables, isMapReadyTable } from '../data/search.js';
import { TOPIC_FILTERS, topicById } from '../data/presets.js';
import { renderTableCards } from './tableCards.js';

export async function renderExplorePage(main, context) {
  main.replaceChildren(pageHeader(
    'Søg i Danmarks data',
    'Søg på ord, vælg temaer og filtrér efter tabeller der kan vises på kort.'
  ), loading('Indlæser StatBank-katalog...'));

  try {
    await Promise.all([ensureSubjects(), ensureAllTables()]);
    const page = renderExploreShell();
    main.replaceChildren(pageHeader(
      'Søg i Danmarks data',
      'Søg på ord, vælg temaer og filtrér efter tabeller der kan vises på kort.'
    ), page);

    bindExploreEvents(page, context);
    renderSubjects(page.querySelector('.subject-list'));
    updateExploreResults(page);
  } catch (error) {
    renderError(main, error);
  }
}

function renderExploreShell() {
  const topic = topicById(state.exploreFilters.topic);

  return html(`
    <div class="explore-page">
      <section class="explore-command-panel">
        <div>
          <p class="eyebrow">Søgelab</p>
          <h2>Hvad vil du forstå?</h2>
          <p>Søg bredt først. Brug derefter tema, kortfilter og emner til at skære støjen væk.</p>
        </div>
        <form class="global-search" data-global-search>
          <input name="query" type="search" value="${escapeHtml(state.exploreFilters.query)}" placeholder="Søg fx vold, kriminalitet, kommune, energi..." />
          <button class="button primary" type="submit">Søg</button>
        </form>
        <div class="topic-strip">
          ${TOPIC_FILTERS.map((item) => `
            <button class="topic-pill ${topic?.id === item.id ? 'is-active' : ''}" data-topic="${item.id}" type="button">
              ${escapeHtml(item.label)}
            </button>
          `).join('')}
        </div>
      </section>

      <section class="explore-layout">
        <aside class="filter-panel">
          <div class="filter-section">
            <h3>Filtre</h3>
            <label class="toggle-row">
              <input data-map-only type="checkbox" ${state.exploreFilters.mapOnly ? 'checked' : ''} />
              <span>Kun tabeller der kan vises på kort</span>
            </label>
            <label class="field">
              <span>Sortering</span>
              <select data-sort>
                <option value="relevance" ${state.exploreFilters.sort === 'relevance' ? 'selected' : ''}>Mest relevant</option>
                <option value="updated" ${state.exploreFilters.sort === 'updated' ? 'selected' : ''}>Senest opdateret</option>
                <option value="map" ${state.exploreFilters.sort === 'map' ? 'selected' : ''}>Kort først</option>
              </select>
            </label>
            <button class="button ghost compact" data-all-tables type="button">Alle tabeller</button>
            <button class="button ghost compact" data-recent type="button">Seneste 30 dage</button>
            <button class="text-button" data-refresh type="button">Opdatér katalog</button>
          </div>

          <div class="filter-section">
            <h3>Emner fra DST</h3>
            <div class="subject-list"></div>
          </div>
        </aside>

        <section class="content-panel search-results-panel">
          <div class="result-stats"></div>
          <div class="active-filter-bar"></div>
          <div class="table-results"></div>
        </section>
      </section>
    </div>
  `);
}

function bindExploreEvents(page, context) {
  const searchForm = page.querySelector('[data-global-search]');
  const searchInput = searchForm.querySelector('input');
  const updateFromInput = debounce(() => {
    state.exploreFilters.query = searchInput.value.trim();
    updateExploreResults(page);
  });

  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    state.exploreFilters.query = searchInput.value.trim();
    updateExploreResults(page);
  });
  searchInput.addEventListener('input', updateFromInput);

  page.querySelectorAll('[data-topic]').forEach((button) => {
    button.addEventListener('click', () => {
      state.exploreFilters.topic = state.exploreFilters.topic === button.dataset.topic ? null : button.dataset.topic;
      renderExplorePage(document.querySelector('#main'), context);
    });
  });

  page.querySelector('[data-map-only]').addEventListener('change', (event) => {
    state.exploreFilters.mapOnly = event.target.checked;
    updateExploreResults(page);
  });

  page.querySelector('[data-sort]').addEventListener('change', (event) => {
    state.exploreFilters.sort = event.target.value;
    updateExploreResults(page);
  });

  page.querySelector('[data-all-tables]').addEventListener('click', async () => {
    state.selectedSubject = null;
    state.tables = state.allTables;
    state.tableSourceLabel = 'Alle tabeller';
    renderSubjects(page.querySelector('.subject-list'));
    updateExploreResults(page);
  });

  page.querySelector('[data-recent]').addEventListener('click', async () => {
    await loadTables(page, { pastdays: 30 }, 'Seneste 30 dage');
  });

  page.querySelector('[data-refresh]').addEventListener('click', async () => {
    clearApiCache();
    state.subjects = [];
    state.allTables = [];
    await Promise.all([ensureSubjects(), ensureAllTables()]);
    state.tables = state.allTables;
    state.tableSourceLabel = 'Alle tabeller';
    renderSubjects(page.querySelector('.subject-list'));
    updateExploreResults(page);
    toast(context.toastRegion, 'Kataloget er opdateret fra StatBank.');
  });
}

function updateExploreResults(page) {
  const baseTables = state.tables.length ? state.tables : state.allTables;
  const topic = topicById(state.exploreFilters.topic);
  const tables = filterTables(baseTables, state.exploreFilters);
  const mapCount = tables.filter(isMapReadyTable).length;
  const latestUpdated = tables
    .map((table) => table.updated)
    .filter(Boolean)
    .sort()
    .at(-1);

  page.querySelector('.result-stats').replaceChildren(html(`
    <div class="stat-grid">
      <div class="stat-tile">
        <span>Resultater</span>
        <strong>${tables.length.toLocaleString('da-DK')}</strong>
      </div>
      <div class="stat-tile">
        <span>Kortklar</span>
        <strong>${mapCount.toLocaleString('da-DK')}</strong>
      </div>
      <div class="stat-tile">
        <span>Kilde</span>
        <strong>${escapeHtml(state.tableSourceLabel)}</strong>
      </div>
      <div class="stat-tile">
        <span>Seneste opdatering</span>
        <strong>${latestUpdated ? new Date(latestUpdated).getFullYear() : '-'}</strong>
      </div>
    </div>
  `));

  page.querySelector('.active-filter-bar').replaceChildren(html(`
    <div class="active-filter">
      <span>${topic ? `Tema: ${escapeHtml(topic.label)}` : 'Tema: alle'}</span>
      <span>${state.exploreFilters.query ? `Søgning: ${escapeHtml(state.exploreFilters.query)}` : 'Ingen fritekstsøgning'}</span>
      <span>${state.exploreFilters.mapOnly ? 'Kun kort-egnede' : 'Alle visningstyper'}</span>
    </div>
  `));

  renderTableCards(page.querySelector('.table-results'), tables);
}

function renderSubjects(container) {
  container.replaceChildren();

  state.subjects.forEach((subject) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'subject-button';
    button.toggleAttribute('aria-pressed', state.selectedSubject === subject.id);

    const description = document.createElement('strong');
    description.textContent = subject.description;
    const id = document.createElement('span');
    id.textContent = subject.id;
    button.append(description, id);

    button.addEventListener('click', async () => {
      state.selectedSubject = subject.id;
      await loadTables(document.querySelector('.explore-layout'), { subjects: [subject.id] }, subject.description);
      renderSubjects(container);
    });

    container.append(button);
  });
}

async function loadTables(scope, options, label) {
  const results = document.querySelector('.table-results');
  results?.replaceChildren(loading('Henter tabeller...'));
  state.tables = await getTables(options);
  state.tableSourceLabel = label;
  updateExploreResults(scope.closest ? scope.closest('main') || document : document);
}

async function ensureSubjects() {
  if (!state.subjects.length) {
    state.subjects = await getSubjects();
  }
}

async function ensureAllTables() {
  if (!state.allTables.length) {
    state.allTables = await getTables();
  }

  if (!state.tables.length) {
    state.tables = state.allTables;
    state.tableSourceLabel = 'Alle tabeller';
  }
}
