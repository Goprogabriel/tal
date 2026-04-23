export const FEATURED_TABLES = [
  {
    id: 'FOLK1A',
    title: 'Befolkning på kort',
    description: 'Befolkningen pr. kvartal for hele landet og de største bykommuner.',
    accent: 'Borgere',
    view: 'map',
    variables: {
      'OMRÅDE': ['000', '101', '751', '461', '851'],
      'KØN': ['TOT'],
      'ALDER': ['IALT'],
      'CIVILSTAND': ['TOT'],
    },
  },
  {
    id: 'STRAF11',
    title: 'Vold og kriminalitet',
    description: 'Anmeldte forbrydelser efter område. Starter på voldsforbrydelser, klar til kort.',
    accent: 'Kriminalitet',
    view: 'map',
    variables: {
      'OMRÅDE': ['101', '751', '461', '851', '147', '157'],
      'OVERTRÆD': ['12'],
    },
  },
  {
    id: 'LIGEPB1',
    title: 'Ofre for personfarlig kriminalitet',
    description: 'Ofre fordelt på overtrædelse, alder, køn og tid.',
    accent: 'Tryghed',
    variables: {
      'OVERTRÆD': ['LS12'],
      'ALDER': ['TOT'],
      'KOEN': ['TOT'],
    },
  },
  {
    id: 'FVPANDEL',
    title: 'Folketingsvalg på tværs af landet',
    description: 'Partiernes stemmeandel efter område og tid.',
    accent: 'Valg',
    view: 'map',
  },
];

export const TOPIC_FILTERS = [
  {
    id: 'crime',
    label: 'Kriminalitet & vold',
    description: 'Anmeldelser, ofre, sigtelser, domme og straffe.',
    query: 'vold kriminalitet forbrydelser straf offer sigtelser domme anholdelser',
    tableIds: [
      'STRAF10',
      'STRAF11',
      'STRAF20',
      'STRAF22',
      'STRAF24',
      'STRAF44',
      'STRAF46',
      'STRAF47',
      'STRAF70',
      'LIGEPB1',
      'LIGEPB4',
      'LIGEPI1',
    ],
  },
  {
    id: 'maps',
    label: 'Kort-egnede data',
    description: 'Tabeller med område, kommune, region eller anden geografi.',
    query: 'område kommune region landsdel sogn postnummer kort',
    mapOnly: true,
  },
  {
    id: 'people',
    label: 'Borgere',
    description: 'Befolkning, alder, familie, flytninger og sundhed.',
    query: 'befolkning alder familie flytning sundhed fødte døde',
    tableIds: ['FOLK1A', 'FOLK1AM', 'BEFOLK1', 'GALDER', 'FOD', 'DOD'],
  },
  {
    id: 'money',
    label: 'Økonomi & indkomst',
    description: 'Indkomst, priser, skat, bolig og nationalregnskab.',
    query: 'indkomst økonomi skat priser løn bolig ejendom bnp',
  },
  {
    id: 'climate',
    label: 'Klima & energi',
    description: 'Energi, miljø, ressourcer, transport og emissioner.',
    query: 'klima miljø energi emission co2 transport affald',
  },
  {
    id: 'education',
    label: 'Uddannelse',
    description: 'Skole, uddannelse, elever, institutioner og gennemførsel.',
    query: 'uddannelse skole elever studerende ungdomsuddannelse',
  },
];

export const SMART_VALUE_FILTERS = [
  {
    id: 'violence',
    label: 'Vold',
    variablePattern: /overtræd|lovovertræd/i,
    keywords: ['vold', 'manddrab', 'trusler', 'personfarlig'],
  },
  {
    id: 'sexual',
    label: 'Seksualforbrydelser',
    variablePattern: /overtræd|lovovertræd/i,
    keywords: ['seksual', 'voldtægt', 'blufærdighed'],
  },
  {
    id: 'property',
    label: 'Tyveri og indbrud',
    variablePattern: /overtræd|lovovertræd/i,
    keywords: ['tyveri', 'indbrud', 'røveri', 'ejendom'],
  },
  {
    id: 'drugs',
    label: 'Narkotika',
    variablePattern: /overtræd|lovovertræd/i,
    keywords: ['narkotika', 'euforiserende'],
  },
];

export function presetForTable(tableId) {
  return FEATURED_TABLES.find((table) => table.id === tableId?.toUpperCase()) || null;
}

export function topicById(topicId) {
  return TOPIC_FILTERS.find((topic) => topic.id === topicId) || null;
}
