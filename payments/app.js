'use strict';

const STORE_KEY = 'wages-v1';
const RECENT_DAYS = 60; // кто не получал дольше — прячется в быстром вводе под «показать всех»

/* ---------- хранилище ---------- */
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { payments: [] };
    const data = JSON.parse(raw);
    return { payments: Array.isArray(data.payments) ? data.payments : [] };
  } catch (e) {
    console.warn('Не удалось прочитать сохранённые данные', e);
    return { payments: [] };
  }
}

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Не удалось сохранить данные', e);
    alert('Не удалось сохранить — в браузере кончилось место для данных.');
  }
}

const state = load();

/* ---------- даты, числа, мелочи ---------- */
const $ = (id) => document.getElementById(id);

function todayISO(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON_N = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MON[m - 1]}`;
}

function fmtDateWd(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MON[m - 1]}, ${WD[new Date(y, m - 1, d).getDay()]}`;
}

function fmtMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MON_N[m - 1]} ${y}`;
}

function fmtMoney(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₸';
}

function shiftMonth(ym, delta) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function plural(n, one, few, many) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function newId() {
  return Date.now() + '-' + Math.random().toString(36).slice(2, 7);
}

function flash(el, text) {
  el.textContent = text;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 1800);
}

/* ---------- работники ---------- */
// имя берём из самой свежей записи, сравниваем без учёта регистра:
// «Ерлан» и «ерлан» — один человек
function workers() {
  const seen = new Map();
  for (const p of state.payments) {
    const key = p.name.toLowerCase();
    const prev = seen.get(key);
    if (!prev) seen.set(key, { key, name: p.name, last: p.date });
    else if (p.date > prev.last) { prev.name = p.name; prev.last = p.date; }
  }
  return [...seen.values()];
}

function canonicalName(input) {
  const hit = workers().find((w) => w.key === input.toLowerCase());
  return hit ? hit.name : input;
}

function renderNames() {
  const recent = workers().sort((a, b) => b.last.localeCompare(a.last));
  $('names').innerHTML = recent.map((w) => `<option value="${esc(w.name)}">`).join('');
}

/* ---------- 1. быстрый ввод за день ---------- */
let showAllWorkers = false;

function renderQuick() {
  const date = $('qDate').value;
  const all = workers().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const cutoff = todayISO(new Date(Date.now() - RECENT_DAYS * 86400000));
  const active = all.filter((w) => w.last >= cutoff);
  const hidden = all.length - active.length;
  const list = showAllWorkers || !hidden ? all : active;

  // что за этот день уже записано
  const done = new Map();
  if (date) {
    for (const p of state.payments) {
      if (p.date !== date) continue;
      const row = done.get(p.name.toLowerCase()) || { sum: 0, count: 0 };
      row.sum += p.amount;
      row.count += 1;
      done.set(p.name.toLowerCase(), row);
    }
  }

  $('qList').innerHTML = list.length
    ? list.map((w) => {
        const d = done.get(w.key);
        if (d) {
          return `<div class="qrow is-done">
            <span class="qname">${esc(w.name)}</span>
            <span class="qmark">${fmtMoney(d.sum)}${d.count > 1 ? ` · ${d.count} записи` : ''} · записан</span>
          </div>`;
        }
        return `<div class="qrow" data-name="${esc(w.name)}">
          <span class="qname">${esc(w.name)}</span>
          <input type="number" class="qamount" inputmode="numeric" min="1" max="100000000" step="1" placeholder="—" aria-label="Сумма: ${esc(w.name)}">
          <input type="text" class="qnote" placeholder="что делал" maxlength="120" hidden>
        </div>`;
      }).join('')
    : '<div class="empty">Работников пока нет — добавь первого через «Добавить выплату» ниже.</div>';

  $('qMore').hidden = !hidden;
  if (hidden) {
    $('qMore').textContent = showAllWorkers
      ? 'Показывать только тех, кто работал недавно'
      : `Показать всех (+${hidden} ${plural(hidden, 'давно не работал', 'давно не работали', 'давно не работали')})`;
  }

  updateQuickBar();
}

function updateQuickBar() {
  let count = 0;
  let sum = 0;
  for (const inp of document.querySelectorAll('.qamount')) {
    const v = Math.round(Number(inp.value));
    if (Number.isFinite(v) && v > 0) { count += 1; sum += v; }
  }
  $('qSave').disabled = count === 0;
  $('qSum').textContent = count
    ? `${count} ${plural(count, 'выплата', 'выплаты', 'выплат')} · ${fmtMoney(sum)}`
    : 'Впиши суммы тем, кто работал';
}

$('qList').addEventListener('input', (e) => {
  const inp = e.target.closest('.qamount');
  if (!inp) return;
  // комментарий появляется только у того, кому вписали сумму
  const note = inp.parentElement.querySelector('.qnote');
  if (note) note.hidden = !(Number(inp.value) > 0);
  updateQuickBar();
});

$('qMore').addEventListener('click', () => {
  showAllWorkers = !showAllWorkers;
  renderQuick();
});

$('qDate').addEventListener('change', renderQuick);

$('qSave').addEventListener('click', () => {
  const date = $('qDate').value;
  if (!date) return;

  const added = [];
  for (const row of document.querySelectorAll('.qrow[data-name]')) {
    const amount = Math.round(Number(row.querySelector('.qamount').value));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    added.push({
      id: newId(),
      name: row.dataset.name,
      amount,
      date,
      note: row.querySelector('.qnote').value.trim(),
    });
  }
  if (!added.length) return;

  state.payments.push(...added);
  save();

  $('month').value = date.slice(0, 7);
  renderQuick();
  renderNames();
  renderMonth();
  // строку итога на пару секунд подменяем подтверждением
  const bar = $('qSum');
  bar.textContent = `Записано: ${added.length} ${plural(added.length, 'выплата', 'выплаты', 'выплат')}`;
  clearTimeout(bar._timer);
  bar._timer = setTimeout(updateQuickBar, 1800);
});

/* ---------- 2. добавить выплату ---------- */
$('payForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const name = $('name').value.trim().replace(/\s+/g, ' ');
  const amount = Math.round(Number($('amount').value));
  const date = $('date').value;
  const note = $('note').value.trim();

  if (!name || !date || !Number.isFinite(amount) || amount <= 0) return;

  state.payments.push({ id: newId(), name: canonicalName(name), amount, date, note });
  save();

  $('name').value = '';
  $('amount').value = '';
  $('note').value = '';
  // дату не сбрасываем — удобно, когда вносишь несколько записей за один день

  $('month').value = date.slice(0, 7);
  renderNames();
  renderQuick();
  renderMonth();
  flash($('saved'), 'Записано');
  $('name').focus();
});

/* ---------- 3. итоги по месяцам ---------- */
let filterKey = null;          // показывать записи только этого работника
const expanded = new Set();    // раскрытые дни

function monthPayments(ym) {
  return state.payments
    .filter((p) => p.date.slice(0, 7) === ym)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function renderMonth() {
  const ym = $('month').value || todayISO().slice(0, 7);
  const list = monthPayments(ym);

  // итоги по работникам
  const byWorker = new Map();
  for (const p of list) {
    const key = p.name.toLowerCase();
    const row = byWorker.get(key) || { key, name: p.name, sum: 0, count: 0 };
    row.sum += p.amount;
    row.count += 1;
    byWorker.set(key, row);
  }
  const ws = [...byWorker.values()].sort((a, b) => b.sum - a.sum);
  if (filterKey && !byWorker.has(filterKey)) filterKey = null; // ушли в месяц, где его нет

  $('totals').innerHTML = ws.length
    ? ws.map((w) => `
        <button type="button" class="wrow${w.key === filterKey ? ' active' : ''}" data-key="${esc(w.key)}">
          <span class="wname">${esc(w.name)}</span>
          <span class="wcount">${w.count} ${plural(w.count, 'выплата', 'выплаты', 'выплат')}</span>
          <span class="wsum">${fmtMoney(w.sum)}</span>
        </button>`).join('')
    : `<div class="empty">За ${fmtMonth(ym).toLowerCase()} записей нет.</div>`;

  const total = list.reduce((s, p) => s + p.amount, 0);
  $('grand').innerHTML = list.length
    ? `<span class="k">Всего за месяц</span><span class="v">${fmtMoney(total)}</span>`
    : '';

  renderEntries(list);
}

// внутри раскрытого дня дата не повторяется, при фильтре по работнику — наоборот, она главная
function entryRow(p, inDay) {
  const note = p.note ? `<span class="enote">${esc(p.note)}</span>` : '';
  return `<div class="erow${inDay ? ' in-day' : ''}">
    ${inDay ? '' : `<span class="edate">${fmtDate(p.date)}</span>`}
    <span class="ename">${inDay ? esc(p.name) : ''}${note}</span>
    <span class="esum">${fmtMoney(p.amount)}</span>
    <button type="button" class="del" data-id="${p.id}" aria-label="Удалить запись">×</button>
  </div>`;
}

function renderEntries(list) {
  const bar = $('filterBar');
  if (filterKey) {
    // фильтр по работнику: плоский список, дни не сворачиваем — их и так немного
    const mine = list.filter((p) => p.name.toLowerCase() === filterKey);
    const sum = mine.reduce((s, p) => s + p.amount, 0);
    bar.hidden = false;
    bar.innerHTML = `<span class="fname">${esc(mine[0] ? mine[0].name : '')}</span>
      <span class="fsum">${mine.length} ${plural(mine.length, 'выплата', 'выплаты', 'выплат')} · ${fmtMoney(sum)}</span>
      <button type="button" id="clearFilter">Показать всех</button>`;
    $('entries').innerHTML = mine.map((p) => entryRow(p, false)).join('') || '<div class="empty">Пусто.</div>';
    return;
  }

  bar.hidden = true;
  bar.innerHTML = '';

  if (!list.length) {
    $('entries').innerHTML = '<div class="empty">Пусто.</div>';
    return;
  }

  // группировка по дням: свёрнуто, в шапке — сколько человек и сколько денег
  const days = new Map();
  for (const p of list) {
    if (!days.has(p.date)) days.set(p.date, []);
    days.get(p.date).push(p);
  }

  $('entries').innerHTML = [...days.entries()].map(([date, rows]) => {
    const sum = rows.reduce((s, p) => s + p.amount, 0);
    const people = new Set(rows.map((p) => p.name.toLowerCase())).size;
    const open = expanded.has(date);
    return `<div class="daygroup">
      <button type="button" class="dayhead${open ? ' open' : ''}" data-date="${date}" aria-expanded="${open}">
        <span class="dcaret" aria-hidden="true">›</span>
        <span class="ddate">${fmtDateWd(date)}</span>
        <span class="dcount">${people} ${plural(people, 'человек', 'человека', 'человек')}</span>
        <span class="dsum">${fmtMoney(sum)}</span>
      </button>
      <div class="dayrows"${open ? '' : ' hidden'}>${rows.map((p) => entryRow(p, true)).join('')}</div>
    </div>`;
  }).join('');
}

$('totals').addEventListener('click', (e) => {
  const row = e.target.closest('.wrow');
  if (!row) return;
  filterKey = filterKey === row.dataset.key ? null : row.dataset.key;
  renderMonth();
  // список работников длинный — подтягиваем записи выбранного к экрану
  if (filterKey) $('filterBar').scrollIntoView({ block: 'center', behavior: 'smooth' });
});

$('filterBar').addEventListener('click', (e) => {
  if (!e.target.closest('#clearFilter')) return;
  filterKey = null;
  renderMonth();
});

$('entries').addEventListener('click', (e) => {
  const head = e.target.closest('.dayhead');
  if (head) {
    const date = head.dataset.date;
    if (expanded.has(date)) expanded.delete(date); else expanded.add(date);
    head.classList.toggle('open');
    head.setAttribute('aria-expanded', expanded.has(date));
    head.nextElementSibling.hidden = !expanded.has(date);
    return;
  }

  const btn = e.target.closest('.del');
  if (!btn) return;
  const p = state.payments.find((x) => x.id === btn.dataset.id);
  if (!p) return;
  if (!confirm(`Удалить запись: ${p.name}, ${fmtMoney(p.amount)}, ${fmtDate(p.date)}?`)) return;
  state.payments = state.payments.filter((x) => x.id !== p.id);
  save();
  renderNames();
  renderQuick();
  renderMonth();
});

$('month').addEventListener('change', renderMonth);
$('prevMonth').addEventListener('click', () => {
  $('month').value = shiftMonth($('month').value || todayISO().slice(0, 7), -1);
  renderMonth();
});
$('nextMonth').addEventListener('click', () => {
  $('month').value = shiftMonth($('month').value || todayISO().slice(0, 7), 1);
  renderMonth();
});

/* ---------- старт ---------- */
const today = todayISO();
$('qDate').value = today;
$('date').value = today;
$('month').value = today.slice(0, 7);
$('todayLabel').textContent = fmtDate(today);
renderNames();
renderQuick();
renderMonth();
