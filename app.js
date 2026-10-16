'use strict';
/* FloorLayout Explorer — table + visualization over FLOOR_DATA (see build_data.py). */

/* ============================ data ============================ */
const D = FLOOR_DATA;
const IDX = {};
D.fields.forEach((f, i) => { IDX[f] = i; });

const DUN = D.dungeons.map(d => ({
  id: d[0], folder: d[1], name: d[2], numFloors: d[3], mappa: d[4], startAfter: d[5],
}));
const DUN_BY_ID = new Map(DUN.map(d => [d.id, d]));
const ROWS = D.rows;
const N = ROWS.length;

const rowDungeon = r => DUN[ROWS[r][IDX.dungeon_idx]];
const rowVal = (r, key) => ROWS[r][IDX[key]];

/* ============================ helpers ============================ */
const $ = sel => document.querySelector(sel);
const esc = s => String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* ============================ columns ============================ */
const F = key => ({ key, get: r => rowVal(r, key), num: D.fieldKinds[key] === 'int' });

const COL_GROUPS = [
  { name: 'Dungeon / Floor', cls: 'g-df', cols: [
    { key: 'dungeon_id', label: 'dungeon_id', get: r => rowDungeon(r).id, num: true },
    { key: 'dungeon', label: 'dungeon', get: r => rowDungeon(r).name, num: false, text: true },
    F('floor'),
  ]},
  { name: 'FloorLayout', cls: 'g-fl', cols: [
    F('number'), F('structure'), F('tileset'), F('bgm'),
    F('weather'), F('fixed_floor_id'), F('darkness_level'),
  ]},
  { name: 'GeneratorSettings', cls: 'g-gen', cols: [
    F('room_density'), F('floor_connectivity'), F('initial_enemy_density'), F('dead_ends'),
    F('item_density'), F('trap_density'), F('extra_hallway_density'), F('buried_item_density'),
    F('water_density'), F('max_coin_amount'),
  ]},
  { name: 'Chances', cls: 'g-cha', cols: [
    F('shop'), F('monster_house'), F('unused'), F('sticky_item'),
    F('empty_monster_house'), F('hidden_stairs'),
  ]},
  { name: 'TerrainSettings', cls: 'g-ter', cols: [
    F('secondary_used'), F('secondary_percentage'), F('imperfect_rooms'),
    F('unk1'), F('unk3'), F('unk4'), F('unk5'), F('unk6'), F('unk7'),
  ]},
  { name: 'MiscSettings', cls: 'g-mis', cols: [
    F('unkE'), F('kecleon_shop_item_positions'), F('unk_hidden_stairs'),
    F('enemy_iq'), F('iq_booster_boost'),
  ]},
];

const ALL_COLS = [];
COL_GROUPS.forEach(g => g.cols.forEach(c => {
  c.group = g.name;
  if (!c.label) c.label = c.key;
  if (!c.text) c.text = false;
  c.ci = ALL_COLS.length;
  ALL_COLS.push(c);
}));

/* ============================ dungeon filter ============================ */
const STORAGE_KEY = 'sky-layouts.enabledDungeons.v1';
let enabledDungeons = new Set(DUN.map(d => d.id));

function loadEnabledDungeons() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === 'ALL') return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) enabledDungeons = new Set(arr.filter(id => DUN_BY_ID.has(id)));
  } catch (e) { /* storage unavailable → keep defaults */ }
}

function saveEnabledDungeons() {
  try {
    localStorage.setItem(STORAGE_KEY,
      enabledDungeons.size === DUN.length ? 'ALL' : JSON.stringify([...enabledDungeons]));
  } catch (e) { /* ignore */ }
}

let visRows = []; // row indices passing the dungeon filter, natural order
function recomputeVisible() {
  visRows = [];
  for (let r = 0; r < N; r++) {
    if (enabledDungeons.has(rowDungeon(r).id)) visRows.push(r);
  }
}

/* ============================ table ============================ */
let sortKeys = [];               // [{ci, dir}]
const sortVals = [];             // sortVals[row][ci]
const rowEls = [];

function buildTable() {
  const grow = $('#group-row'), hrow = $('#head-row'), tbody = $('#table-body');

  grow.innerHTML = COL_GROUPS.map((g, gi) =>
    `<th class="${g.cls}${gi === 0 ? ' stick gcol0' : ''}" colspan="${g.cols.length}">${esc(g.name)}</th>`).join('');

  hrow.innerHTML = ALL_COLS.map((c, ci) => {
    const stick = ci < 3 ? ` stick col${ci}` : '';
    const txt = c.text ? ' c-text' : '';
    return `<th class="${stick}${txt}" data-ci="${ci}"><span class="lbl">${esc(c.label)}</span><span class="sort-ic"></span></th>`;
  }).join('');

  const html = new Array(N);
  for (let r = 0; r < N; r++) {
    const vals = new Array(ALL_COLS.length);
    const cells = new Array(ALL_COLS.length);
    for (let ci = 0; ci < ALL_COLS.length; ci++) {
      const c = ALL_COLS[ci];
      const v = c.get(r);
      vals[ci] = v;
      const stick = ci < 3 ? ` stick col${ci}` : '';
      const cls = (c.text ? 'c-text' : 'num') + stick;
      cells[ci] = `<td class="${cls}">${v == null ? '' : esc(v)}</td>`;
    }
    sortVals.push(vals);
    html[r] = `<tr>${cells.join('')}</tr>`;
  }
  tbody.innerHTML = html.join('');
  for (let i = 0; i < tbody.rows.length; i++) rowEls.push(tbody.rows[i]);

  hrow.addEventListener('click', onHeadClick);
  $('#reset-sort').addEventListener('click', () => { sortKeys = []; applySort(); });
  applySort();
}

function onHeadClick(e) {
  const th = e.target.closest('th[data-ci]');
  if (!th) return;
  const ci = +th.dataset.ci;
  const at = sortKeys.findIndex(k => k.ci === ci);
  if (e.shiftKey) {
    if (at >= 0) sortKeys[at].dir *= -1;
    else sortKeys.push({ ci, dir: 1 });
  } else {
    sortKeys = [{ ci, dir: at >= 0 && sortKeys.length === 1 ? -sortKeys[at].dir : 1 }];
  }
  applySort();
}

function applySort() {
  const order = visRows.slice();
  if (sortKeys.length) {
    order.sort((a, b) => {
      for (const k of sortKeys) {
        const va = sortVals[a][k.ci], vb = sortVals[b][k.ci];
        let cmp;
        if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
        else cmp = va < vb ? -1 : va > vb ? 1 : 0;
        if (cmp) return cmp * k.dir;
      }
      return a - b;
    });
  }
  const tbody = $('#table-body');
  const frag = document.createDocumentFragment();
  for (const i of order) frag.appendChild(rowEls[i]);
  tbody.replaceChildren(frag);

  const rank = new Map(sortKeys.map((k, i) => [k.ci, i]));
  for (const th of $('#head-row').children) {
    const ci = +th.dataset.ci;
    const at = rank.get(ci);
    th.querySelector('.sort-ic').textContent =
      at === undefined ? '' : (sortKeys[at].dir === 1 ? `▲${sortKeys.length > 1 ? at + 1 : ''}` : `▼${sortKeys.length > 1 ? at + 1 : ''}`);
  }
  const filterNote = visRows.length < N ? ` · showing ${visRows.length} of ${N} floors` : '';
  $('#sort-status').textContent = (sortKeys.length
    ? `sorted by ${sortKeys.map(k => ALL_COLS[k.ci].label + (k.dir === 1 ? ' ↑' : ' ↓')).join(', ')}`
    : 'natural dungeon order') + filterNote;
}

/* ============================ chart config ============================ */
const PALETTE = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f',
  '#bcbd22', '#17becf', '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f', '#edc949',
  '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab', '#393b79', '#637939', '#8c6d31', '#843c39',
  '#7b4173', '#5254a3', '#8ca252', '#bd9e39', '#ad494a', '#a5526a',
];

const LEFT_KEYS = [
  'number', 'room_density', 'floor_connectivity', 'initial_enemy_density', 'dead_ends',
  'item_density', 'trap_density', 'extra_hallway_density', 'buried_item_density', 'water_density',
  'shop', 'monster_house', 'unused', 'sticky_item', 'empty_monster_house', 'hidden_stairs',
  'secondary_used', 'secondary_percentage', 'imperfect_rooms',
  'unk1', 'unk3', 'unk4', 'unk5', 'unk6', 'unk7',
  'unkE', 'kecleon_shop_item_positions', 'iq_booster_boost',
];
const RIGHT_KEYS = ['max_coin_amount', 'unk_hidden_stairs', 'enemy_iq', 'tileset', 'bgm', 'fixed_floor_id'];

const DEFAULT_ON = new Set([
  'room_density', 'floor_connectivity', 'initial_enemy_density', 'dead_ends',
  'item_density', 'trap_density', 'extra_hallway_density', 'buried_item_density', 'water_density',
  'max_coin_amount', 'shop', 'monster_house', 'unused', 'sticky_item',
  'empty_monster_house', 'hidden_stairs',
]);

const SERIES = [
  ...LEFT_KEYS.map(k => ({ key: k, axis: 'left' })),
  ...RIGHT_KEYS.map(k => ({ key: k, axis: 'right' })),
].map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length], on: DEFAULT_ON.has(s.key), chip: null }));

const DEFAULT_STRIPS = new Set(['structure', 'weather', 'darkness_level']);

const STRIPS = [
  { key: 'structure', on: true },
  { key: 'weather', on: true },
  { key: 'darkness_level', on: true },
  { key: 'fixed_floor_id', on: false },
  { key: 'tileset', on: false },
  { key: 'bgm', on: false },
].map(s => ({ ...s, chip: null }));

const colCache = {}, stripMaps = {};
function fieldColumn(key) {
  if (!colCache[key]) colCache[key] = ROWS.map(r => r[IDX[key]]);
  return colCache[key];
}
function stripColorMap(key) {
  if (!stripMaps[key]) {
    const vals = [...new Set(fieldColumn(key))];
    const numeric = vals.every(v => typeof v === 'number');
    vals.sort(numeric ? (a, b) => a - b : (a, b) => (a < b ? -1 : 1));
    const map = new Map();
    vals.forEach((v, i) => {
      map.set(v, vals.length <= PALETTE.length
        ? PALETTE[i % PALETTE.length]
        : `hsl(${(i * 137.508) % 360} 55% ${58 + (i % 3) * 9}%)`);
    });
    stripMaps[key] = { vals, numeric, color: v => map.get(v) };
  }
  return stripMaps[key];
}

/* ============================ chart view state ============================ */
const chartEl = $('#chart'), overlayEl = $('#overlay');
const xsEl = $('#xscroll'), xsInner = $('#xscroll-inner');
let geom = null, lastHover = null;   // lastHover = index within the visible window
const MIN_VIEW = 12;
let view = { start: 0, count: 0 };   // window into visRows

function windowMax(key) {
  const col = fieldColumn(key);
  let mx = 0;
  for (let i = 0; i < view.count; i++) {
    const v = col[visRows[view.start + i]];
    if (v > mx) mx = v;
  }
  return mx;
}

function windowRanges() { // [{d, start, end}] with start/end relative to the window
  const out = [];
  if (view.count <= 0) return out;
  let start = 0;
  for (let i = 1; i <= view.count; i++) {
    if (i === view.count ||
        rowDungeon(visRows[view.start + i]).id !== rowDungeon(visRows[view.start + i - 1]).id) {
      out.push({ d: rowDungeon(visRows[view.start + i - 1]), start, end: i - 1 });
      start = i;
    }
  }
  return out;
}

function clampView() {
  const total = visRows.length;
  if (total === 0) { view = { start: 0, count: 0 }; return; }
  view.count = clamp(Math.round(view.count), Math.min(MIN_VIEW, total), total);
  view.start = clamp(Math.round(view.start), 0, total - view.count);
}

function setView(start, count) {
  if (visRows.length === 0) {
    view = { start: 0, count: 0 };
    redrawChart(); syncScrollbar();
    return;
  }
  view.start = start;
  view.count = count;
  clampView();
  redrawChart();
  syncScrollbar();
}

function updateZoomLabel() {
  const el = $('#zoom-range');
  const total = visRows.length;
  if (total === 0) el.textContent = 'no floors selected';
  else if (view.count >= total) el.textContent = `all ${total} floors`;
  else el.textContent = `floors ${view.start + 1}–${view.start + view.count} of ${total}`;
}

function redrawChart() {
  drawChart();
  if (lastHover != null && geom && geom.count > 0) drawOverlay(lastHover);
  updateZoomLabel();
}

function redraw() {
  redrawChart();
  syncScrollbar();
}

/* ============================ chart drawing ============================ */
const fmtNum = v => String(+v.toFixed(2));

function niceCeil(v) {
  if (!(v > 0)) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const m = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return m * p;
}

function drawChart() {
  const wrap = $('#chart-wrap');
  const cssW = Math.max(560, wrap.clientWidth - 2);
  const activeStrips = STRIPS.filter(s => s.on);
  const plotH = 380;
  const stripH = 16, stripGap = 4;
  const xLabelH = 132;
  const padT = 16, padL = 54, padR = 98;
  const padB = 10 + activeStrips.length * (stripH + stripGap) + xLabelH;
  const cssH = padT + plotH + padB;

  const dpr = window.devicePixelRatio || 1;
  for (const cv of [chartEl, overlayEl]) {
    cv.width = Math.round(cssW * dpr);
    cv.height = Math.round(cssH * dpr);
    cv.style.width = cssW + 'px';
    cv.style.height = cssH + 'px';
  }
  const ctx = chartEl.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, cssW, cssH);

  if (visRows.length === 0) {
    geom = null;
    ctx.fillStyle = '#8a97a5';
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('No dungeons selected — enable dungeons with the filter in the header.', cssW / 2, cssH / 2);
    return;
  }
  clampView();
  const s0 = view.start, count = view.count;

  const plotW = cssW - padL - padR;
  const step = plotW / count;
  const xOf = i => padL + (i + 0.5) * step;

  const visL = SERIES.filter(s => s.axis === 'left' && s.on);
  const visR = SERIES.filter(s => s.axis === 'right' && s.on);
  let maxL = 0, maxR = 0;
  for (const s of SERIES) {
    if (!s.on) continue;
    const m = windowMax(s.key);
    if (s.axis === 'left') maxL = Math.max(maxL, m); else maxR = Math.max(maxR, m);
  }
  const topL = niceCeil(maxL), topR = niceCeil(maxR);
  const yL = v => padT + plotH * (1 - v / topL);
  const yR = v => padT + plotH * (1 - v / topR);

  geom = {
    padT, padL, padR, padB, plotW, plotH, step, xOf, yL, yR,
    cssW, cssH, stripH, stripGap, activeStrips, topL, topR, s0, count,
    stripsBottom: padT + plotH + activeStrips.length * (stripH + stripGap),
  };

  /* horizontal grid + axis tick labels */
  const TICKS = 5;
  ctx.font = '10.5px system-ui, sans-serif';
  for (let t = 0; t <= TICKS; t++) {
    const y = padT + plotH * t / TICKS;
    ctx.strokeStyle = t === TICKS ? '#c9d2dc' : '#eaeef3';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + plotW, y); ctx.stroke();
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#5b6b7c'; ctx.textAlign = 'right';
    ctx.fillText(fmtNum(topL * (1 - t / TICKS)), padL - 8, y);
    if (visR.length) {
      ctx.fillStyle = '#b06a3c'; ctx.textAlign = 'left';
      ctx.fillText(fmtNum(topR * (1 - t / TICKS)), padL + plotW + 8, y);
    }
  }

  /* faint dungeon boundaries */
  ctx.strokeStyle = '#eef2f6';
  ctx.beginPath();
  for (const rg of windowRanges()) {
    if (rg.start === 0) continue;
    const x = padL + rg.start * step;
    ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH);
  }
  ctx.stroke();

  /* series lines (+ points when zoomed in) */
  const showDots = step >= 8;
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  for (const s of SERIES) {
    if (!s.on) continue;
    const col = fieldColumn(s.key);
    const yOf = s.axis === 'left' ? yL : yR;
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 0.88;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = xOf(i), y = yOf(col[visRows[s0 + i]]);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (showDots) {
      ctx.fillStyle = s.color;
      for (let i = 0; i < count; i++) {
        ctx.beginPath();
        ctx.arc(xOf(i), yOf(col[visRows[s0 + i]]), 1.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;

  /* plot frame */
  ctx.strokeStyle = '#c9d2dc';
  ctx.strokeRect(padL, padT, plotW, plotH);

  /* axis titles */
  ctx.fillStyle = '#5b6b7c';
  ctx.font = '10.5px system-ui, sans-serif';
  ctx.save();
  ctx.translate(13, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('shared values', 0, 0);
  ctx.restore();
  if (visR.length) {
    ctx.save();
    ctx.translate(cssW - 12, padT + plotH / 2); ctx.rotate(Math.PI / 2);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('large values', 0, 0);
    ctx.restore();
  }

  /* colour strips for non-numeric / id fields */
  let sy = padT + plotH + 8;
  for (const st of activeStrips) {
    const col = fieldColumn(st.key);
    const cmap = stripColorMap(st.key);
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = cmap.color(col[visRows[s0 + i]]);
      ctx.fillRect(padL + i * step, sy, Math.max(step, 0.7), stripH);
    }
    ctx.strokeStyle = '#dfe5ec';
    ctx.strokeRect(padL, sy, plotW, stripH);
    ctx.fillStyle = '#5b6b7c';
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(st.key, padL + plotW + 8, sy + stripH / 2);
    sy += stripH + stripGap;
  }

  /* x axis: dungeon ticks + rotated dungeon names (+ per-floor ticks when zoomed) */
  const ranges = windowRanges();
  const showFloorLabels = step >= 13;
  const labelY = geom.stripsBottom + (showFloorLabels ? 34 : 14);
  ctx.strokeStyle = '#c9d2dc';
  ctx.beginPath();
  for (const rg of ranges) {
    const x = padL + rg.start * step;
    ctx.moveTo(x, geom.stripsBottom + 2); ctx.lineTo(x, geom.stripsBottom + 9);
  }
  ctx.stroke();

  if (showFloorLabels) {
    ctx.strokeStyle = '#dfe5ec';
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const x = padL + (i + 1) * step;
      ctx.moveTo(x, geom.stripsBottom + 2); ctx.lineTo(x, geom.stripsBottom + 6);
    }
    ctx.stroke();
    ctx.fillStyle = '#7a8794';
    ctx.font = '9.5px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let i = 0; i < count; i++) {
      ctx.fillText(String(rowVal(visRows[s0 + i], 'floor')), xOf(i), geom.stripsBottom + 11);
    }
  }

  ctx.font = '10px system-ui, sans-serif';
  let lastLabelX = -1e9;
  for (const rg of ranges) {
    const x = xOf(Math.round((rg.start + rg.end) / 2));
    if (x - lastLabelX < 92) continue;
    lastLabelX = x;
    let name = rg.d.name;
    if (name.length > 26) name = name.slice(0, 25) + '…';
    ctx.save();
    ctx.translate(x, labelY);
    ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#55636f';
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(name, 0, 0);
    ctx.restore();
  }
}

function drawOverlay(i) {
  const dpr = window.devicePixelRatio || 1;
  const ctx = overlayEl.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, geom.cssW, geom.cssH);
  if (i == null || !geom || geom.count === 0) return;

  const rowIdx = visRows[geom.s0 + i];
  const x = geom.xOf(i);
  ctx.strokeStyle = 'rgba(30,41,59,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(x, geom.padT);
  ctx.lineTo(x, geom.stripsBottom);
  ctx.stroke();
  ctx.setLineDash([]);

  for (const s of SERIES) {
    if (!s.on) continue;
    const v = fieldColumn(s.key)[rowIdx];
    const y = s.axis === 'left' ? geom.yL(v) : geom.yR(v);
    ctx.fillStyle = s.color;
    ctx.beginPath(); ctx.arc(x, y, 2.7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.stroke();
  }
}

function showTooltip(rowIdx, clientX, clientY) {
  const tt = $('#tooltip');
  const d = rowDungeon(rowIdx);
  const parts = [];
  parts.push(`<div class="tt-title">${esc(d.name)} <span>&middot; Floor ${rowVal(rowIdx, 'floor')}</span></div>`);
  parts.push(`<div class="tt-sub">${esc(d.folder)}/floor_${String(rowVal(rowIdx, 'floor')).padStart(3, '0')}.xml &middot; number=${rowVal(rowIdx, 'number')} &middot; dungeon_id ${d.id}</div>`);
  for (const st of geom.activeStrips) {
    const v = rowVal(rowIdx, st.key);
    parts.push(`<div class="tt-row"><span class="sw" style="background:${stripColorMap(st.key).color(v)}"></span><span class="k">${st.key}</span><span class="v">${esc(v)}</span></div>`);
  }
  for (const s of SERIES) {
    if (!s.on) continue;
    parts.push(`<div class="tt-row"><span class="sw" style="background:${s.color}"></span><span class="k">${s.key}</span><span class="v">${esc(rowVal(rowIdx, s.key))}</span></div>`);
  }
  tt.innerHTML = parts.join('');
  tt.hidden = false;

  const wrapRect = $('#chart-wrap').getBoundingClientRect();
  const ttW = tt.offsetWidth, ttH = tt.offsetHeight;
  let x = clientX - wrapRect.left + 16;
  if (x + ttW > wrapRect.width - 6) x = clientX - wrapRect.left - ttW - 12;
  let y = clientY - wrapRect.top + 14;
  if (y + ttH > wrapRect.height - 6) y = wrapRect.height - ttH - 6;
  tt.style.left = Math.max(4, x) + 'px';
  tt.style.top = Math.max(4, y) + 'px';
}

function bindChartEvents() {
  let pan = null;

  overlayEl.addEventListener('mousemove', e => {
    if (!geom || geom.count === 0 || pan) return;
    const r = overlayEl.getBoundingClientRect();
    const x = e.clientX - r.left;
    const i = clamp(Math.floor((x - geom.padL) / geom.step), 0, geom.count - 1);
    lastHover = i;
    drawOverlay(i);
    showTooltip(visRows[geom.s0 + i], e.clientX, e.clientY);
  });
  overlayEl.addEventListener('mouseleave', () => {
    lastHover = null;
    if (geom) drawOverlay(null);
    $('#tooltip').hidden = true;
  });
  overlayEl.addEventListener('wheel', e => {
    if (!geom || geom.count === 0) return;
    e.preventDefault();
    const r = overlayEl.getBoundingClientRect();
    const frac = clamp((e.clientX - r.left - geom.padL) / geom.plotW, 0, 1);
    const anchor = view.start + frac * view.count;
    const newCount = view.count * Math.pow(1.0018, e.deltaY);
    $('#tooltip').hidden = true;
    lastHover = null;
    drawOverlay(null);
    setView(anchor - frac * newCount, newCount);
  }, { passive: false });
  overlayEl.addEventListener('dblclick', () => setView(0, visRows.length));
  overlayEl.addEventListener('mousedown', e => {
    if (e.button !== 0 || !geom || geom.count === 0) return;
    pan = { x: e.clientX, start: view.start };
    overlayEl.style.cursor = 'grabbing';
    $('#tooltip').hidden = true;
    lastHover = null;
    drawOverlay(null);
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!pan || !geom || view.count <= 0) return;
    const dx = e.clientX - pan.x;
    const ppf = geom.plotW / view.count;
    setView(pan.start - dx / ppf, view.count);
  });
  window.addEventListener('mouseup', () => {
    if (!pan) return;
    pan = null;
    overlayEl.style.cursor = '';
  });
}

/* ============================ x-axis scrollbar ============================ */
let settingScroll = false;

function syncScrollbar() {
  const total = visRows.length;
  const w = xsEl.clientWidth;
  if (!w) return;
  const ppf = view.count > 0 ? w / view.count : 1;
  settingScroll = true;
  xsInner.style.width = Math.max(w, total * ppf) + 'px';
  xsEl.scrollLeft = view.start * ppf;
  settingScroll = false;
}

xsEl.addEventListener('scroll', () => {
  if (settingScroll) return;
  const total = visRows.length;
  const w = xsEl.clientWidth;
  if (!total || !w || view.count <= 0) return;
  const ppf = w / view.count;
  const start = clamp(Math.round(xsEl.scrollLeft / ppf), 0, Math.max(0, total - view.count));
  if (start === view.start) return;
  view.start = start;
  redrawChart();
});

/* ============================ legend & strip keys ============================ */
function buildLegend() {
  const lgL = $('#legend-left'), lgR = $('#legend-right'), lgS = $('#legend-strips');
  for (const s of SERIES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (s.on ? ' on' : '');
    chip.setAttribute('aria-pressed', String(s.on));
    chip.innerHTML = `<span class="sw" style="background:${s.color}"></span>${esc(s.key)}`;
    chip.addEventListener('click', () => {
      s.on = !s.on;
      chip.classList.toggle('on', s.on);
      chip.setAttribute('aria-pressed', String(s.on));
      redrawChart();
    });
    s.chip = chip;
    (s.axis === 'left' ? lgL : lgR).appendChild(chip);
  }
  for (const st of STRIPS) {
    const cmap = stripColorMap(st.key);
    const swColors = [0, Math.floor(cmap.vals.length / 2), cmap.vals.length - 1]
      .map(i => cmap.color(cmap.vals[i]));
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (st.on ? ' on' : '');
    chip.setAttribute('aria-pressed', String(st.on));
    chip.innerHTML = `<span class="sw" style="background:linear-gradient(90deg,${swColors.join(',')})"></span>${esc(st.key)}`;
    chip.addEventListener('click', () => {
      st.on = !st.on;
      chip.classList.toggle('on', st.on);
      chip.setAttribute('aria-pressed', String(st.on));
      redrawChart();
      renderStripKeys();
    });
    st.chip = chip;
    lgS.appendChild(chip);
  }
  renderStripKeys();
}

function renderStripKeys() {
  const box = $('#strip-keys');
  const groups = [];
  for (const st of STRIPS) {
    if (!st.on) continue;
    const cmap = stripColorMap(st.key);
    const show = cmap.vals.slice(0, 22);
    const chips = show.map(v =>
      `<span class="sk-chip"><span class="sw" style="background:${cmap.color(v)}"></span>${esc(v)}</span>`).join('');
    const more = cmap.vals.length > show.length ? ` <span class="sk-chip">… +${cmap.vals.length - show.length} more (hover chart)</span>` : '';
    groups.push(`<div class="sk-group"><b>${esc(st.key)}</b>${chips}${more}</div>`);
  }
  box.innerHTML = groups.join('');
}

function setAllLines(mode) {
  for (const s of SERIES) {
    s.on = mode === 'all' ? true : mode === 'none' ? false : DEFAULT_ON.has(s.key);
    s.chip.classList.toggle('on', s.on);
    s.chip.setAttribute('aria-pressed', String(s.on));
  }
  if (mode === 'defaults') {
    for (const st of STRIPS) {
      st.on = DEFAULT_STRIPS.has(st.key);
      st.chip.classList.toggle('on', st.on);
      st.chip.setAttribute('aria-pressed', String(st.on));
    }
    renderStripKeys();
  }
  redrawChart();
}

/* ============================ dungeon filter UI ============================ */
function updateFilterButton() {
  $('#dungeon-filter-count').textContent = `${enabledDungeons.size}/${DUN.length}`;
}

function applyDungeonFilter() {
  recomputeVisible();
  view = { start: 0, count: visRows.length };
  applySort();
  updateFilterButton();
  redraw();
}

function setDungeonFilterAll(on) {
  enabledDungeons = on ? new Set(DUN.map(d => d.id)) : new Set();
  for (const cb of document.querySelectorAll('#dungeon-list input[type=checkbox]')) {
    cb.checked = on;
  }
  saveEnabledDungeons();
  applyDungeonFilter();
}

function buildDungeonFilter() {
  const list = $('#dungeon-list');
  const pop = $('#dungeon-filter-pop');
  list.innerHTML = DUN.map(d =>
    `<label class="filter-item" data-name="${esc(d.name.toLowerCase())}">
       <input type="checkbox" data-id="${d.id}" ${enabledDungeons.has(d.id) ? 'checked' : ''}>
       <span class="nm">${esc(d.name)}</span><span class="ct">${d.numFloors}</span>
     </label>`).join('');

  $('#dungeon-filter-btn').addEventListener('click', () => { pop.hidden = !pop.hidden; });
  document.addEventListener('click', e => {
    if (!e.target.closest('.filter-wrap')) pop.hidden = true;
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') pop.hidden = true;
  });
  $('#dungeon-search').addEventListener('input', e => {
    const q = e.target.value.trim().toLowerCase();
    for (const item of list.querySelectorAll('.filter-item')) {
      item.style.display = item.dataset.name.includes(q) ? '' : 'none';
    }
  });
  list.addEventListener('change', e => {
    const cb = e.target;
    if (cb.type !== 'checkbox') return;
    const id = +cb.dataset.id;
    if (cb.checked) enabledDungeons.add(id); else enabledDungeons.delete(id);
    saveEnabledDungeons();
    applyDungeonFilter();
  });
  $('#dungeon-all').addEventListener('click', () => setDungeonFilterAll(true));
  $('#dungeon-none').addEventListener('click', () => setDungeonFilterAll(false));
  updateFilterButton();
}

/* ============================ tabs / zoom / resize ============================ */
function initTabs() {
  const tabs = [['#tab-table', '#panel-table'], ['#tab-viz', '#panel-viz']];
  tabs.forEach(([tabSel, panelSel]) => {
    $(tabSel).addEventListener('click', () => {
      tabs.forEach(([t, p]) => {
        const active = t === tabSel;
        $(t).classList.toggle('active', active);
        $(p).hidden = !active;
      });
      if (panelSel === '#panel-viz') requestAnimationFrame(redraw);
    });
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if ($('#panel-viz').hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(redraw, 120);
  });

  $('#btn-all').addEventListener('click', () => setAllLines('all'));
  $('#btn-none').addEventListener('click', () => setAllLines('none'));
  $('#btn-default').addEventListener('click', () => setAllLines('defaults'));
}

function initZoomControls() {
  $('#zoom-in').addEventListener('click', () => {
    setView(view.start + view.count / 4, view.count / 2);
  });
  $('#zoom-out').addEventListener('click', () => {
    setView(view.start - view.count / 2, view.count * 2);
  });
  $('#zoom-fit').addEventListener('click', () => setView(0, visRows.length));
}

/* ============================ init ============================ */
loadEnabledDungeons();
recomputeVisible();
view = { start: 0, count: visRows.length };
$('#stats').textContent =
  `${DUN.length} dungeons · ${N} floors · ${ALL_COLS.length} columns · every FloorLayout parameter`;
buildTable();
buildLegend();
buildDungeonFilter();
bindChartEvents();
initTabs();
initZoomControls();
