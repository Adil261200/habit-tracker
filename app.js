'use strict';

/* ---------- параметры программы ---------- */
const START_KG = 79;
const GOAL_KG = 75;
const WEEKS = 8;
const STRENGTH_DAYS = [1, 3, 5]; // пн, ср, пт
const STORE_KEY = 'habit-tracker-v1';

/* ---------- хранилище ---------- */
const emptyState = () => ({ startDate: todayISO(), days: {}, weights: {}, notes: [] });

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyState();
    return Object.assign(emptyState(), JSON.parse(raw));
  } catch (e) {
    console.warn('Не удалось прочитать сохранённые данные', e);
    return emptyState();
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Не удалось сохранить данные', e);
  }
}

const state = load();

/* ---------- даты ---------- */
function todayISO(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function weekOf(iso) {
  const diff = (parseISO(iso) - parseISO(state.startDate)) / 86400000;
  return Math.max(0, Math.floor(diff / 7));
}

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function fmtShort(iso) {
  const d = parseISO(iso);
  return `${d.getDate()} ${MON[d.getMonth()]}, ${WD[d.getDay()]}`;
}

function isStrengthDay(iso) {
  return STRENGTH_DAYS.includes(parseISO(iso).getDay());
}

let today = todayISO();
const dayEntry = (iso) => (state.days[iso] ||= { english: false, strength: false, pomodoro: 0 });

/* ---------- 1. привычки ---------- */
const $ = (id) => document.getElementById(id);

function renderToday() {
  const d = dayEntry(today);
  const strengthDay = isStrengthDay(today);

  $('todayLabel').textContent = fmtShort(today);

  $('english').checked = d.english;
  $('english').closest('.habit').classList.toggle('done', d.english);

  const row = $('strengthRow');
  $('strength').checked = d.strength;
  $('strength').disabled = !strengthDay;
  row.classList.toggle('off', !strengthDay);
  row.classList.toggle('done', d.strength);
  $('strengthHint').textContent = strengthDay ? 'пн / ср / пт' : 'сегодня отдых';

  $('pomoCount').textContent = d.pomodoro;
}

function renderHistory() {
  const box = $('history');
  box.textContent = '';

  const days = Object.keys(state.days)
    .filter((iso) => iso !== today)
    .sort()
    .reverse()
    .slice(0, 14);

  if (!days.length) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'Пока пусто — история появится завтра.';
    box.appendChild(p);
    return;
  }

  for (const iso of days) {
    const d = state.days[iso];
    const row = document.createElement('div');
    row.className = 'hrow';

    const date = document.createElement('span');
    date.className = 'date';
    date.textContent = fmtShort(iso);
    row.appendChild(date);

    const cell = (text, yes) => {
      const s = document.createElement('span');
      s.className = 'cell' + (yes ? ' yes' : '');
      s.textContent = text;
      row.appendChild(s);
    };

    cell(d.english ? 'англ ✓' : 'англ —', d.english);
    if (isStrengthDay(iso)) cell(d.strength ? 'зал ✓' : 'зал —', d.strength);
    else cell('', false);
    cell(d.pomodoro ? `🍅 ${d.pomodoro}` : '🍅 0', d.pomodoro > 0);

    box.appendChild(row);
  }
}

$('english').addEventListener('change', (e) => {
  dayEntry(today).english = e.target.checked;
  save();
  renderToday();
});

$('strength').addEventListener('change', (e) => {
  dayEntry(today).strength = e.target.checked;
  save();
  renderToday();
});

$('pomoPlus').addEventListener('click', () => {
  dayEntry(today).pomodoro++;
  save();
  renderToday();
});

$('pomoMinus').addEventListener('click', () => {
  const d = dayEntry(today);
  d.pomodoro = Math.max(0, d.pomodoro - 1);
  save();
  renderToday();
});

/* ---------- 2. вес ---------- */
function weightEntries() {
  return Object.keys(state.weights)
    .map(Number)
    .sort((a, b) => a - b)
    .map((w) => ({ week: w, ...state.weights[w] }));
}

function renderWeight() {
  $('startDate').value = state.startDate;

  const week = weekOf(today);
  const existing = state.weights[week];
  $('weekLabel').textContent = existing
    ? `Неделя ${week + 1} из ${WEEKS}: записано ${fmtKg(existing.kg)} кг — новая запись перезапишет её.`
    : `Неделя ${week + 1} из ${WEEKS}.`;

  const entries = weightEntries();
  const last = entries.length ? entries[entries.length - 1].kg : START_KG;
  const lost = START_KG - last;
  const left = last - GOAL_KG;

  $('weightStats').textContent = '';
  const stat = (value, label) => {
    const el = document.createElement('div');
    el.className = 'stat';
    const v = document.createElement('div');
    v.className = 'v';
    v.textContent = value;
    const k = document.createElement('div');
    k.className = 'k';
    k.textContent = label;
    el.append(v, k);
    $('weightStats').appendChild(el);
  };
  stat(`${fmtKg(last)} кг`, entries.length ? 'сейчас' : 'старт');
  stat(`${lost > 0 ? '−' : lost < 0 ? '+' : ''}${fmtKg(Math.abs(lost))} кг`, 'сброшено');
  stat(`${fmtKg(Math.max(0, left))} кг`, `до цели ${GOAL_KG} кг`);

  drawChart(entries);
}

function fmtKg(n) {
  return (Math.round(n * 10) / 10).toString().replace('.', ',');
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function drawChart(entries) {
  const svg = $('chart');
  svg.textContent = '';

  const W = 640, H = 280;
  const pad = { l: 42, r: 14, t: 14, b: 26 };
  const css = getComputedStyle(document.body);
  const line = css.getPropertyValue('--line').trim() || '#ddd';
  const muted = css.getPropertyValue('--muted').trim() || '#888';
  const accent = css.getPropertyValue('--accent').trim() || '#2f6f4f';

  const kgs = entries.map((e) => e.kg).concat([START_KG, GOAL_KG]);
  let min = Math.min(...kgs) - 1;
  let max = Math.max(...kgs) + 1;

  const x = (week) => pad.l + (week / WEEKS) * (W - pad.l - pad.r);
  const y = (kg) => pad.t + ((max - kg) / (max - min)) * (H - pad.t - pad.b);

  const add = (tag, attrs, text) => {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    if (text !== undefined) el.textContent = text;
    svg.appendChild(el);
    return el;
  };

  // горизонтальная сетка + подписи кг
  const step = (max - min) / 4;
  for (let i = 0; i <= 4; i++) {
    const kg = min + step * i;
    add('line', { x1: pad.l, y1: y(kg), x2: W - pad.r, y2: y(kg), stroke: line, 'stroke-width': 1 });
    add('text', { x: pad.l - 8, y: y(kg) + 4, fill: muted, 'font-size': 11, 'text-anchor': 'end' }, fmtKg(kg));
  }

  // подписи недель
  for (let w = 0; w <= WEEKS; w += 2) {
    add('text', { x: x(w), y: H - 6, fill: muted, 'font-size': 11, 'text-anchor': 'middle' }, w === 0 ? 'старт' : `${w} нед`);
  }

  // целевая линия 79 → 75
  add('line', {
    x1: x(0), y1: y(START_KG), x2: x(WEEKS), y2: y(GOAL_KG),
    stroke: muted, 'stroke-width': 1.5, 'stroke-dasharray': '5 5'
  });

  if (!entries.length) {
    add('text', { x: (W + pad.l) / 2, y: H / 2, fill: muted, 'font-size': 12, 'text-anchor': 'middle' },
      'Пунктир — план. Запиши первый вес.');
    return;
  }

  // фактическая линия
  if (entries.length > 1) {
    add('polyline', {
      points: entries.map((e) => `${x(e.week)},${y(e.kg)}`).join(' '),
      fill: 'none', stroke: accent, 'stroke-width': 2.5,
      'stroke-linejoin': 'round', 'stroke-linecap': 'round'
    });
  }

  for (const e of entries) {
    add('circle', { cx: x(e.week), cy: y(e.kg), r: 4.5, fill: accent })
      .appendChild(Object.assign(document.createElementNS(SVG_NS, 'title'), {
        textContent: `${fmtKg(e.kg)} кг — ${fmtShort(e.date)}`
      }));
  }

  const lastE = entries[entries.length - 1];
  add('text', {
    x: Math.min(x(lastE.week) + 8, W - pad.r - 30), y: y(lastE.kg) - 10,
    fill: accent, 'font-size': 12, 'font-weight': 600
  }, fmtKg(lastE.kg));
}

$('weightForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const kg = parseFloat($('weightInput').value.replace(',', '.'));
  if (!isFinite(kg)) return;
  state.weights[weekOf(today)] = { kg, date: today };
  $('weightInput').value = '';
  save();
  renderWeight();
});

$('startDate').addEventListener('change', (e) => {
  if (!e.target.value) return e.target.value = state.startDate;
  state.startDate = e.target.value;
  save();
  renderWeight();
});

/* ---------- 3. kaizen ---------- */
function renderNotes() {
  const box = $('notes');
  box.textContent = '';

  if (!state.notes.length) {
    const p = document.createElement('div');
    p.className = 'empty';
    p.textContent = 'Заметок пока нет.';
    box.appendChild(p);
    return;
  }

  for (const note of [...state.notes].reverse()) {
    const el = document.createElement('div');
    el.className = 'note';

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.textContent = fmtShort(note.date);

    const text = document.createElement('div');
    text.className = 'text';
    text.textContent = note.text;

    const del = document.createElement('button');
    del.className = 'del';
    del.type = 'button';
    del.title = 'Удалить';
    del.textContent = '×';
    del.addEventListener('click', () => {
      state.notes = state.notes.filter((n) => n.id !== note.id);
      save();
      renderNotes();
    });

    el.append(meta, text, del);
    box.appendChild(el);
  }
}

$('noteForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const text = $('noteInput').value.trim();
  if (!text) return;
  state.notes.push({ id: Date.now(), date: today, text });
  $('noteInput').value = '';
  save();
  renderNotes();
});

$('noteInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    $('noteForm').requestSubmit();
  }
});

/* ---------- запуск ---------- */
function renderAll() {
  renderToday();
  renderHistory();
  renderWeight();
  renderNotes();
}

// если вкладка провисела до следующего дня — переключаемся на новую дату
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  const now = todayISO();
  if (now !== today) {
    today = now;
    renderAll();
  }
});

renderAll();
save();
