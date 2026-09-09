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
const editing = new Set(); // id записей, которые правим прямо в списке

// то, что уже набрано, но ещё не записано — чтобы перерисовка списка его не стёрла
function readDrafts() {
  const news = new Map();
  const edits = new Map();
  for (const row of document.querySelectorAll('.qrow[data-name]')) {
    news.set(row.dataset.name, {
      amount: row.querySelector('.qamount').value,
      note: row.querySelector('.qnote').value,
    });
  }
  for (const row of document.querySelectorAll('.qrow.editing')) {
    edits.set(row.dataset.editId, {
      amount: row.querySelector('.qamount').value,
      note: row.querySelector('.qnote').value,
    });
  }
  return { news, edits };
}

function applyDrafts(drafts) {
  if (!drafts) return;
  for (const row of document.querySelectorAll('.qrow[data-name]')) {
    const d = drafts.news.get(row.dataset.name);
    if (!d) continue;
    const amount = row.querySelector('.qamount');
    const note = row.querySelector('.qnote');
    amount.value = d.amount;
    note.value = d.note;
    note.hidden = !(Number(d.amount) > 0);
  }
  for (const row of document.querySelectorAll('.qrow.editing')) {
    const d = drafts.edits.get(row.dataset.editId);
    if (!d) continue;
    row.querySelector('.qamount').value = d.amount;
    row.querySelector('.qnote').value = d.note;
  }
}

function renderQuick(keepDrafts = false) {
  const drafts = keepDrafts ? readDrafts() : null;
  const date = $('qDate').value;

  const all = workers().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const cutoff = todayISO(new Date(Date.now() - RECENT_DAYS * 86400000));
  const active = all.filter((w) => w.last >= cutoff);
  const stale = all.length - active.length;
  const list = showAllWorkers || !stale ? all : active;

  // что за этот день уже записано
  const done = new Map();
  if (date) {
    for (const p of state.payments) {
      if (p.date !== date) continue;
      const row = done.get(p.name.toLowerCase()) || { sum: 0, ids: [] };
      row.sum += p.amount;
      row.ids.push(p.id);
      done.set(p.name.toLowerCase(), row);
    }
  }

  $('qList').innerHTML = list.length
    ? list.map((w) => quickRow(w, done.get(w.key))).join('')
    : '<div class="empty">Работников пока нет — добавь первого через «Добавить выплату» ниже.</div>';

  $('qMore').hidden = !stale;
  if (stale) {
    $('qMore').textContent = showAllWorkers
      ? 'Показывать только тех, кто работал недавно'
      : `Показать всех (+${stale} ${plural(stale, 'давно не работал', 'давно не работали', 'давно не работали')})`;
  }

  applyDrafts(drafts);
  updateQuickBar();
}

function quickRow(w, d) {
  // за этот день ему ещё не платили — обычное поле ввода
  if (!d) {
    return `<div class="qrow" data-name="${esc(w.name)}">
      <span class="qname">${esc(w.name)}</span>
      <input type="number" class="qamount" inputmode="numeric" min="1" max="100000000" step="1" placeholder="—" aria-label="Сумма: ${esc(w.name)}">
      <input type="text" class="qnote" placeholder="что делал" maxlength="120" hidden>
    </div>`;
  }

  // одна запись за день — её можно поправить прямо здесь
  if (d.ids.length === 1 && editing.has(d.ids[0])) {
    const p = state.payments.find((x) => x.id === d.ids[0]);
    return `<div class="qrow editing" data-edit-id="${esc(p.id)}">
      <span class="qname">${esc(p.name)}</span>
      <input type="number" class="qamount" inputmode="numeric" min="1" max="100000000" step="1"
             value="${p.amount}" data-orig="${p.amount}" aria-label="Сумма: ${esc(p.name)}">
      <input type="text" class="qnote" placeholder="что делал" maxlength="120"
             value="${esc(p.note || '')}" data-orig="${esc(p.note || '')}">
      <button type="button" class="cancel-edit">отмена</button>
    </div>`;
  }

  if (d.ids.length === 1) {
    return `<button type="button" class="qrow is-done" data-edit-id="${esc(d.ids[0])}">
      <span class="qname">${esc(w.name)}</span>
      <span class="qmark">${fmtMoney(d.sum)}<span class="qedit">изменить</span></span>
    </button>`;
  }

  // несколько выплат за один день — правим их в списке записей, чтобы не гадать, какую
  return `<div class="qrow is-done">
    <span class="qname">${esc(w.name)}</span>
    <span class="qmark">${fmtMoney(d.sum)} · ${d.ids.length} ${plural(d.ids.length, 'запись', 'записи', 'записей')}</span>
  </div>`;
}

function changedEdits() {
  const out = [];
  for (const row of document.querySelectorAll('.qrow.editing')) {
    const inp = row.querySelector('.qamount');
    const note = row.querySelector('.qnote');
    const amount = Math.round(Number(inp.value));
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (String(amount) === inp.dataset.orig && note.value.trim() === note.dataset.orig) continue;
    out.push({ id: row.dataset.editId, amount, note: note.value.trim() });
  }
  return out;
}

function updateQuickBar() {
  let count = 0;
  let sum = 0;
  for (const row of document.querySelectorAll('.qrow[data-name]')) {
    const v = Math.round(Number(row.querySelector('.qamount').value));
    if (Number.isFinite(v) && v > 0) { count += 1; sum += v; }
  }
  const edits = changedEdits().length;

  $('qSave').disabled = count === 0 && edits === 0;

  const parts = [];
  if (count) parts.push(`${count} ${plural(count, 'выплата', 'выплаты', 'выплат')} · ${fmtMoney(sum)}`);
  if (edits) parts.push(`${edits} ${plural(edits, 'правка', 'правки', 'правок')}`);
  $('qSum').textContent = parts.join(', ') || 'Впиши суммы тем, кто работал';
}

$('qList').addEventListener('input', (e) => {
  const inp = e.target.closest('.qamount, .qnote');
  if (!inp) return;
  if (inp.classList.contains('qamount')) {
    // комментарий появляется только у того, кому вписали сумму
    const note = inp.parentElement.querySelector('.qnote');
    if (note && !inp.parentElement.classList.contains('editing')) note.hidden = !(Number(inp.value) > 0);
  }
  updateQuickBar();
});

$('qList').addEventListener('click', (e) => {
  const cancel = e.target.closest('.cancel-edit');
  if (cancel) {
    editing.delete(cancel.closest('.qrow').dataset.editId);
    renderQuick(true);
    return;
  }
  const done = e.target.closest('.qrow.is-done[data-edit-id]');
  if (!done) return;
  editing.add(done.dataset.editId);
  renderQuick(true);
});

$('qMore').addEventListener('click', () => {
  showAllWorkers = !showAllWorkers;
  renderQuick(true);
});

$('qDate').addEventListener('change', () => {
  editing.clear(); // другой день — прежние правки к нему не относятся
  renderQuick();
});

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

  const edits = changedEdits();
  if (!added.length && !edits.length) return;

  for (const ed of edits) {
    const p = state.payments.find((x) => x.id === ed.id);
    if (!p) continue;
    p.amount = ed.amount;
    p.note = ed.note;
  }
  state.payments.push(...added);
  save();

  editing.clear();
  $('month').value = date.slice(0, 7);
  renderQuick();
  renderNames();
  renderMonth();

  // строку итога на пару секунд подменяем подтверждением
  const bar = $('qSum');
  if (added.length && edits.length) bar.textContent = `Записано: ${added.length}, исправлено: ${edits.length}`;
  else if (added.length) bar.textContent = `Записано: ${added.length}`;
  else bar.textContent = `Исправлено: ${edits.length}`;
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
  renderQuick(true);
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
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
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
    <button type="button" class="del" data-id="${esc(p.id)}" aria-label="Удалить запись">×</button>
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
  const p = state.payments.find((x) => String(x.id) === btn.dataset.id);
  if (!p) return;
  if (!confirm(`Удалить запись: ${p.name}, ${fmtMoney(p.amount)}, ${fmtDate(p.date)}?`)) return;
  state.payments = state.payments.filter((x) => x !== p);
  save();
  editing.delete(p.id);
  renderNames();
  renderQuick(true);
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

/* ---------- резервная копия ---------- */
$('backup').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vyplaty-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  flash($('toolsMsg'), `В копии записей: ${state.payments.length}`);
});

function validPayment(r) {
  return r && typeof r === 'object'
    && r.id !== undefined && r.id !== null
    && typeof r.name === 'string' && r.name.trim() !== ''
    && Number.isFinite(Number(r.amount)) && Number(r.amount) > 0
    && typeof r.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.date);
}

$('restoreFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();

  reader.onerror = () => { alert('Не удалось прочитать файл.'); e.target.value = ''; };
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch (err) {
      alert('Не похоже на файл копии: содержимое не читается.');
      e.target.value = '';
      return;
    }

    const rows = Array.isArray(data) ? data : (data && Array.isArray(data.payments) ? data.payments : null);
    if (!rows) {
      alert('Не похоже на файл копии: внутри нет списка выплат.');
      e.target.value = '';
      return;
    }

    // восстановление только добавляет: ничего из того, что уже есть, не трогаем
    const have = new Set(state.payments.map((p) => String(p.id)));
    const fresh = [];
    let dup = 0;
    let bad = 0;
    for (const r of rows) {
      if (!validPayment(r)) { bad += 1; continue; }
      const id = String(r.id);
      if (have.has(id)) { dup += 1; continue; }
      have.add(id);
      fresh.push({
        id,
        name: String(r.name).trim().replace(/\s+/g, ' '),
        amount: Math.round(Number(r.amount)),
        date: r.date,
        note: r.note ? String(r.note).slice(0, 120) : '',
      });
    }

    e.target.value = ''; // чтобы тот же файл можно было выбрать повторно

    if (!fresh.length) {
      alert(`Новых записей в файле нет.\nУже есть: ${dup}. Не удалось разобрать: ${bad}.`);
      return;
    }
    if (!confirm(`В файле записей: ${rows.length}.\n\nДобавить новых: ${fresh.length}\nУже есть: ${dup}\nНе удалось разобрать: ${bad}\n\nТо, что уже записано, не изменится.`)) return;

    state.payments.push(...fresh);
    save();
    renderNames();
    renderQuick();
    renderMonth();
    flash($('toolsMsg'), `Добавлено записей: ${fresh.length}`);
  };

  reader.readAsText(file);
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
