import { chooseTable } from '../core/state.js';
import { escapeHtml, formatDate, html } from '../core/dom.js';
import { presetForTable } from '../data/presets.js';
import { isMapReadyTable } from '../data/search.js';

export function renderTableCards(container, tables, options = {}) {
  const {
    limit = 90,
    emptyText = 'Ingen tabeller matcher filtrene endnu.',
  } = options;

  container.replaceChildren();

  if (!tables.length) {
    container.append(html(`
      <div class="empty-state">
        <strong>Ingen resultater</strong>
        <span>${escapeHtml(emptyText)}</span>
      </div>
    `));
    return;
  }

  const list = document.createElement('div');
  list.className = 'table-card-list';

  tables.slice(0, limit).forEach((table) => {
    const mapReady = isMapReadyTable(table);
    const card = html(`
      <article class="table-card upgraded-card">
        <div class="table-main">
          <div class="table-badges">
            <span class="table-id">${escapeHtml(table.id)}</span>
            ${mapReady ? '<span class="soft-badge">Kortklar</span>' : ''}
            ${table.latestPeriod ? `<span class="soft-badge">${escapeHtml(table.latestPeriod)}</span>` : ''}
          </div>
          <h3>${escapeHtml(table.text)}</h3>
          <p>${escapeHtml(table.variables?.join(' · ') || 'Ingen variable oplyst')}</p>
        </div>
        <div class="table-meta">
          <span>${escapeHtml(table.unit || '-')}</span>
          <span>${formatDate(table.updated)}</span>
          <div class="table-actions">
            ${mapReady ? '<button class="button ghost compact" data-map type="button">Kort</button>' : ''}
            <button class="button compact" data-open type="button">Åbn</button>
          </div>
        </div>
      </article>
    `);

    card.querySelector('[data-open]').addEventListener('click', () => {
      chooseTable(table.id, presetForTable(table.id), 'chart');
      location.hash = '#/byg';
    });

    card.querySelector('[data-map]')?.addEventListener('click', () => {
      chooseTable(table.id, presetForTable(table.id), 'map');
      location.hash = '#/byg';
    });

    list.append(card);
  });

  container.append(list);

  if (tables.length > limit) {
    const note = document.createElement('p');
    note.className = 'muted small';
    note.textContent = `Viser de første ${limit.toLocaleString('da-DK')} af ${tables.length.toLocaleString('da-DK')} resultater. Brug søgning eller filtre for at indsnævre.`;
    container.append(note);
  }
}
