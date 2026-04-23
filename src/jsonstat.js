const TOTAL_VALUE_IDS = new Set(['TOT', 'IALT', '000', '00', '0', 'I ALT', 'TOTAL']);

export function parseJsonStat(response) {
  const dataset = response?.dataset || response;
  const dimensionRoot = dataset?.dimension || {};
  const ids = dataset?.id || dimensionRoot.id;
  const sizes = dataset?.size || dimensionRoot.size;
  const roles = dataset?.role || dimensionRoot.role || {};

  if (!dataset?.dimension || !Array.isArray(ids) || !Array.isArray(sizes)) {
    throw new Error('JSON-stat svaret mangler dimensioner, id eller size.');
  }

  const dimensions = ids.map((id, dimensionIndex) => {
    const dimension = dimensionRoot[id] || {};
    const category = dimension.category || {};
    const index = category.index || {};
    const labels = category.label || {};
    const orderedCodes = codesByIndex(index);

    return {
      id,
      label: dimension.label || id,
      size: sizes[dimensionIndex],
      codes: orderedCodes,
      labels,
      unit: category.unit || null,
      role: roleForDimension(roles, id),
    };
  });

  const values = Array.isArray(dataset.value)
    ? dataset.value
    : objectValuesToArray(dataset.value || {}, sizes.reduce((product, size) => product * size, 1));

  const rows = values.map((value, flatIndex) => {
    const coordinates = coordinatesFromFlatIndex(flatIndex, sizes);
    const fields = {};
    const codes = {};

    dimensions.forEach((dimension, dimensionIndex) => {
      const code = dimension.codes[coordinates[dimensionIndex]];
      codes[dimension.id] = code;
      fields[dimension.id] = dimension.labels?.[code] || code;
    });

    return {
      flatIndex,
      value: normalizeStatValue(value),
      fields,
      codes,
    };
  });

  return {
    label: dataset.label || '',
    source: dataset.source || 'Danmarks Statistik',
    updated: dataset.updated || null,
    dimensions,
    rows,
    roles,
    tableId: dataset.extension?.px?.tableid || null,
    decimals: dataset.extension?.px?.decimals ?? null,
    unit: findUnit(dimensions),
  };
}

export function buildRequestVariables(metadata, selections) {
  return metadata.variables
    .map((variable) => {
      const hasSelection = Object.hasOwn(selections, variable.id);
      const selected = hasSelection ? selections[variable.id] : defaultValuesForVariable(variable);
      return {
        code: variable.id,
        values: selected,
      };
    })
    .filter((variable) => variable.values.length > 0);
}

export function defaultSelectionsFor(metadata, preset = null) {
  const selections = {};

  metadata.variables.forEach((variable) => {
    if (preset?.variables?.[variable.id]) {
      selections[variable.id] = preset.variables[variable.id];
      return;
    }

    selections[variable.id] = defaultValuesForVariable(variable);
  });

  return selections;
}

export function estimateCellCount(metadata, selections) {
  const selectedCounts = metadata.variables.map((variable) => {
    const hasSelection = Object.hasOwn(selections, variable.id);
    const selected = hasSelection ? selections[variable.id] : defaultValuesForVariable(variable);

    if (!selected.length && !variable.elimination) {
      return 0;
    }

    return Math.max(selected.length, 1);
  });
  const rowCount = selectedCounts.reduce((product, count) => product * count, 1);

  return {
    rowCount,
    cellCount: rowCount * (metadata.variables.length + 1),
  };
}

export function isTotalValue(value) {
  const text = `${value.id} ${value.text}`.toUpperCase();
  return TOTAL_VALUE_IDS.has(value.id?.toUpperCase?.()) || /\bI ALT\b|\bTOTAL\b/.test(text);
}

export function findTimeVariable(metadata) {
  return metadata.variables.find((variable) => variable.time || variable.id.toLowerCase() === 'tid');
}

export function findGeoVariable(metadata) {
  return metadata.variables.find((variable) => variable.map)
    || metadata.variables.find((variable) => /område|kommune|region/i.test(variable.text));
}

export function selectedValueLabels(metadata, selections, max = 3) {
  return metadata.variables.map((variable) => {
    const selected = selections[variable.id] || [];
    const labels = selected
      .map((id) => variable.values.find((value) => value.id === id)?.text || id)
      .slice(0, max);
    const suffix = selected.length > max ? ` +${selected.length - max}` : '';
    return `${variable.text}: ${labels.join(', ')}${suffix}`;
  });
}

export function missingRequiredSelections(metadata, selections) {
  return metadata.variables.filter((variable) => {
    const selected = selections[variable.id] || [];
    return !variable.elimination && !selected.length;
  });
}

function defaultValuesForVariable(variable) {
  if (variable.time) {
    return variable.values.slice(-12).map((value) => value.id);
  }

  const total = variable.values.find(isTotalValue);
  if (total) {
    return [total.id];
  }

  if (variable.map && variable.values.some((value) => value.id === '000')) {
    return ['000'];
  }

  return variable.elimination ? [] : [variable.values[0]?.id].filter(Boolean);
}

function codesByIndex(index) {
  if (Array.isArray(index)) {
    return index;
  }

  return Object.entries(index)
    .sort((left, right) => left[1] - right[1])
    .map(([code]) => code);
}

function roleForDimension(roles, id) {
  return Object.entries(roles || {}).find(([, ids]) => ids.includes(id))?.[0] || null;
}

function objectValuesToArray(values, size) {
  const result = Array.from({ length: size }, () => null);
  Object.entries(values).forEach(([index, value]) => {
    result[Number(index)] = value;
  });
  return result;
}

function coordinatesFromFlatIndex(index, sizes) {
  const coordinates = Array.from({ length: sizes.length }, () => 0);
  let remainder = index;

  for (let position = sizes.length - 1; position >= 0; position -= 1) {
    coordinates[position] = remainder % sizes[position];
    remainder = Math.floor(remainder / sizes[position]);
  }

  return coordinates;
}

function normalizeStatValue(value) {
  if (value === '..' || value === ':' || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function findUnit(dimensions) {
  const metricDimension = dimensions.find((dimension) => dimension.role === 'metric')
    || dimensions.find((dimension) => dimension.unit);
  const firstUnit = metricDimension?.unit && Object.values(metricDimension.unit)[0];
  return firstUnit?.base || '';
}
