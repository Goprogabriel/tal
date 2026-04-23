const API_ROOT = 'https://api.statbank.dk/v1';
const DATAFORSYNING_ROOT = 'https://api.dataforsyningen.dk';

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
};

const cache = new Map();

function cacheKey(endpoint, payload) {
  return `${endpoint}:${JSON.stringify(payload)}`;
}

export async function postStatbank(endpoint, payload = {}) {
  const normalizedPayload = {
    lang: 'da',
    format: 'JSON',
    ...payload,
  };
  const key = cacheKey(endpoint, normalizedPayload);

  if (cache.has(key)) {
    return cache.get(key);
  }

  const request = fetch(`${API_ROOT}/${endpoint}`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(normalizedPayload),
  }).then(async (response) => {
    const text = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const looksJson = contentType.includes('json') || text.trim().startsWith('{') || text.trim().startsWith('[');
    const payload = looksJson ? safeParseJson(text) : text;

    if (!response.ok || payload?.errorTypeCode) {
      const message = payload?.message || response.statusText || 'Ukendt API-fejl';
      throw new Error(message);
    }

    return payload;
  });

  cache.set(key, request);
  return request;
}

export function getSubjects(options = {}) {
  return postStatbank('subjects', {
    includeTables: false,
    omitInactiveSubjects: true,
    ...options,
  });
}

export function getTables(options = {}) {
  return postStatbank('tables', {
    includeInactive: false,
    ...options,
  });
}

export function getTableInfo(table) {
  return postStatbank('tableinfo', {
    table: table.trim().toUpperCase(),
  });
}

export function getJsonStatData(table, variables, options = {}) {
  return postStatbank('data', {
    table: table.trim().toUpperCase(),
    format: 'JSONSTAT',
    valuePresentation: 'CodeAndValue',
    timeOrder: 'Ascending',
    variables,
    ...options,
  });
}

export async function getGeoCenters(kind) {
  const endpoint = kind === 'region'
    ? `${DATAFORSYNING_ROOT}/regioner?struktur=mini`
    : `${DATAFORSYNING_ROOT}/kommuner?struktur=mini`;
  const key = `geo:${kind}`;

  if (cache.has(key)) {
    return cache.get(key);
  }

  const request = fetch(endpoint).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Kunne ikke hente geografi fra Dataforsyningen (${response.status})`);
    }
    return response.json();
  });

  cache.set(key, request);
  return request;
}

export function clearApiCache() {
  cache.clear();
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`API'et svarede ikke med gyldig JSON: ${error.message}`);
  }
}
