const SVG_NS = 'http://www.w3.org/2000/svg';

export function renderChart(container, parsed, options = {}) {
  container.replaceChildren();

  const chartState = prepareChartState(parsed, options);
  if (!chartState.rows.length) {
    renderEmpty(container, 'Der er ingen observationer i det valgte udtræk.');
    return;
  }

  if (chartState.kind === 'line') {
    renderLineChart(container, chartState);
    return;
  }

  renderBarChart(container, chartState);
}

export function renderTable(container, parsed, maxRows = 200) {
  container.replaceChildren();

  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'data-table';

  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  parsed.dimensions.forEach((dimension) => {
    const th = document.createElement('th');
    th.textContent = dimension.label;
    headerRow.append(th);
  });

  const valueHeader = document.createElement('th');
  valueHeader.textContent = parsed.unit ? `Værdi (${parsed.unit})` : 'Værdi';
  headerRow.append(valueHeader);
  thead.append(headerRow);

  const tbody = document.createElement('tbody');
  parsed.rows.slice(0, maxRows).forEach((row) => {
    const tr = document.createElement('tr');

    parsed.dimensions.forEach((dimension) => {
      const td = document.createElement('td');
      td.textContent = row.fields[dimension.id] || row.codes[dimension.id] || '';
      tr.append(td);
    });

    const valueCell = document.createElement('td');
    valueCell.className = 'number-cell';
    valueCell.textContent = formatNumber(row.value, parsed.decimals);
    tr.append(valueCell);
    tbody.append(tr);
  });

  table.append(thead, tbody);
  wrapper.append(table);

  if (parsed.rows.length > maxRows) {
    const note = document.createElement('p');
    note.className = 'muted small';
    note.textContent = `Viser de første ${maxRows.toLocaleString('da-DK')} af ${parsed.rows.length.toLocaleString('da-DK')} rækker. Download CSV for hele udtrækket.`;
    wrapper.append(note);
  }

  container.append(wrapper);
}

export function toCsv(parsed) {
  const header = [...parsed.dimensions.map((dimension) => dimension.label), 'Værdi'];
  const lines = [header.map(csvEscape).join(';')];

  parsed.rows.forEach((row) => {
    const cells = parsed.dimensions.map((dimension) => row.fields[dimension.id] || row.codes[dimension.id] || '');
    cells.push(row.value ?? '');
    lines.push(cells.map(csvEscape).join(';'));
  });

  return lines.join('\n');
}

export function downloadText(filename, text, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function formatNumber(value, decimals = null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Ingen data';
  }

  const options = Number.isInteger(decimals)
    ? { maximumFractionDigits: decimals, minimumFractionDigits: Math.min(decimals, 2) }
    : { maximumFractionDigits: 2 };

  return new Intl.NumberFormat('da-DK', options).format(value);
}

function prepareChartState(parsed, options) {
  const timeDimension = parsed.dimensions.find((dimension) => dimension.role === 'time')
    || parsed.dimensions.find((dimension) => /tid|time/i.test(dimension.id));
  const metricDimension = parsed.dimensions.find((dimension) => dimension.role === 'metric');
  const candidateSeries = parsed.dimensions.find((dimension) => (
    dimension.id !== timeDimension?.id
    && dimension.id !== metricDimension?.id
    && uniqueCodes(parsed.rows, dimension.id).length > 1
  ));

  if (timeDimension) {
    return {
      kind: 'line',
      parsed,
      rows: parsed.rows.filter((row) => row.value !== null),
      timeDimension,
      seriesDimension: candidateSeries,
      decimals: parsed.decimals,
      unit: parsed.unit,
      title: options.title || parsed.label,
    };
  }

  const categoryDimension = candidateSeries
    || parsed.dimensions.find((dimension) => dimension.id !== metricDimension?.id)
    || parsed.dimensions[0];

  return {
    kind: 'bar',
    parsed,
    rows: parsed.rows.filter((row) => row.value !== null).slice(0, 24),
    categoryDimension,
    decimals: parsed.decimals,
    unit: parsed.unit,
    title: options.title || parsed.label,
  };
}

function renderLineChart(container, state) {
  const { rows, timeDimension, seriesDimension, decimals, unit } = state;
  const width = 960;
  const height = 460;
  const padding = { top: 42, right: 28, bottom: 72, left: 78 };
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
  const plot = {
    x: padding.left,
    y: padding.top,
    width: width - padding.left - padding.right,
    height: height - padding.top - padding.bottom,
  };

  const times = uniqueCodes(rows, timeDimension.id);
  const seriesCodes = seriesDimension ? uniqueCodes(rows, seriesDimension.id).slice(0, 10) : ['__single'];
  const values = rows.map((row) => row.value).filter(Number.isFinite);
  const [minValue, maxValue] = extent(values);
  const yMin = Math.min(0, minValue);
  const yMax = maxValue === yMin ? yMin + 1 : maxValue;
  const colors = ['#123c2f', '#e66037', '#236d82', '#b88a2a', '#774936', '#5a7f35', '#0f5f78', '#9b4055', '#4a4e69', '#a15c38'];

  svg.append(grid(plot, 5));
  svg.append(axisLeft(plot, yMin, yMax, decimals, unit));
  svg.append(axisBottom(plot, times.map((code) => state.parsed.dimensions.find((dimension) => dimension.id === timeDimension.id)?.labels?.[code] || code)));

  seriesCodes.forEach((seriesCode, seriesIndex) => {
    const points = times.map((timeCode, timeIndex) => {
      const row = rows.find((candidate) => {
        const sameTime = candidate.codes[timeDimension.id] === timeCode;
        const sameSeries = !seriesDimension || candidate.codes[seriesDimension.id] === seriesCode;
        return sameTime && sameSeries;
      });
      if (!row || row.value === null) return null;

      return {
        x: plot.x + (times.length === 1 ? plot.width / 2 : (timeIndex / (times.length - 1)) * plot.width),
        y: plot.y + plot.height - scale(row.value, yMin, yMax, plot.height),
        row,
      };
    }).filter(Boolean);

    const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
    svg.append(svgElement('path', {
      d: path,
      fill: 'none',
      stroke: colors[seriesIndex % colors.length],
      'stroke-width': 4,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    }));

    points.forEach((point) => {
      const circle = svgElement('circle', {
        cx: point.x,
        cy: point.y,
        r: 5,
        fill: colors[seriesIndex % colors.length],
      });
      circle.append(svgElement('title', {}, tooltipForRow(state.parsed, point.row)));
      svg.append(circle);
    });
  });

  container.append(svg, legendForSeries(state, seriesCodes, colors));
}

function renderBarChart(container, state) {
  const { rows, categoryDimension, decimals, unit } = state;
  const width = 960;
  const height = 460;
  const padding = { top: 42, right: 24, bottom: 94, left: 78 };
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img' });
  const plot = {
    x: padding.left,
    y: padding.top,
    width: width - padding.left - padding.right,
    height: height - padding.top - padding.bottom,
  };
  const values = rows.map((row) => row.value).filter(Number.isFinite);
  const [minValue, maxValue] = extent(values);
  const yMin = Math.min(0, minValue);
  const yMax = maxValue === yMin ? yMin + 1 : maxValue;
  const barGap = 10;
  const barWidth = Math.max(8, (plot.width - barGap * (rows.length - 1)) / rows.length);

  svg.append(grid(plot, 5));
  svg.append(axisLeft(plot, yMin, yMax, decimals, unit));

  rows.forEach((row, index) => {
    const barHeight = scale(row.value, yMin, yMax, plot.height);
    const x = plot.x + index * (barWidth + barGap);
    const y = plot.y + plot.height - barHeight;
    const rect = svgElement('rect', {
      x,
      y,
      width: barWidth,
      height: Math.max(2, barHeight),
      rx: 9,
      fill: index % 2 ? '#e66037' : '#123c2f',
    });
    rect.append(svgElement('title', {}, tooltipForRow(state.parsed, row)));
    svg.append(rect);

    const label = row.fields[categoryDimension.id] || row.codes[categoryDimension.id];
    const text = svgElement('text', {
      x: x + barWidth / 2,
      y: plot.y + plot.height + 24,
      'text-anchor': 'end',
      transform: `rotate(-38 ${x + barWidth / 2} ${plot.y + plot.height + 24})`,
      class: 'chart-axis-label',
    }, shorten(label, 16));
    svg.append(text);
  });

  container.append(svg);
}

function axisLeft(plot, min, max, decimals, unit) {
  const group = svgElement('g');
  const ticks = 5;

  for (let index = 0; index <= ticks; index += 1) {
    const value = min + ((max - min) * index) / ticks;
    const y = plot.y + plot.height - scale(value, min, max, plot.height);
    group.append(svgElement('text', {
      x: plot.x - 14,
      y: y + 5,
      'text-anchor': 'end',
      class: 'chart-axis-label',
    }, formatNumber(value, decimals)));
  }

  if (unit) {
    group.append(svgElement('text', {
      x: plot.x,
      y: 22,
      class: 'chart-unit-label',
    }, unit));
  }

  return group;
}

function axisBottom(plot, labels) {
  const group = svgElement('g');
  labels.forEach((label, index) => {
    const x = plot.x + (labels.length === 1 ? plot.width / 2 : (index / (labels.length - 1)) * plot.width);
    group.append(svgElement('text', {
      x,
      y: plot.y + plot.height + 28,
      'text-anchor': 'middle',
      class: 'chart-axis-label',
    }, label));
  });
  return group;
}

function grid(plot, ticks) {
  const group = svgElement('g');
  for (let index = 0; index <= ticks; index += 1) {
    const y = plot.y + (plot.height * index) / ticks;
    group.append(svgElement('line', {
      x1: plot.x,
      x2: plot.x + plot.width,
      y1: y,
      y2: y,
      class: 'chart-grid-line',
    }));
  }
  return group;
}

function legendForSeries(state, seriesCodes, colors) {
  if (!state.seriesDimension) {
    return document.createElement('span');
  }

  const legend = document.createElement('div');
  legend.className = 'chart-legend';
  seriesCodes.forEach((code, index) => {
    const item = document.createElement('span');
    item.className = 'legend-item';
    item.innerHTML = `<span style="--legend-color: ${colors[index % colors.length]}"></span>${state.seriesDimension.labels?.[code] || code}`;
    legend.append(item);
  });
  return legend;
}

function renderEmpty(container, message) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';
  empty.textContent = message;
  container.append(empty);
}

function scale(value, min, max, size) {
  if (max === min) return size / 2;
  return ((value - min) / (max - min)) * size;
}

function extent(values) {
  if (!values.length) {
    return [0, 1];
  }
  return [Math.min(...values), Math.max(...values)];
}

function uniqueCodes(rows, dimensionId) {
  return [...new Set(rows.map((row) => row.codes[dimensionId]).filter(Boolean))];
}

function tooltipForRow(parsed, row) {
  const pieces = parsed.dimensions.map((dimension) => `${dimension.label}: ${row.fields[dimension.id] || row.codes[dimension.id]}`);
  pieces.push(`Værdi: ${formatNumber(row.value, parsed.decimals)} ${parsed.unit || ''}`.trim());
  return pieces.join('\n');
}

function shorten(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (/[;"\n]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }
  return stringValue;
}

function svgElement(tag, attributes = {}, text = null) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text !== null) {
    element.textContent = text;
  }
  return element;
}
