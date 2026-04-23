import {
  getSubjects,
  getTables,
  getTableInfo,
  getJsonStatData,
  clearApiCache,
} from './statbank.js';
import {
  buildRequestVariables,
  defaultSelectionsFor,
  estimateCellCount,
  findGeoVariable,
  findTimeVariable,
  missingRequiredSelections,
  parseJsonStat,
  selectedValueLabels,
} from './jsonstat.js';
import {
  downloadText,
  renderChart,
  renderTable,
  toCsv,
} from './charts.js';
import { renderGeoMap } from './map.js';

const main = document.querySelector('#main');
const toastRegion = document.querySelector('#toast-region');
const loadingTemplate = document.querySelector('#loading-template');
const navToggle = document.querySelector('.nav-toggle');
const siteNav = document.querySelector('#site-nav');

const FEATURED_TABLES = [
  {
    id: 'FOLK1A',
    title: 'Befolkning i kommuner',
    description: 'Befolkningen den 1. i kvartalet efter område, køn, alder og civilstand.',
    accent: 'Borgere',
    variables: {
      'OMRÅDE': ['000', '101', '751', '461', '851'],
      'KØN': ['TOT'],
      'ALDER': ['IALT'],
      'CIVILSTAND': ['TOT'],
    },
  },
  {
    id: 'GALDER',
    title: 'Gennemsnitsalder',
    description: 'Se gennemsnitsalder på tværs af kommuner og køn.',
    accent: 'Demografi',
    variables: {
      'KOMK': ['101', '751', '461', '851'],
      'KØN': ['TOT'],
    },
  },
  {
    id: 'FOD',
    title: 'Levendefødte',
    description: 'Udvikling i levendefødte fordelt på moders alder og barnets køn.',
    accent: 'Familie',
  },
  {
    id: 'FVPANDEL',
    title: 'Folketingsvalg',
    description: 'Partiernes stemmeandel ved folketingsvalg efter område og tid.',
    accent: 'Valg',
  },
];

const state = {
  route: '/',
  subjects: [],
  selectedSubject: null,
  tables: [],
  currentTableId: 'FOLK1A',
  currentMetadata: null,
  selections: {},
  currentParsed: null,
  currentPreset: FEATURED_TABLES[0],
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

function currentRoute() {
  return location.hash.replace(/^#/, '') || '/';
}

async function renderRoute() {
  state.route = currentRoute();
  siteNav.classList.remove('is-open');
  navToggle.setAttribute('aria-expanded', 'false');
  document.querySelectorAll('[data-route-link]').forEach((link) => {
    link.toggleAttribute('aria-current', link.dataset.routeLink === state.route);
  });

  if (state.route === '/udforsk') {
    await renderExplorePage();
    return;
  }

  if (state.route === '/byg') {
    await renderBuilderPage();
    return;
  }

  if (state.route === '/api') {
    renderApiPage();
    return;
  }

  renderHomePage();
}

function renderHomePage() {
  main.replaceChildren();
  const section = html(`
    <section class="hero-section">
      <div class="hero-copy">
        <p class="eyebrow">Open source StatBank explorer</p>
        <h1>Danmarks officielle tal, fortalt som noget man faktisk gider bruge.</h1>
        <p class="hero-lede">
          Talrum gør Danmarks Statistiks åbne data mere visuelt, mere søgbart og
          mere forståeligt. Vælg et datasæt, justér variable og få grafer, kort,
          tabel og download uden at lære Statistikbankens gamle interface først.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#/byg">Byg din egen visning</a>
          <a class="button ghost" href="#/udforsk">Udforsk emner</a>
        </div>
      </div>
      <div class="hero-visual" aria-label="Eksempel på data dashboard">
        <div class="orb orb-one"></div>
        <div class="orb orb-two"></div>
        <div class="metric-card floating-card">
          <span>Seneste FOLK1A</span>
          <strong>Live</strong>
          <small>Befolkning pr. kvartal</small>
        </div>
        <div class="mini-chart-card floating-card">
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <div class="map-card floating-card">
          <i></i><i></i><i></i><i></i><i></i>
        </div>
      </div>
    </section>

    <section class="panel-grid">
      <article class="info-panel">
        <span class="panel-number">01</span>
        <h2>Find data hurtigt</h2>
        <p>Start i DST's emner, søg i tabeller eller indtast en tabelkode direkte.</p>
      </article>
      <article class="info-panel">
        <span class="panel-number">02</span>
        <h2>Vælg variable trygt</h2>
        <p>Siden læser tableinfo, viser værdierne og beregner udtrækkets størrelse før kaldet.</p>
      </article>
      <article class="info-panel">
        <span class="panel-number">03</span>
        <h2>Se og hent</h2>
        <p>JSON-stat bliver oversat til linjegraf, søjler, tabel, kort og CSV-download.</p>
      </article>
    </section>

    <section class="section-heading">
      <p class="eyebrow">Gode steder at starte</p>
      <h2>Populære datasæt med fornuftige standardvalg</h2>
    </section>
  `);

  const featured = document.createElement('div');
  featured.className = 'featured-grid';
  FEATURED_TABLES.forEach((table) => {
    const card = html(`
      <article class="dataset-card">
        <span>${table.accent}</span>
        <h3>${table.title}</h3>
        <p>${table.description}</p>
        <button class="button compact" type="button">Åbn ${table.id}</button>
      </article>
    `);
    card.querySelector('button').addEventListener('click', () => {
      state.currentTableId = table.id;
      state.currentPreset = table;
      location.hash = '#/byg';
    });
    featured.append(card);
  });

  main.append(section, featured);
}

async function renderExplorePage() {
  main.replaceChildren(pageHeader(
    'Udforsk Statistikbanken',
    'Find officielle DST-tabeller via emner. Alt hentes live fra `subjects` og `tables`.'
  ), loading());

  try {
    if (!state.subjects.length) {
      state.subjects = await getSubjects();
    }

    const page = html(`
      <section class="workspace two-column">
        <aside class="sidebar-panel">
          <div class="panel-title">
            <span>Emner</span>
            <button class="text-button" data-refresh type="button">Opdatér</button>
          </div>
          <div class="subject-list"></div>
        </aside>
        <section class="content-panel">
          <div class="search-row">
            <label class="field">
              <span>Søg i viste tabeller</span>
              <input data-table-filter type="search" placeholder="Skriv fx befolkning, løn, energi..." />
            </label>
            <button class="button" data-load-recent type="button">Senest opdateret</button>
          </div>
          <div class="table-results"></div>
        </section>
      </section>
    `);

    main.replaceChildren(pageHeader(
      'Udforsk Statistikbanken',
      'Find officielle DST-tabeller via emner. Alt hentes live fra `subjects` og `tables`.'
    ), page);

    renderSubjectList(page.querySelector('.subject-list'));
    page.querySelector('[data-refresh]').addEventListener('click', async () => {
      clearApiCache();
      state.subjects = await getSubjects();
      renderSubjectList(page.querySelector('.subject-list'));
      toast('Emner er opdateret fra StatBank.');
    });
    page.querySelector('[data-load-recent]').addEventListener('click', () => loadTables({ pastdays: 30 }, 'Tabeller opdateret de seneste 30 dage'));
    page.querySelector('[data-table-filter]').addEventListener('input', (event) => {
      renderTableResults(page.querySelector('.table-results'), event.target.value);
    });

    if (!state.tables.length) {
      await loadTables({ subjects: ['1'] }, 'Borgere');
    } else {
      renderTableResults(page.querySelector('.table-results'));
    }
  } catch (error) {
    renderError(main, error);
  }
}

async function loadTables(options, heading) {
  const results = document.querySelector('.table-results');
  results?.replaceChildren(loading());

  try {
    state.tables = await getTables(options);
    renderTableResults(results, '', heading);
  } catch (error) {
    renderError(results, error);
  }
}

function renderSubjectList(container) {
  container.replaceChildren();

  state.subjects.forEach((subject) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'subject-button';
    const description = document.createElement('strong');
    description.textContent = subject.description;
    const id = document.createElement('span');
    id.textContent = subject.id;
    button.append(description, id);
    button.toggleAttribute('aria-pressed', state.selectedSubject === subject.id);
    button.addEventListener('click', async () => {
      state.selectedSubject = subject.id;
      renderSubjectList(container);
      await loadTables({ subjects: [subject.id] }, subject.description);
    });
    container.append(button);
  });
}

function renderTableResults(container, filter = '', heading = null) {
  if (!container) return;

  const normalizedFilter = filter.trim().toLowerCase();
  const tables = state.tables.filter((table) => {
    const haystack = `${table.id} ${table.text} ${table.variables?.join(' ') || ''}`.toLowerCase();
    return !normalizedFilter || haystack.includes(normalizedFilter);
  });

  container.replaceChildren();

  const header = html(`
    <div class="results-heading">
      <div>
        <span class="eyebrow">${heading || 'Resultater'}</span>
        <h2>${tables.length.toLocaleString('da-DK')} tabeller</h2>
      </div>
    </div>
  `);
  container.append(header);

  const list = document.createElement('div');
  list.className = 'table-card-list';

  tables.slice(0, 80).forEach((table) => {
    const card = html(`
      <article class="table-card">
        <div>
          <span class="table-id">${escapeHtml(table.id)}</span>
          <h3>${escapeHtml(table.text)}</h3>
          <p>${escapeHtml(table.variables?.join(' · ') || 'Ingen variable oplyst')}</p>
        </div>
        <div class="table-meta">
          <span>${escapeHtml(table.unit || '-')}</span>
          <span>${formatDate(table.updated)}</span>
          <button class="button compact" type="button">Åbn</button>
        </div>
      </article>
    `);
    card.querySelector('button').addEventListener('click', () => {
      state.currentTableId = table.id;
      state.currentPreset = null;
      location.hash = '#/byg';
    });
    list.append(card);
  });

  container.append(list);

  if (tables.length > 80) {
    const note = document.createElement('p');
    note.className = 'muted small';
    note.textContent = 'Viser de første 80 resultater. Brug søgning for at indsnævre.';
    container.append(note);
  }
}

async function renderBuilderPage() {
  main.replaceChildren(pageHeader(
    'Byg din egen datavisning',
    'Indtast en tabelkode, vælg variable og hent live-data som graf, kort, tabel og CSV.'
  ));

  const page = html(`
    <section class="builder-layout">
      <aside class="builder-panel">
        <form class="table-form">
          <label class="field">
            <span>Tabelkode</span>
            <input name="table" value="${state.currentTableId}" autocomplete="off" />
          </label>
          <button class="button primary" type="submit">Hent metadata</button>
        </form>

        <div class="metadata-summary"></div>
        <div class="variable-editor"></div>
      </aside>

      <section class="visual-panel">
        <div class="visual-toolbar">
          <div>
            <span class="eyebrow">Live-visning</span>
            <h2 data-output-title>Vælg data</h2>
          </div>
          <div class="toolbar-actions">
            <button class="button ghost compact" data-download-csv type="button" disabled>CSV</button>
            <button class="button ghost compact" data-download-json type="button" disabled>JSON</button>
            <button class="button primary compact" data-run-query type="button" disabled>Hent data</button>
          </div>
        </div>

        <div class="selection-summary"></div>

        <div class="tabs" role="tablist" aria-label="Datavisninger">
          <button class="tab is-active" data-tab="chart" type="button">Graf</button>
          <button class="tab" data-tab="map" type="button">Kort</button>
          <button class="tab" data-tab="table" type="button">Tabel</button>
        </div>

        <div class="output-surface" data-output="chart"></div>
        <div class="output-surface is-hidden" data-output="map"></div>
        <div class="output-surface is-hidden" data-output="table"></div>
      </section>
    </section>
  `);

  main.append(page);

  page.querySelector('.table-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.currentTableId = String(form.get('table')).trim().toUpperCase();
    state.currentPreset = FEATURED_TABLES.find((table) => table.id === state.currentTableId) || null;
    await loadMetadata(page);
  });

  page.querySelector('[data-run-query]').addEventListener('click', () => runCurrentQuery(page));
  page.querySelector('[data-download-csv]').addEventListener('click', () => {
    if (state.currentParsed) {
      downloadText(`${state.currentParsed.tableId || state.currentTableId}.csv`, toCsv(state.currentParsed), 'text/csv;charset=utf-8');
    }
  });
  page.querySelector('[data-download-json]').addEventListener('click', () => {
    if (state.currentParsed) {
      downloadText(`${state.currentParsed.tableId || state.currentTableId}.json`, JSON.stringify(state.currentParsed, null, 2), 'application/json;charset=utf-8');
    }
  });

  page.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      page.querySelectorAll('.tab').forEach((item) => item.classList.toggle('is-active', item === tab));
      page.querySelectorAll('[data-output]').forEach((output) => {
        output.classList.toggle('is-hidden', output.dataset.output !== tab.dataset.tab);
      });
    });
  });

  await loadMetadata(page);
}

async function loadMetadata(page) {
  const summary = page.querySelector('.metadata-summary');
  const editor = page.querySelector('.variable-editor');
  const runButton = page.querySelector('[data-run-query]');
  summary.replaceChildren(loading());
  editor.replaceChildren();
  runButton.disabled = true;

  try {
    const metadata = await getTableInfo(state.currentTableId);
    state.currentMetadata = metadata;
    state.selections = defaultSelectionsFor(metadata, state.currentPreset);

    const timeVariable = findTimeVariable(metadata);
    if (timeVariable && !state.currentPreset?.variables?.[timeVariable.id]) {
      state.selections[timeVariable.id] = timeVariable.values.slice(-12).map((value) => value.id);
    }

    summary.replaceChildren(renderMetadataSummary(metadata));
    renderVariableEditor(editor, metadata, state.selections, () => updateQuerySummary(page));
    runButton.disabled = false;
    updateQuerySummary(page);
    await runCurrentQuery(page);
  } catch (error) {
    renderError(summary, error);
  }
}

function renderMetadataSummary(metadata) {
  const geoVariable = findGeoVariable(metadata);
  return html(`
    <article class="metadata-card">
      <span class="table-id">${escapeHtml(metadata.id)}</span>
      <h2>${escapeHtml(metadata.text)}</h2>
      <p>${escapeHtml(metadata.description)}</p>
      <dl>
        <div><dt>Enhed</dt><dd>${escapeHtml(metadata.unit || '-')}</dd></div>
        <div><dt>Opdateret</dt><dd>${formatDate(metadata.updated)}</dd></div>
        <div><dt>Variable</dt><dd>${metadata.variables.length}</dd></div>
        <div><dt>Kort</dt><dd>${escapeHtml(geoVariable?.map || 'Ikke angivet')}</dd></div>
      </dl>
      ${metadata.documentation?.url ? `<a href="${escapeAttribute(metadata.documentation.url)}" target="_blank" rel="noreferrer">Dokumentation hos DST</a>` : ''}
    </article>
  `);
}

function renderVariableEditor(container, metadata, selections, onChange) {
  container.replaceChildren();

  metadata.variables.forEach((variable) => {
    const panel = html(`
      <details class="variable-panel" open>
        <summary>
          <span>
            <strong>${escapeHtml(variable.text)}</strong>
            <small>${escapeHtml(variable.id)}${variable.time ? ' · tid' : ''}${variable.map ? ` · ${escapeHtml(variable.map)}` : ''}</small>
          </span>
          <em data-count>${(selections[variable.id] || []).length} valgt</em>
        </summary>
        <div class="variable-tools">
          <input type="search" placeholder="Filtrér værdier..." data-value-filter />
          <button type="button" data-select-total>I alt</button>
          <button type="button" data-select-visible>Vælg viste</button>
          <button type="button" data-clear>Ryd</button>
        </div>
        <div class="value-list"></div>
      </details>
    `);

    const valueList = panel.querySelector('.value-list');
    const count = panel.querySelector('[data-count]');
    const filter = panel.querySelector('[data-value-filter]');

    const renderValues = () => {
      const query = filter.value.trim().toLowerCase();
      const values = variable.values.filter((value) => {
        const text = `${value.id} ${value.text}`.toLowerCase();
        return !query || text.includes(query);
      }).slice(0, 160);

      valueList.replaceChildren();
      values.forEach((value) => {
        const label = document.createElement('label');
        label.className = 'check-row';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = value.id;
        checkbox.checked = selections[variable.id]?.includes(value.id) || false;
        const text = document.createElement('span');
        text.textContent = value.text;
        const code = document.createElement('code');
        code.textContent = value.id;
        checkbox.addEventListener('change', (event) => {
          const current = new Set(selections[variable.id] || []);
          if (event.target.checked) {
            current.add(value.id);
          } else {
            current.delete(value.id);
          }
          selections[variable.id] = [...current];
          count.textContent = `${selections[variable.id].length} valgt`;
          onChange();
        });
        label.append(checkbox, text, code);
        valueList.append(label);
      });

      if (variable.values.length > 160 && !query) {
        const note = document.createElement('p');
        note.className = 'muted small';
        note.textContent = `Viser 160 af ${variable.values.length.toLocaleString('da-DK')} værdier. Brug søgning for flere.`;
        valueList.append(note);
      }
    };

    filter.addEventListener('input', renderValues);
    panel.querySelector('[data-select-total]').addEventListener('click', () => {
      const total = variable.values.find((value) => /(^TOT$|^IALT$|^000$|I alt)/i.test(`${value.id} ${value.text}`));
      selections[variable.id] = total ? [total.id] : [variable.values[0]?.id].filter(Boolean);
      count.textContent = `${selections[variable.id].length} valgt`;
      renderValues();
      onChange();
    });
    panel.querySelector('[data-select-visible]').addEventListener('click', () => {
      const query = filter.value.trim().toLowerCase();
      const values = variable.values.filter((value) => {
        const text = `${value.id} ${value.text}`.toLowerCase();
        return !query || text.includes(query);
      }).slice(0, 80);
      selections[variable.id] = values.map((value) => value.id);
      count.textContent = `${selections[variable.id].length} valgt`;
      renderValues();
      onChange();
    });
    panel.querySelector('[data-clear]').addEventListener('click', () => {
      selections[variable.id] = [];
      count.textContent = '0 valgt';
      renderValues();
      onChange();
    });

    renderValues();
    container.append(panel);
  });
}

function updateQuerySummary(page) {
  const summary = page.querySelector('.selection-summary');
  const runButton = page.querySelector('[data-run-query]');
  const { cellCount, rowCount } = estimateCellCount(state.currentMetadata, state.selections);
  const missingRequired = missingRequiredSelections(state.currentMetadata, state.selections);
  const tooLarge = cellCount > 1_000_000;
  const labels = selectedValueLabels(state.currentMetadata, state.selections, 2);
  const warning = missingRequired.length
    ? `Vælg mindst én værdi for: ${missingRequired.map((variable) => variable.text).join(', ')}.`
    : 'Almindelige StatBank-kald bør holdes under 1.000.000 celler.';

  summary.replaceChildren(html(`
    <div class="query-summary ${tooLarge || missingRequired.length ? 'is-warning' : ''}">
      <div>
        <strong>${rowCount.toLocaleString('da-DK')} observationer estimeret</strong>
        <span>${cellCount.toLocaleString('da-DK')} celler · ${escapeHtml(warning)}</span>
      </div>
      <p>${escapeHtml(labels.join(' · '))}</p>
    </div>
  `));

  runButton.disabled = tooLarge || Boolean(missingRequired.length);
}

async function runCurrentQuery(page) {
  const metadata = state.currentMetadata;
  if (!metadata) return;

  const chartOutput = page.querySelector('[data-output="chart"]');
  const mapOutput = page.querySelector('[data-output="map"]');
  const tableOutput = page.querySelector('[data-output="table"]');
  const title = page.querySelector('[data-output-title]');
  const downloadButtons = page.querySelectorAll('[data-download-csv], [data-download-json]');
  chartOutput.replaceChildren(loading());
  mapOutput.replaceChildren();
  tableOutput.replaceChildren();

  try {
    const variables = buildRequestVariables(metadata, state.selections);
    const response = await getJsonStatData(metadata.id, variables);
    const parsed = parseJsonStat(response);
    state.currentParsed = parsed;
    title.textContent = metadata.text;

    renderChart(chartOutput, parsed);
    await renderGeoMap(mapOutput, parsed);
    renderTable(tableOutput, parsed);
    downloadButtons.forEach((button) => {
      button.disabled = false;
    });
    toast('Data er hentet og visualiseret.');
  } catch (error) {
    renderError(chartOutput, error);
  }
}

function renderApiPage() {
  main.replaceChildren(pageHeader(
    'API & kilder',
    'Sådan bruger projektet DST korrekt og hvad der er vigtigt for datakvalitet.'
  ), html(`
    <section class="docs-grid">
      <article class="doc-card">
        <span class="panel-number">subjects</span>
        <h2>Emnehierarki</h2>
        <p>Bruges til at vise hovedemner og finde tabeller inden for et emne.</p>
        <code>POST https://api.statbank.dk/v1/subjects</code>
      </article>
      <article class="doc-card">
        <span class="panel-number">tables</span>
        <h2>Tabelkatalog</h2>
        <p>Returnerer tabel-id, titel, enhed, opdateringsdato og variable. Kan filtreres med emner eller seneste dage.</p>
        <code>POST https://api.statbank.dk/v1/tables</code>
      </article>
      <article class="doc-card">
        <span class="panel-number">tableinfo</span>
        <h2>Metadata først</h2>
        <p>Siden læser altid metadata før data, fordi variable, værdi-koder, enhed, note og kort-metadata kommer herfra.</p>
        <code>POST https://api.statbank.dk/v1/tableinfo</code>
      </article>
      <article class="doc-card">
        <span class="panel-number">data</span>
        <h2>JSON-stat til visning</h2>
        <p>Visualiseringer hentes i JSONSTAT, så dimensioner og værdier kan matches korrekt i browseren.</p>
        <code>POST https://api.statbank.dk/v1/data</code>
      </article>
      <article class="doc-card">
        <span class="panel-number">catalogue</span>
        <h2>DCAT-AP kræver nøgle</h2>
        <p>catalogue leverer et XML-katalog til fx Datavejviser, men DST kræver API-nøgle. Siden bruger derfor de åbne metadata-kald til normal browsing.</p>
        <code>POST https://api.statbank.dk/v1/catalogue</code>
      </article>
      <article class="doc-card">
        <span class="panel-number">kort</span>
        <h2>Geografi</h2>
        <p>StatBank fortæller hvilken variabel der er geografisk. Talrum matcher kommune- og regionskoder med Dataforsyningens visuelle centre.</p>
        <code>GET https://api.dataforsyningen.dk/kommuner?struktur=mini</code>
      </article>
    </section>

    <section class="source-panel">
      <h2>Datakvalitet i denne prototype</h2>
      <p>
        Siden summerer ikke skjulte dimensioner. Hvis et kort ville kræve flere
        ikke-geografiske værdier på samme punkt, beder den brugeren vælge én værdi
        i stedet for at vise en misvisende boble. Celle-estimatet beskytter mod
        for store almindelige udtræk.
      </p>
      <div class="source-links">
        <a href="https://www.dst.dk/da/Statistik/hjaelp-til-statistikbanken/api" target="_blank" rel="noreferrer">DST API dokumentation</a>
        <a href="https://api.statbank.dk/console#subjects" target="_blank" rel="noreferrer">subjects console</a>
        <a href="https://api.statbank.dk/console#tables" target="_blank" rel="noreferrer">tables console</a>
        <a href="https://api.statbank.dk/console#tableinfo" target="_blank" rel="noreferrer">tableinfo console</a>
        <a href="https://api.statbank.dk/console#data" target="_blank" rel="noreferrer">data console</a>
        <a href="https://api.statbank.dk/console#catalogue" target="_blank" rel="noreferrer">catalogue console</a>
      </div>
    </section>
  `));
}

function pageHeader(title, subtitle) {
  return html(`
    <section class="page-header">
      <p class="eyebrow">Talrum</p>
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </section>
  `);
}

function renderError(container, error) {
  container.replaceChildren(html(`
    <div class="error-card">
      <strong>Der opstod en fejl</strong>
      <p>${error.message || error}</p>
    </div>
  `));
}

function loading() {
  return loadingTemplate.content.firstElementChild.cloneNode(true);
}

function toast(message) {
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  toastRegion.append(item);
  setTimeout(() => item.remove(), 3200);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('da-DK', { dateStyle: 'medium' }).format(date);
}

function html(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}
