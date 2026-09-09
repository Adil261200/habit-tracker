'use strict';

const STORE_KEY = 'wages-v1';

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
    alert('Не удалось сохранить запись — в браузере кончилось место для данных.');
  }
}

const state = load();

/* ---------- даты и числа ---------- */
const $ = (id) => document.getElementById(id);

function todayISO(d = new Date()) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-');
}

const MON = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MON_N = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MON[m - 1]}`;
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

/* ---------- 1. добавить выплату ---------- */

// имена из уже введённых записей: сначала те, кем пользовались недавно
function knownNames() {
  const seen = new Map();
  for (const p of state.payments) {
    const key = p.name.toLowerCase();
    const prev = seen.get(key);
    if (!prev || p.date > prev.date) seen.set(key, { name: p.name, date: p.date });
  }
  return [...seen.values()].sort((a, b) => b.date.localeCompare(a.date)).map((v) => v.name);
}

// чтобы «Ерлан» и «ерлан» не превратились в двух разных работников
function canonicalName(input) {
  const key = input.toLowerCase();
  const hit = knownNames().find((n) => n.toLowerCase() === key);
  return hit || input;
}

function renderNames() {
  $('names').innerHTML = knownNames().map((n) => `<option value="${esc(n)}">`).join('');
}

let savedTimer = null;

$('payForm').addEventListener('submit', (e) => {
  e.preventDefault();

  const name = $('name').value.trim().replace(/\s+/g, ' ');
  const amount = Math.round(Number($('amount').value));
  const date = $('date').value;
  const note = $('note').value.trim();

  if (!name || !date || !Number.isFinite(amount) || amount <= 0) return;

  state.payments.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    name: canonicalName(name),
    amount,
    date,
    note,
  });
  save();

  $('name').value = '';
  $('amount').value = '';
  $('note').value = '';
  // дату не сбрасываем — удобно, когда вносишь несколько записей за один день

  $('month').value = date.slice(0, 7); // показываем месяц, куда попала запись
  renderNames();
  renderMonth();

  const saved = $('saved');
  saved.hidden = false;
  clearTimeout(savedTimer);
  savedTimer = setTimeout(() => { saved.hidden = true; }, 1600);

  $('name').focus();
});

/* ---------- 2. итоги по месяцам ---------- */
function monthPayments(ym) {
  return state.payments
    .filter((p) => p.date.slice(0, 7) === ym)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

function renderMonth() {
  const ym = $('month').value || todayISO().slice(0, 7);
  const list = monthPayments(ym);

  // по работникам
  const byWorker = new Map();
  for (const p of list) {
    const key = p.name.toLowerCase();
    const row = byWorker.get(key) || { name: p.name, sum: 0, count: 0 };
    row.sum += p.amount;
    row.count += 1;
    byWorker.set(key, row);
  }
  const workers = [...byWorker.values()].sort((a, b) => b.sum - a.sum);

  $('totals').innerHTML = workers.length
    ? workers.map((w) => `
        <div class="wrow">
          <span class="wname">${esc(w.name)}</span>
          <span class="wcount">${w.count} ${plural(w.count, 'выплата', 'выплаты', 'выплат')}</span>
          <span class="wsum">${fmtMoney(w.sum)}</span>
        </div>`).join('')
    : `<div class="empty">За ${fmtMonth(ym).toLowerCase()} записей нет.</div>`;

  const total = list.reduce((s, p) => s + p.amount, 0);
  $('grand').innerHTML = list.length
    ? `<span class="k">Всего за месяц</span><span class="v">${fmtMoney(total)}</span>`
    : '';

  $('entries').innerHTML = list.length
    ? list.map((p) => `
        <div class="erow">
          <span class="edate">${fmtDate(p.date)}</span>
          <span class="ename">${esc(p.name)}${p.note ? `<span class="enote">${esc(p.note)}</span>` : ''}</span>
          <span class="esum">${fmtMoney(p.amount)}</span>
          <button type="button" class="del" data-id="${p.id}" aria-label="Удалить запись">×</button>
        </div>`).join('')
    : '<div class="empty">Пусто.</div>';
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

$('entries').addEventListener('click', (e) => {
  const btn = e.target.closest('.del');
  if (!btn) return;
  const p = state.payments.find((x) => x.id === btn.dataset.id);
  if (!p) return;
  if (!confirm(`Удалить запись: ${p.name}, ${fmtMoney(p.amount)}, ${fmtDate(p.date)}?`)) return;
  state.payments = state.payments.filter((x) => x.id !== p.id);
  save();
  renderNames();
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
$('date').value = today;
$('month').value = today.slice(0, 7);
$('todayLabel').textContent = fmtDate(today);
renderNames();
renderMonth();
