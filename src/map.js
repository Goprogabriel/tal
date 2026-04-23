import { getGeoCenters } from './statbank.js';
import { formatNumber } from './charts.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const REGION_CODE_MAP = {
  '081': '1081',
  '082': '1082',
  '083': '1083',
  '084': '1084',
  '085': '1085',
};

export async function renderGeoMap(container, parsed) {
  container.replaceChildren();

  const geoDimension = parsed.dimensions.find((dimension) => dimension.role === 'geo')
    || parsed.dimensions.find((dimension) => /område|kommune|region/i.test(dimension.label));
  const timeDimension = parsed.dimensions.find((dimension) => dimension.role === 'time');
  const metricDimension = parsed.dimensions.find((dimension) => dimension.role === 'metric');

  if (!geoDimension) {
    renderMapMessage(container, 'Det valgte datasæt har ikke en geografisk dimension, som kan tegnes på kort.');
    return;
  }

  const blockingDimensions = parsed.dimensions.filter((dimension) => (
    dimension.id !== geoDimension.id
    && dimension.id !== timeDimension?.id
    && dimension.id !== metricDimension?.id
    && uniqueCodes(parsed.rows, dimension.id).length > 1
  ));

  if (blockingDimensions.length) {
    renderMapMessage(
      container,
      `Kortet kræver én værdi for øvrige variable. Begræns: ${blockingDimensions.map((dimension) => dimension.label).join(', ')}.`
    );
    return;
  }

  const latestTime = timeDimension ? uniqueCodes(parsed.rows, timeDimension.id).at(-1) : null;
  const mapRows = parsed.rows.filter((row) => (
    row.value !== null
    && (!latestTime || row.codes[timeDimension.id] === latestTime)
    && row.codes[geoDimension.id] !== '000'
  ));

  if (!mapRows.length) {
    renderMapMessage(container, 'Der er ingen geografiske observationer at vise for den valgte periode.');
    return;
  }

  const [municipalities, regions] = await Promise.all([
    getGeoCenters('municipality').catch(() => []),
    getGeoCenters('region').catch(() => []),
  ]);

  const centers = buildCenterIndex(municipalities, regions);
  const points = mapRows
    .map((row) => {
      const code = row.codes[geoDimension.id];
      const center = centers.get(normalizeGeoCode(code)) || centers.get(code);
      if (!center) return null;

      return {
        code,
        label: row.fields[geoDimension.id] || code,
        value: row.value,
        row,
        x: center.x,
        y: center.y,
      };
    })
    .filter(Boolean);

  if (!points.length) {
    renderMapMessage(container, 'Jeg kunne ikke matche de valgte geografikoder med kommune- eller regionscentre.');
    return;
  }

  drawBubbleMap(container, points, parsed, latestTime ? parsed.dimensions.find((dimension) => dimension.id === timeDimension.id)?.labels?.[latestTime] || latestTime : null);
}

function drawBubbleMap(container, points, parsed, timeLabel) {
  const width = 760;
  const height = 720;
  const padding = 56;
  const svg = svgElement('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', class: 'bubble-map' });
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const bounds = {
    minX: Math.min(...points.map((point) => point.x), 8.0),
    maxX: Math.max(...points.map((point) => point.x), 15.3),
    minY: Math.min(...points.map((point) => point.y), 54.5),
    maxY: Math.max(...points.map((point) => point.y), 57.8),
  };

  svg.append(svgElement('rect', {
    x: 0,
    y: 0,
    width,
    height,
    rx: 32,
    fill: '#dff3ee',
  }));

  svg.append(svgElement('path', {
    d: 'M136 132 C214 55 357 58 428 127 C487 183 491 259 565 312 C650 372 638 485 562 545 C493 601 399 574 325 628 C237 690 116 621 118 506 C120 420 68 383 82 292 C91 232 97 174 136 132Z',
    fill: '#f7edd8',
    stroke: '#c2d2c8',
    'stroke-width': 2,
    opacity: 0.86,
  }));

  svg.append(svgElement('text', {
    x: padding,
    y: 44,
    class: 'map-title',
  }, timeLabel ? `Kortvisning for ${timeLabel}` : 'Kortvisning'));

  svg.append(svgElement('text', {
    x: padding,
    y: 68,
    class: 'map-subtitle',
  }, parsed.unit ? `Boblernes størrelse viser ${parsed.unit}` : 'Boblernes størrelse viser værdien'));

  points
    .sort((left, right) => right.value - left.value)
    .forEach((point) => {
      const projected = project(point, bounds, width, height, padding);
      const radius = 7 + scale(point.value, min, max, 30);
      const fill = colorScale(point.value, min, max);
      const circle = svgElement('circle', {
        cx: projected.x,
        cy: projected.y,
        r: radius,
        fill,
        stroke: '#102c26',
        'stroke-width': 1.2,
        opacity: 0.86,
      });
      circle.append(svgElement('title', {}, `${point.label}\n${formatNumber(point.value, parsed.decimals)} ${parsed.unit || ''}`.trim()));
      svg.append(circle);

      if (radius > 18 || points.length <= 12) {
        svg.append(svgElement('text', {
          x: projected.x,
          y: projected.y - radius - 7,
          'text-anchor': 'middle',
          class: 'map-point-label',
        }, shorten(point.label.replace(/\s*\(.+\)$/, ''), 14)));
      }
    });

  const legend = document.createElement('div');
  legend.className = 'map-legend';
  legend.innerHTML = `
    <span><i style="--swatch:#f9c66b"></i>Lavere</span>
    <span><i style="--swatch:#e66037"></i>Højere</span>
    <span>${points.length.toLocaleString('da-DK')} steder matchet</span>
  `;

  const note = document.createElement('p');
  note.className = 'muted small';
  note.textContent = 'Kortet bruger officielle visuelle centre fra Dataforsyningen. Det er hurtigt og let at læse, men ikke et polygon-koropletkort.';

  container.append(svg, legend, note);
}

function buildCenterIndex(municipalities, regions) {
  const centers = new Map();

  municipalities.forEach((item) => {
    const threeDigitCode = String(item.kode).slice(-3);
    centers.set(threeDigitCode, {
      x: item.visueltcenter_x,
      y: item.visueltcenter_y,
      label: item.navn,
    });
  });

  regions.forEach((item) => {
    const statbankRegionCode = Object.entries(REGION_CODE_MAP).find(([, dawaCode]) => dawaCode === String(item.kode))?.[0];
    if (statbankRegionCode) {
      centers.set(statbankRegionCode, {
        x: item.visueltcenter_x,
        y: item.visueltcenter_y,
        label: item.navn,
      });
    }
  });

  return centers;
}

function normalizeGeoCode(code) {
  return REGION_CODE_MAP[code] || String(code).padStart(3, '0').slice(-3);
}

function project(point, bounds, width, height, padding) {
  const x = padding + ((point.x - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * (width - padding * 2);
  const y = height - padding - ((point.y - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * (height - padding * 2);
  return { x, y };
}

function scale(value, min, max, size) {
  if (max === min) return size / 2;
  return ((value - min) / (max - min)) * size;
}

function colorScale(value, min, max) {
  const ratio = max === min ? 0.5 : (value - min) / (max - min);
  const hue = 42 - ratio * 28;
  const saturation = 82 - ratio * 12;
  const lightness = 68 - ratio * 16;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function uniqueCodes(rows, dimensionId) {
  return [...new Set(rows.map((row) => row.codes[dimensionId]).filter(Boolean))];
}

function renderMapMessage(container, message) {
  const empty = document.createElement('div');
  empty.className = 'empty-state map-empty';
  empty.innerHTML = `<strong>Kortvisning</strong><span>${message}</span>`;
  container.append(empty);
}

function shorten(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function svgElement(tag, attributes = {}, text = null) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text !== null) {
    element.textContent = text;
  }
  return element;
}
