export function html(markup) {
  const template = document.createElement('template');
  template.innerHTML = markup.trim();
  return template.content.firstElementChild;
}

export function pageHeader(title, subtitle, actionHtml = '') {
  return html(`
    <section class="page-header">
      <p class="eyebrow">Talrum</p>
      <div class="page-header-grid">
        <div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        ${actionHtml}
      </div>
    </section>
  `);
}

export function loading(label = 'Henter friske tal...') {
  return html(`
    <div class="loading-card">
      <span class="loader"></span>
      <span>${escapeHtml(label)}</span>
    </div>
  `);
}

export function renderError(container, error, title = 'Der opstod en fejl') {
  container.replaceChildren(html(`
    <div class="error-card">
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(error?.message || error || 'Ukendt fejl')}</p>
    </div>
  `));
}

export function toast(region, message) {
  const item = document.createElement('div');
  item.className = 'toast';
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 3200);
}

export function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('da-DK', { dateStyle: 'medium' }).format(date);
}

export function debounce(callback, wait = 180) {
  let timeout = null;
  return (...args) => {
    window.clearTimeout(timeout);
    timeout = window.setTimeout(() => callback(...args), wait);
  };
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function escapeAttribute(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

export function setText(element, value) {
  if (element) {
    element.textContent = value;
  }
}
