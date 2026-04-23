import { getJsonStatData, getTableInfo } from '../statbank.js';
import { renderGeoMap } from '../map.js';
import {
  buildRequestVariables,
  defaultSelectionsFor,
  estimateCellCount,
  findGeoVariable,
  findTimeVariable,
  missingRequiredSelections,
  parseJsonStat,
  selectedValueLabels,
} from '../jsonstat.js';
import { downloadText, renderChart, renderTable, toCsv } from '../charts.js';
import { state } from '../core/state.js';
import {
  escapeAttribute,
  escapeHtml,
  html,
  loading,
  pageHeader,
  renderError,
  toast,
} from '../core/dom.js';
import { SMART_VALUE_FILTERS, presetForTable } from '../data/presets.js';

export async function renderBuilderPage(main, context) {
  main.replaceChildren(pageHeader(
    'Byg din egen datavisning',
    'Indtast en tabelkode, brug smartfiltre og hent live-data som graf, kort, tabel og CSV.'
  ));

  const page = html(`
    <section class="builder-layout enhanced-builder">
      <aside class="builder-panel">
        <form class="table-form">
          <label class="field">
            <span>Tabelkode</span>
            <input name="table" value="${escapeAttribute(state.currentTableId)}" autocomplete="off" />
          </label>
          <button class="button primary" type="submit">Hent metadata</button>
        </form>

        <div class="quick-guide">
          <span class="step-pill">1. Tabel</span>
          <span class="step-pill">2. Smartfiltre</span>
          <span class="step-pill">3. Visning</span>
        </div>

        <div class="metadata-summary"></div>
        <div class="smart-suggestions"></div>
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
          <button class="tab" data-tab="chart" type="button">Graf</button>
          <button class="tab" data-tab="map" type="button">Kort</button>
          <button class="tab" data-tab="table" type="button">Tabel</button>
        </div>

        <div class="output-surface" data-output="chart"></div>
        <div class="output-surface" data-output="map"></div>
        <div class="output-surface" data-output="table"></div>
      </section>
    </section>
  `);

  main.append(page);
  bindBuilderEvents(page, context);
  setActiveTab(page, state.activeView || 'chart');
  await loadMetadata(page, context);
}

function bindBuilderEvents(page, context) {
  page.querySelector('.table-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    state.currentTableId = String(form.get('table')).trim().toUpperCase();
    state.currentPreset = presetForTable(state.currentTableId);
    state.activeView = 'chart';
    setActiveTab(page, state.activeView);
    await loadMetadata(page, context);
  });

  page.querySelector('[data-run-query]').addEventListener('click', () => runCurrentQuery(page, context));
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
      state.activeView = tab.dataset.tab;
      setActiveTab(page, state.activeView);
    });
  });
}

async function loadMetadata(page, context) {
  const summary = page.querySelector('.metadata-summary');
  const smart = page.querySelector('.smart-suggestions');
  const editor = page.querySelector('.variable-editor');
  const runButton = page.querySelector('[data-run-query]');
  summary.replaceChildren(loading('Henter metadata...'));
  smart.replaceChildren();
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

    const refreshControls = () => {
      summary.replaceChildren(renderMetadataSummary(metadata));
      renderSmartSuggestions(smart, metadata, state.selections, refreshControls);
      renderVariableEditor(editor, metadata, state.selections, () => updateQuerySummary(page));
      updateQuerySummary(page);
      setActiveTab(page, state.activeView || 'chart');
    };

    refreshControls();
    runButton.disabled = false;
    await runCurrentQuery(page, context);
  } catch (error) {
    renderError(summary, error);
  }
}

function renderMetadataSummary(metadata) {
  const geoVariable = findGeoVariable(metadata);
  return html(`
    <article class="metadata-card elevated-card">
      <div class="table-badges">
        <span class="table-id">${escapeHtml(metadata.id)}</span>
        ${geoVariable ? '<span class="soft-badge">Kortdata</span>' : ''}
        ${metadata.active ? '<span class="soft-badge">Aktiv</span>' : '<span class="soft-badge">Inaktiv</span>'}
      </div>
      <h2>${escapeHtml(metadata.text)}</h2>
      <p>${escapeHtml(metadata.description)}</p>
      <dl>
        <div><dt>Enhed</dt><dd>${escapeHtml(metadata.unit || '-')}</dd></div>
        <div><dt>Opdateret</dt><dd>${escapeHtml(formatMetadataDate(metadata.updated))}</dd></div>
        <div><dt>Variable</dt><dd>${metadata.variables.length}</dd></div>
        <div><dt>Kort</dt><dd>${escapeHtml(geoVariable?.map || 'Ikke angivet')}</dd></div>
      </dl>
      ${metadata.documentation?.url ? `<a href="${escapeAttribute(metadata.documentation.url)}" target="_blank" rel="noreferrer">Dokumentation hos DST</a>` : ''}
    </article>
  `);
}

function renderSmartSuggestions(container, metadata, selections, onChange) {
  const geoVariable = findGeoVariable(metadata);
  const timeVariable = findTimeVariable(metadata);
  const smartFilters = metadata.variables.flatMap((variable) => smartButtonsForVariable(variable, selections));
  const hasSuggestions = geoVariable || timeVariable || smartFilters.length;

  if (!hasSuggestions) {
    container.replaceChildren();
    return;
  }

  const panel = html(`
    <article class="smart-panel">
      <div>
        <p class="eyebrow">Smartfiltre</p>
        <h3>Start med et godt udsnit</h3>
      </div>
      <div class="smart-action-grid"></div>
    </article>
  `);
  const grid = panel.querySelector('.smart-action-grid');

  if (geoVariable) {
    addSmartButton(grid, 'Største bykommuner', 'København, Aarhus, Odense og Aalborg', () => {
      selections[geoVariable.id] = ['101', '751', '461', '851'].filter((id) => geoVariable.values.some((value) => value.id === id));
      onChange();
    });

    addSmartButton(grid, 'Alle kommuner', 'God til kortvisning', () => {
      selections[geoVariable.id] = geoVariable.values
        .filter((value) => /^\d{3}$/.test(value.id) && !['000', '081', '082', '083', '084', '085'].includes(value.id))
        .map((value) => value.id);
      state.activeView = 'map';
      onChange();
    });

    addSmartButton(grid, 'Regioner', 'Fem regionale bobler', () => {
      selections[geoVariable.id] = ['084', '085', '083', '082', '081'].filter((id) => geoVariable.values.some((value) => value.id === id));
      state.activeView = 'map';
      onChange();
    });
  }

  if (timeVariable) {
    addSmartButton(grid, 'Seneste periode', 'Ét aktuelt tal', () => {
      selections[timeVariable.id] = timeVariable.values.slice(-1).map((value) => value.id);
      onChange();
    });

    addSmartButton(grid, 'Seneste 12 perioder', 'God til udvikling over tid', () => {
      selections[timeVariable.id] = timeVariable.values.slice(-12).map((value) => value.id);
      state.activeView = 'chart';
      onChange();
    });
  }

  smartFilters.forEach((button) => {
    addSmartButton(grid, button.label, button.description, () => {
      selections[button.variable.id] = button.values;
      onChange();
    });
  });

  container.replaceChildren(panel);
}

function renderVariableEditor(container, metadata, selections, onChange) {
  container.replaceChildren();

  metadata.variables.forEach((variable) => {
    const panel = html(`
      <details class="variable-panel" open>
        <summary>
          <span>
            <strong>${escapeHtml(variable.text)}</strong>
            <small>${escapeHtml(variable.id)}${variable.time ? ' · tid' : ''}${variable.map ? ` · ${escapeHtml(variable.map)}` : ''}${!variable.elimination ? ' · påkrævet' : ''}</small>
          </span>
          <em data-count>${(selections[variable.id] || []).length} valgt</em>
        </summary>
        <div class="selected-pill-row" data-selected-pills></div>
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
    const selectedPills = panel.querySelector('[data-selected-pills]');

    const renderSelected = () => {
      selectedPills.replaceChildren();
      (selections[variable.id] || []).slice(0, 8).forEach((id) => {
        const value = variable.values.find((item) => item.id === id);
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'selected-pill';
        pill.textContent = `${value?.text || id} ×`;
        pill.addEventListener('click', () => {
          selections[variable.id] = (selections[variable.id] || []).filter((selectedId) => selectedId !== id);
          renderValues();
          onChange();
        });
        selectedPills.append(pill);
      });

      if ((selections[variable.id] || []).length > 8) {
        const more = document.createElement('span');
        more.className = 'muted small';
        more.textContent = `+${selections[variable.id].length - 8} flere`;
        selectedPills.append(more);
      }
    };

    const renderValues = () => {
      const query = filter.value.trim().toLowerCase();
      const values = variable.values.filter((value) => {
        const text = `${value.id} ${value.text}`.toLowerCase();
        return !query || text.includes(query);
      }).slice(0, 180);

      count.textContent = `${(selections[variable.id] || []).length} valgt`;
      renderSelected();
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
          renderSelected();
          count.textContent = `${selections[variable.id].length} valgt`;
          onChange();
        });
        label.append(checkbox, text, code);
        valueList.append(label);
      });

      if (variable.values.length > 180 && !query) {
        const note = document.createElement('p');
        note.className = 'muted small';
        note.textContent = `Viser 180 af ${variable.values.length.toLocaleString('da-DK')} værdier. Brug søgning for flere.`;
        valueList.append(note);
      }
    };

    filter.addEventListener('input', renderValues);
    panel.querySelector('[data-select-total]').addEventListener('click', () => {
      const total = variable.values.find((value) => /(^TOT$|^IALT$|^000$|I alt|^000:)/i.test(`${value.id} ${value.text}`));
      selections[variable.id] = total ? [total.id] : [variable.values[0]?.id].filter(Boolean);
      renderValues();
      onChange();
    });
    panel.querySelector('[data-select-visible]').addEventListener('click', () => {
      const query = filter.value.trim().toLowerCase();
      const values = variable.values.filter((value) => {
        const text = `${value.id} ${value.text}`.toLowerCase();
        return !query || text.includes(query);
      }).slice(0, 90);
      selections[variable.id] = values.map((value) => value.id);
      renderValues();
      onChange();
    });
    panel.querySelector('[data-clear]').addEventListener('click', () => {
      selections[variable.id] = [];
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

async function runCurrentQuery(page, context) {
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
    setActiveTab(page, state.activeView || 'chart');
    toast(context.toastRegion, 'Data er hentet og visualiseret.');
  } catch (error) {
    renderError(chartOutput, error);
  }
}

function setActiveTab(page, tabName) {
  page.querySelectorAll('.tab').forEach((tab) => {
    tab.classList.toggle('is-active', tab.dataset.tab === tabName);
  });
  page.querySelectorAll('[data-output]').forEach((output) => {
    output.classList.toggle('is-hidden', output.dataset.output !== tabName);
  });
}

function smartButtonsForVariable(variable) {
  return SMART_VALUE_FILTERS
    .filter((filter) => filter.variablePattern.test(`${variable.id} ${variable.text}`))
    .map((filter) => {
      const values = variable.values
        .filter((value) => filter.keywords.some((keyword) => value.text.toLowerCase().includes(keyword)))
        .slice(0, 10)
        .map((value) => value.id);

      return values.length ? {
        label: filter.label,
        description: `${values.length} matchende værdier`,
        variable,
        values,
      } : null;
    })
    .filter(Boolean);
}

function addSmartButton(container, label, description, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'smart-button';
  button.innerHTML = `<strong>${escapeHtml(label)}</strong><span>${escapeHtml(description)}</span>`;
  button.addEventListener('click', onClick);
  container.append(button);
}

function formatMetadataDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('da-DK', { dateStyle: 'medium' }).format(date);
}
