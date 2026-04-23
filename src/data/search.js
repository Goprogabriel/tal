import { TOPIC_FILTERS, topicById } from './presets.js';

const MAP_VARIABLE_TERMS = ['område', 'kommune', 'region', 'landsdel', 'sogn', 'postnummer', 'postnumre'];

export function filterTables(tables, filters) {
  const topic = topicById(filters.topic);
  const query = [filters.query, topic?.query].filter(Boolean).join(' ');
  const scored = tables
    .map((table) => ({
      table,
      score: scoreTable(table, query, topic),
      mapReady: isMapReadyTable(table),
    }))
    .filter((entry) => {
      if (filters.mapOnly || topic?.mapOnly) {
        return entry.mapReady;
      }

      if (topic?.tableIds?.includes(entry.table.id)) {
        return true;
      }

      return query.trim() ? entry.score > 0 : true;
    });

  scored.sort((left, right) => {
    if (filters.sort === 'updated') {
      return new Date(right.table.updated || 0) - new Date(left.table.updated || 0);
    }

    if (filters.sort === 'map') {
      return Number(right.mapReady) - Number(left.mapReady) || right.score - left.score;
    }

    return right.score - left.score
      || Number(right.mapReady) - Number(left.mapReady)
      || new Date(right.table.updated || 0) - new Date(left.table.updated || 0);
  });

  return scored.map((entry) => entry.table);
}

export function scoreTable(table, query = '', topic = null) {
  const text = searchableText(table);
  const tokens = tokenize(query);
  let score = 0;

  if (topic?.tableIds?.includes(table.id)) {
    score += 80;
  }

  if (!tokens.length) {
    return score + (isMapReadyTable(table) ? 3 : 0);
  }

  tokens.forEach((token) => {
    if (normalize(table.id) === token) score += 60;
    if (normalize(table.id).includes(token)) score += 30;
    if (text.includes(token)) score += 12;
  });

  return score;
}

export function isMapReadyTable(table) {
  const variables = (table.variables || []).map(normalize);
  return variables.some((variable) => MAP_VARIABLE_TERMS.some((term) => variable.includes(normalize(term))));
}

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function searchableText(table) {
  const topicAliases = TOPIC_FILTERS
    .filter((topic) => topic.tableIds?.includes(table.id))
    .map((topic) => `${topic.label} ${topic.description} ${topic.query}`)
    .join(' ');

  const semanticAliases = table.id.startsWith('STRAF') || table.id.startsWith('LIGEP')
    ? 'kriminalitet vold forbrydelse forbrydelser straf straffe offer ofre sigtelser domme politi anmeldte anmeldelser personfarlig'
    : '';

  return normalize([
    table.id,
    table.text,
    table.unit,
    table.firstPeriod,
    table.latestPeriod,
    ...(table.variables || []),
    topicAliases,
    semanticAliases,
  ].join(' '));
}

function tokenize(query) {
  return normalize(query)
    .split(/[^a-z0-9]+/i)
    .filter((token) => token.length > 1);
}
