import { FEATURED_TABLES } from '../data/presets.js';

export const state = {
  route: '/',
  subjects: [],
  selectedSubject: null,
  allTables: [],
  tables: [],
  tableSourceLabel: 'Alle tabeller',
  currentTableId: 'FOLK1A',
  currentMetadata: null,
  selections: {},
  currentParsed: null,
  currentPreset: FEATURED_TABLES[0],
  activeView: 'chart',
  exploreFilters: {
    query: '',
    topic: null,
    mapOnly: false,
    sort: 'relevance',
  },
};

export function chooseTable(tableId, preset = null, activeView = 'chart') {
  state.currentTableId = tableId.trim().toUpperCase();
  state.currentPreset = preset;
  state.activeView = activeView;
}
