// Track Your IBD. Everything you enter is stored in this browser (IndexedDB) and never leaves the device.
(() => {
'use strict';
/* ---------- helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clone = o => (o == null ? o : JSON.parse(JSON.stringify(o)));
const pad = n => String(n).padStart(2, '0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseYmd = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d || 1); };
const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
const today = () => ymd(new Date());
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toMin = hm => { if (typeof hm !== 'string' || !hm.includes(':')) return null; const [h, m] = hm.split(':').map(Number); return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null; };
const fromMin = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`; };
const at = (date, hm) => { const d = parseYmd(date); const m = toMin(hm) ?? 0; d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d.getTime(); };
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = v => { if (v == null || v === '') return null; const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
const fmtNum = n => (n == null ? '' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 }));
const plural = (n, one, many) => (n === 1 ? one : many);
const wait = ms => new Promise(r => setTimeout(r, ms));
const TIME_FMT = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const DAY_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
const LONG_FMT = new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
const MONTH_FMT = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' });
const fmtTime = hm => { const m = toMin(hm); return m == null ? '' : TIME_FMT.format(new Date(2000, 0, 1, Math.floor(m / 60), m % 60)); };
const fmtDay = s => DAY_FMT.format(parseYmd(s));
const fmtDur = mins => { if (mins == null || !Number.isFinite(mins)) return '–'; mins = Math.max(0, Math.round(mins)); const h = Math.floor(mins / 60), m = mins % 60; return h ? `${h}h ${pad(m)}m` : `${m}m`; };
const icon = n => `<svg class="ic" aria-hidden="true"><use href="#i-${n}"/></svg>`;

/* ---------- vocabulary ---------- */
const BRISTOL = [null, 'Separate hard lumps', 'Lumpy, sausage-shaped', 'Sausage with cracks', 'Smooth and soft', 'Soft blobs, clear edges', 'Mushy, ragged edges', 'Watery, no solid pieces'];
const BLOOD = ['None', 'Streaks', 'Visible', 'Mostly blood'];
const URGENCY = ['Could wait', 'Had to hurry', 'Had to go right away', 'Accident'];
const WELLBEING = ['Very well', 'Slightly below par', 'Poor', 'Very poor', 'Terrible'];
const EXTRA = [
  { id: 'joints', label: 'Joint pain', sccai: true, hbi: true },
  { id: 'eyes', label: 'Eye pain or redness', sccai: true, hbi: true },
  { id: 'lumps', label: 'Painful red lumps on skin', sccai: true, hbi: true },
  { id: 'sores', label: 'Skin sores or ulcers', sccai: true, hbi: true },
  { id: 'mouth', label: 'Mouth ulcers', sccai: false, hbi: true },
  { id: 'fissure', label: 'Anal fissure', sccai: false, hbi: true, cd: true },
  { id: 'fistula', label: 'New fistula', sccai: false, hbi: true, cd: true },
  { id: 'abscess', label: 'Abscess', sccai: false, hbi: true, cd: true },
];
const CONDITIONS = [['uc', 'Ulcerative colitis'], ['cd', "Crohn's disease"], ['ibdu', 'IBD, type not confirmed'], ['unsure', 'Not sure']];
const MACROS = [['carbs', 'Carbs', 'c'], ['protein', 'Protein', 'p'], ['fat', 'Fat', 'f'], ['fiber', 'Fibre', 'fb']];
// Stored tag values keep their original spelling; this is only what people see.
const tagLabel = t => (t === 'High-fiber' ? 'High-fibre' : t);
const FLOW = ['No bleeding', 'Spotting', 'Light', 'Medium', 'Heavy'];
const PERIOD_SYMPTOMS = ['Cramps', 'Bloating', 'Back pain', 'Headache', 'Breast tenderness', 'Mood changes', 'Tiredness', 'Nausea'];
const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drink'];
const FOOD_TAGS = ['Dairy', 'Spicy', 'High-fiber', 'Fried or fatty', 'Gluten', 'High-FODMAP', 'Alcohol', 'Caffeine', 'Raw veg', 'Sugary', 'Red meat', 'Processed'];
const PORTIONS = ['Small', 'Normal', 'Large'];
const EX_TYPES = ['Walk', 'Run', 'Cycling', 'Strength', 'Yoga', 'Swimming', 'Sport', 'Other'];
const INTENSITY = ['Easy', 'Moderate', 'Hard'];
const EX_SYMPTOMS = ['None', 'Some discomfort', 'Had to stop'];
const SLEEP_FACTORS = ['Screens in bed', 'Stressed', 'Pain', 'Noise or light', 'Too hot or cold'];
const KINDS = { medicine: 'Medicine', vitamin: 'Vitamin', supplement: 'Supplement' };
const KIND_ORDER = { medicine: 0, vitamin: 1, supplement: 2 };
const CATEGORIES = ['UC maintenance', 'Steroid', 'Biologic', 'Immunomodulator', 'Small molecule', 'Anti-diarrheal', 'Painkiller', 'Antibiotic', 'Other'];
const FORMS = {
  tablet: ['Tablet', 'tablet', 'tablets'], capsule: ['Capsule', 'capsule', 'capsules'], sachet: ['Sachet or granules', 'sachet', 'sachets'],
  liquid: ['Liquid', 'dose', 'doses'], gummy: ['Gummy', 'gummy', 'gummies'], drops: ['Drops', 'drop', 'drops'],
  suppository: ['Suppository', 'suppository', 'suppositories'], enema: ['Enema', 'enema', 'enemas'], foam: ['Rectal foam', 'application', 'applications'],
  injection: ['Injection', 'injection', 'injections'], infusion: ['Infusion', 'infusion', 'infusions'], other: ['Other', 'dose', 'doses'],
};
const UNITS = ['mg', 'g', 'mcg', 'IU', 'mL', 'billion CFU', 'other'];
const SITES = ['Left thigh', 'Right thigh', 'Left abdomen', 'Right abdomen', 'Left arm', 'Right arm'];
const SKIP_REASONS = ['Forgot', 'Side effects', 'Ran out', 'Felt unwell', 'Doctor advised', 'Other'];
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const FOOD = { any: '', with: 'with food', empty: 'on an empty stomach' };
const PRESETS = [
  { kind: 'medicine', name: 'Mesalamine', category: 'UC maintenance', form: 'tablet', unit: 'g' },
  { kind: 'medicine', name: 'Mesalamine suppository', category: 'UC maintenance', form: 'suppository', unit: 'g' },
  { kind: 'medicine', name: 'Sulfasalazine', category: 'UC maintenance', form: 'tablet', unit: 'mg' },
  { kind: 'medicine', name: 'Budesonide', category: 'Steroid', form: 'tablet', unit: 'mg' },
  { kind: 'medicine', name: 'Prednisone', category: 'Steroid', form: 'tablet', unit: 'mg', taper: true },
  { kind: 'medicine', name: 'Azathioprine', category: 'Immunomodulator', form: 'tablet', unit: 'mg' },
  { kind: 'medicine', name: 'Infliximab', category: 'Biologic', form: 'infusion', unit: 'mg', schedule: 'interval' },
  { kind: 'medicine', name: 'Adalimumab', category: 'Biologic', form: 'injection', unit: 'mg', schedule: 'interval' },
  { kind: 'medicine', name: 'Vedolizumab', category: 'Biologic', form: 'infusion', unit: 'mg', schedule: 'interval' },
  { kind: 'medicine', name: 'Ustekinumab', category: 'Biologic', form: 'injection', unit: 'mg', schedule: 'interval' },
  { kind: 'medicine', name: 'Tofacitinib', category: 'Small molecule', form: 'tablet', unit: 'mg' },
  { kind: 'medicine', name: 'Upadacitinib', category: 'Small molecule', form: 'tablet', unit: 'mg' },
  { kind: 'medicine', name: 'Ozanimod', category: 'Small molecule', form: 'capsule', unit: 'mg' },
  { kind: 'medicine', name: 'Loperamide', category: 'Anti-diarrheal', form: 'capsule', unit: 'mg', schedule: 'prn' },
  { kind: 'medicine', name: 'Paracetamol', category: 'Painkiller', form: 'tablet', unit: 'mg', schedule: 'prn' },
  { kind: 'vitamin', name: 'Vitamin D3', form: 'capsule', unit: 'IU' },
  { kind: 'vitamin', name: 'Vitamin B12', form: 'tablet', unit: 'mcg' },
  { kind: 'vitamin', name: 'Folic acid', form: 'tablet', unit: 'mg' },
  { kind: 'vitamin', name: 'Multivitamin', form: 'tablet', unit: 'other' },
  { kind: 'supplement', name: 'Iron', form: 'tablet', unit: 'mg' },
  { kind: 'supplement', name: 'Calcium', form: 'tablet', unit: 'mg' },
  { kind: 'supplement', name: 'Probiotic', form: 'capsule', unit: 'billion CFU' },
  { kind: 'supplement', name: 'Omega-3', form: 'capsule', unit: 'mg' },
  { kind: 'supplement', name: 'Curcumin', form: 'capsule', unit: 'mg' },
  { kind: 'supplement', name: 'Magnesium', form: 'tablet', unit: 'mg' },
  { kind: 'supplement', name: 'Psyllium', form: 'sachet', unit: 'g' },
  { kind: 'supplement', name: 'Zinc', form: 'tablet', unit: 'mg' },
];


/* ---------- state ---------- */
const LS_KEY = 'ibd-tracker-v1';
const DEFAULT_SETTINGS = { condition: null, waterGoal: 8, glassMl: 250, weightUnit: 'kg', favorites: [], sleepPending: null, started: false, lastBackup: null, backupEvery: 7, backupSnooze: null, installTipHidden: false, trackCycle: false, favDismissed: [] };
let R = { days: {}, meds: {}, settings: clone(DEFAULT_SETTINGS) };
let SAMPLE = null;
const D = () => SAMPLE || R;
const S = { tab: 'today', date: today(), followToday: true, histMonth: today().slice(0, 7), trendDays: 30, ready: false, open: {} };

/* ---------- storage: everything stays in this browser (IndexedDB) ---------- */
function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('ibd-tracker', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}
function idbAll(db, keys) {
  return new Promise((resolve, reject) => {
    const out = [], tx = db.transaction('kv', 'readonly'), st = tx.objectStore('kv');
    if (keys) {
      keys.forEach(k => { const r = st.get(k); r.onsuccess = () => out.push([k, r.result ?? null]); });
      tx.oncomplete = () => resolve(out);
    } else {
      const req = st.openCursor();
      req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out); };
    }
    tx.onerror = () => reject(tx.error);
  });
}
function idbWrite(db, entries) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite'), st = tx.objectStore('kv');
    for (const [k, v] of entries) { if (v === null) st.delete(k); else st.put(v, k); }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
function applyRecord(k, v) {
  if (k.startsWith('days/')) { const id = k.slice(5); if (v) R.days[id] = v; else delete R.days[id]; }
  else if (k.startsWith('meds/')) { const id = k.slice(5); if (v) R.meds[id] = v; else delete R.meds[id]; }
  else if (k === 'meta/settings') R.settings = Object.assign(clone(DEFAULT_SETTINGS), v || {});
}
const Store = {
  mode: 'loading', db: null, pend: new Map(), timer: null, persisted: null, channel: null,

  async init() {
    try {
      this.db = await idbOpen();
      for (const [k, v] of await idbAll(this.db)) applyRecord(k, v);
      this.mode = 'idb';
    } catch (e) {
      this.db = null;
      try {
        const raw = localStorage.getItem(LS_KEY);
        this.mode = 'local';
        if (raw) { const o = JSON.parse(raw); R.days = o.days || {}; R.meds = o.meds || {}; R.settings = Object.assign(clone(DEFAULT_SETTINGS), o.settings || {}); }
      } catch (e2) { this.mode = 'memory'; }
    }
    // Other open tabs of the app tell us what they changed.
    try {
      this.channel = new BroadcastChannel('ibd-tracker');
      this.channel.onmessage = async e => {
        if (!this.db || !e.data || !Array.isArray(e.data.keys)) return;
        for (const [k, v] of await idbAll(this.db, e.data.keys)) if (!this.pend.has(k)) applyRecord(k, v);
        scheduleRender();
      };
    } catch (e) { /* older browsers */ }
    this.checkPersist();
    markReady();
  },

  async checkPersist(ask) {
    try {
      if (!navigator.storage || !navigator.storage.persisted) return;
      this.persisted = await navigator.storage.persisted();
      if (!this.persisted && (ask || R.settings.started)) this.persisted = await navigator.storage.persist();
    } catch (e) { /* not supported */ }
  },

  write(path, data) {
    if (this.mode === 'memory') return;
    this.pend.set(path, data);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 250);
  },

  async flush() {
    clearTimeout(this.timer);
    if (!this.pend.size) return;
    const entries = [...this.pend.entries()];
    this.pend.clear();
    if (this.mode === 'idb') {
      try {
        await idbWrite(this.db, entries.map(([k, v]) => [k, v === null ? null : clone(v)]));
        if (this.channel) this.channel.postMessage({ keys: entries.map(e => e[0]) });
      } catch (e) {
        toast(e && e.name === 'QuotaExceededError' ? 'This device is out of space. Save a backup, then free up space.' : "Couldn't save your last change. Try again.");
      }
    } else if (this.mode === 'local') {
      try { localStorage.setItem(LS_KEY, JSON.stringify({ v: 1, days: R.days, meds: R.meds, settings: R.settings })); }
      catch (e) { toast('This browser is out of space. Save a backup from More.'); }
    }
  },
  flushAll() { this.flush(); },

  async putNow(path, data) { this.pend.set(path, data); await this.flush(); },

  async clearAll() {
    this.pend.clear();
    if (this.mode === 'idb') {
      await new Promise((resolve, reject) => { const tx = this.db.transaction('kv', 'readwrite'); tx.objectStore('kv').clear(); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      if (this.channel) this.channel.postMessage({ keys: [] });
    } else if (this.mode === 'local') { try { localStorage.removeItem(LS_KEY); } catch (e) { /* ignore */ } }
    R = { days: {}, meds: {}, settings: clone(DEFAULT_SETTINGS) };
  },
};
function persist(path, data) { if (!SAMPLE) Store.write(path, data); }
function saveSettings() { persist('meta/settings', D().settings); }
function saveMed(m) { D().meds[m.id] = m; persist('meds/' + m.id, m); scheduleRender(); }
function deleteMed(id) { delete D().meds[id]; persist('meds/' + id, null); scheduleRender(); }

function blankDay(date) { return { date, bm: [], meals: [], doses: [], exercise: [], naps: [], water: 0, sleep: null, checkin: null }; }
function getDay(date) { return D().days[date] || blankDay(date); }
function mutDay(date, fn) {
  const d = Object.assign(blankDay(date), clone(D().days[date] || {}));
  fn(d);
  d.date = date; d.updatedAt = Date.now();
  D().days[date] = d;
  persist('days/' + date, d);
  scheduleRender();
}
function upsertEntry(date, list, entry) {
  mutDay(date, d => {
    const i = d[list].findIndex(x => x.id === entry.id);
    if (i >= 0) d[list][i] = entry; else d[list].push(entry);
  });
}
function removeEntry(date, list, id, label) {
  let removed = null;
  mutDay(date, d => { const i = d[list].findIndex(x => x.id === id); if (i >= 0) removed = d[list].splice(i, 1)[0]; });
  if (removed) toast(`Deleted ${label || 'entry'}`, 'Undo', () => upsertEntry(date, list, removed));
}

/* ---------- medicines ---------- */
function newMed(p = {}) {
  const kind = p.kind || 'medicine';
  return {
    id: uid(), kind, name: p.name || '', category: kind === 'medicine' ? (p.category || 'Other') : '',
    form: p.form || 'tablet', strength: null, unit: p.unit || 'mg', qty: 1,
    schedule: { type: p.schedule || 'daily', times: ['08:00'], weekdays: [1], everyDays: p.schedule === 'interval' ? 56 : 14, anchor: today() },
    taper: { on: !!p.taper, startDose: null, step: 5, everyDays: 7, endDose: 0, startDate: today() },
    food: 'any', instructions: '', startDate: today(), endDate: '', stock: null, refillDays: 7, changes: [], createdAt: Date.now(),
  };
}
const formWord = (form, qty) => (FORMS[form] || FORMS.other)[qty === 1 ? 1 : 2];
const medActiveOn = (m, date) => (!m.startDate || date >= m.startDate) && (!m.endDate || date <= m.endDate);
const isStopped = m => !!(m.endDate && m.endDate < today());

function taperDose(m, date) {
  const t = m.taper;
  if (!t || !t.on || t.startDose == null) return null;
  const d = daysBetween(t.startDate, date);
  if (d < 0) return null;
  const steps = Math.floor(d / Math.max(1, t.everyDays || 7));
  return Math.max(t.endDose || 0, t.startDose - (t.step || 0) * steps);
}
function doseAmount(m, date) {
  const td = taperDose(m, date);
  if (td != null) return { amount: td, qty: m.strength ? td / m.strength : null };
  return { amount: m.strength != null ? m.strength * (m.qty || 1) : null, qty: m.qty || 1 };
}
function doseText(m, date = today()) {
  const a = doseAmount(m, date), parts = [];
  if (a.qty != null) parts.push(`${fmtNum(a.qty)} ${formWord(m.form, a.qty)}`);
  if (a.amount != null && m.unit !== 'other') parts.push(`${fmtNum(a.amount)} ${m.unit}`);
  return parts.join(' · ');
}
function slotsFor(m, date) {
  if (!medActiveOn(m, date)) return [];
  const s = m.schedule || {};
  if (s.type === 'prn') return [];
  if (m.taper && m.taper.on) { const td = taperDose(m, date); if (td == null || td <= 0) return []; }
  if (s.type === 'weekly') {
    const wd = ((parseYmd(date).getDay() + 6) % 7) + 1;
    if (!(s.weekdays || []).includes(wd)) return [];
  }
  if (s.type === 'interval') {
    const n = Math.max(1, s.everyDays || 1), d = daysBetween(s.anchor || m.startDate || date, date);
    if (((d % n) + n) % n !== 0) return [];
  }
  const times = s.times && s.times.length ? s.times : ['08:00'];
  return (s.type === 'interval' ? times.slice(0, 1) : times).map(time => ({ medId: m.id, time }));
}
function nextDue(m, from) {
  for (let i = 0; i < 400; i++) { const d = addDays(from, i); if (slotsFor(m, d).length) return d; }
  return null;
}
function scheduleText(m) {
  const s = m.schedule || {};
  const times = (s.times || []).map(fmtTime).join(', ');
  if (s.type === 'prn') return 'As needed';
  if (s.type === 'weekly') return `${(s.weekdays || []).slice().sort().map(d => WEEKDAYS[d - 1]).join(', ')} · ${times}`;
  if (s.type === 'interval') {
    const n = s.everyDays || 1;
    return n % 7 === 0 ? `Every ${n === 7 ? 'week' : n / 7 + ' weeks'}` : `Every ${n === 1 ? 'day' : n + ' days'}`;
  }
  const count = (s.times || []).length;
  return `${['', 'Once', 'Twice', '3 times', '4 times'][count] || count + ' times'} a day · ${times}`;
}
function taperText(m) {
  const t = m.taper;
  if (!t || !t.on || t.startDose == null) return '';
  const td = today(), cur = taperDose(m, td), end = t.endDose || 0, u = m.unit;
  if (cur == null) return `Taper starts ${fmtDay(t.startDate)} at ${fmtNum(t.startDose)} ${u}`;
  if (!t.step) return `Holding at ${fmtNum(cur)} ${u}`;
  if (cur <= end) return end ? `Taper done · staying at ${fmtNum(end)} ${u}` : 'Taper finished';
  const n = Math.max(1, t.everyDays), d = daysBetween(t.startDate, td), k = Math.floor(d / n);
  const nextDate = addDays(t.startDate, (k + 1) * n), nextDose = Math.max(end, cur - t.step);
  const stepsLeft = Math.ceil((cur - end) / t.step), endDate = addDays(t.startDate, (k + stepsLeft) * n);
  const next = nextDose > 0 ? `${fmtNum(nextDose)} ${u} from ${fmtDay(nextDate)}` : `stop on ${fmtDay(nextDate)}`;
  const last = end > 0 ? `reaches ${fmtNum(end)} ${u} ${fmtDay(endDate)}` : `last dose ${fmtDay(addDays(endDate, -1))}`;
  return `Taper: ${fmtNum(cur)} ${u} now · ${next} · ${last}`;
}
function firstLogDate() {
  let min = null;
  for (const [date, d] of Object.entries(D().days)) {
    const has = (d.bm || []).length || (d.meals || []).length || (d.doses || []).length || d.sleep || d.checkin || (d.exercise || []).length;
    if (has && (!min || date < min)) min = date;
  }
  return min;
}
function takenCount(day, medId) { return ((day && day.doses) || []).filter(x => x.medId === medId && x.status === 'taken').length; }
function adherence(m, from, to) {
  let due = 0, taken = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const n = slotsFor(m, d).length;
    if (!n) continue;
    due += n; taken += Math.min(n, takenCount(D().days[d], m.id));
  }
  return due ? { due, taken, pct: Math.round((taken / due) * 100) } : null;
}
function stripStates(m, days = 14) {
  const t = today(), first = firstLogDate() || t, out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(t, -i), n = slotsFor(m, d).length;
    let cls = 'none', label = 'Not scheduled';
    if (n && d >= first) {
      const k = Math.min(n, takenCount(D().days[d], m.id));
      if (d === t && k < n) { cls = 'pend'; label = `${k} of ${n} so far`; }
      else if (k === n) { cls = 'full'; label = 'All taken'; }
      else if (k > 0) { cls = 'part'; label = `${k} of ${n} taken`; }
      else { cls = 'miss'; label = 'None logged'; }
    } else if (n) { label = 'Before your log started'; }
    out.push({ d, cls, label });
  }
  return out;
}
function avgDailyQty(m) {
  let q = 0;
  const t = today();
  for (let i = 0; i < 28; i++) { const d = addDays(t, i); const n = slotsFor(m, d).length; if (n) q += n * (doseAmount(m, d).qty ?? 1); }
  return q / 28;
}
function stockLeft(m) {
  if (!m.stock || m.stock.count == null) return null;
  let used = 0;
  for (const [date, day] of Object.entries(D().days)) {
    if (date < m.stock.date) continue;
    for (const x of day.doses || []) {
      if (x.medId !== m.id || x.status !== 'taken') continue;
      if (date === m.stock.date && (x.t || '00:00') < (m.stock.time || '00:00')) continue;
      used += x.qty ?? 1;
    }
  }
  const left = Math.max(0, Math.round((m.stock.count - used) * 100) / 100);
  const per = avgDailyQty(m);
  return { left, days: per > 0 ? Math.floor(left / per) : null };
}
function nextSite(medId) {
  let last = null, lastKey = '';
  for (const [date, day] of Object.entries(D().days)) for (const x of day.doses || []) {
    if (x.medId === medId && x.site) { const k = date + ' ' + (x.t || ''); if (k > lastKey) { lastKey = k; last = x.site; } }
  }
  const i = SITES.indexOf(last);
  return { last, next: i >= 0 ? SITES[(i + 1) % SITES.length] : SITES[0] };
}
function hasIron() { return Object.values(D().meds).some(m => /iron|ferr/i.test(m.name) && medActiveOn(m, today())); }

/* ---------- activity score ---------- */
// Ulcerative colitis (and IBD-U / not sure): Simple Clinical Colitis Activity Index.
// Crohn's disease: Harvey-Bradshaw Index, without the abdominal-mass item (that needs a doctor's exam).
const SCORES = {
  sccai: {
    short: 'SCCAI', long: 'Simple Clinical Colitis Activity Index', max: 19,
    cuts: [2, 5, 11], segs: [[3, 'Low 0–2'], [3, 'Mild 3–5'], [6, 'Moderate 6–11'], [8, 'High 12+']],
    legend: ['Low 0–2', 'Mild 3–5', 'Moderate 6–11', 'High 12+'],
  },
  hbi: {
    short: 'HBI', long: 'Harvey-Bradshaw Index', max: 24,
    cuts: [4, 7, 16], segs: [[5, 'Low 0–4'], [3, 'Mild 5–7'], [9, 'Moderate 8–16'], [8, 'High 17+']],
    legend: ['Low 0–4', 'Mild 5–7', 'Moderate 8–16', 'High 17+'],
  },
};
const scoreKind = () => (D().settings.condition === 'cd' ? 'hbi' : 'sccai');
const scoreDef = () => SCORES[scoreKind()];
function dayScore(day) {
  if (!day) return null;
  const bm = day.bm || [], ci = day.checkin;
  if (!bm.length && !ci) return null;
  let s = 0;
  if (scoreKind() === 'hbi') {
    s += ci ? ci.wellbeing ?? 0 : 0;
    const p = ci ? ci.pain || 0 : 0;
    s += p >= 7 ? 3 : p >= 4 ? 2 : p >= 1 ? 1 : 0;
    s += bm.filter(b => (b.bristol || 0) >= 6).length;
    if (ci) s += (ci.extra || []).filter(id => (EXTRA.find(e => e.id === id) || {}).hbi).length;
    return { score: s, partial: !ci || ci.wellbeing == null, noBm: !bm.length };
  }
  const nightN = bm.filter(b => b.night).length, dayN = bm.length - nightN;
  s += dayN >= 10 ? 3 : dayN >= 7 ? 2 : dayN >= 4 ? 1 : 0;
  s += nightN >= 4 ? 2 : nightN >= 1 ? 1 : 0;
  s += bm.reduce((mx, b) => Math.max(mx, b.urgency || 0), 0);
  const visible = bm.filter(b => (b.blood || 0) >= 2).length;
  s += visible && visible / bm.length > 0.5 ? 3 : visible ? 2 : bm.some(b => b.blood) ? 1 : 0;
  if (ci) {
    s += ci.wellbeing ?? 0;
    s += (ci.extra || []).filter(id => (EXTRA.find(e => e.id === id) || {}).sccai).length;
  }
  return { score: s, partial: !ci || ci.wellbeing == null, noBm: !bm.length };
}
function band(s) {
  const c = scoreDef().cuts, labels = ['Low', 'Mild', 'Moderate', 'High'];
  const i = s <= c[0] ? 0 : s <= c[1] ? 1 : s <= c[2] ? 2 : 3;
  return { i, label: labels[i] };
}
function mealMacros(day) {
  const out = {};
  for (const [k] of MACROS) {
    const v = (day.meals || []).map(x => x[k]).filter(n => typeof n === 'number');
    out[k] = v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
  }
  return out;
}

/* ---------- menstrual cycle ---------- */
// A period starts on a day with at least light bleeding when there was none in the 3 days before.
function periodStarts() {
  const days = D().days, starts = [];
  let last = null;
  for (const d of Object.keys(days).filter(k => ((days[k].period || {}).flow || 0) >= 2).sort()) {
    if (!last || daysBetween(last, d) > 3) starts.push(d);
    last = d;
  }
  return starts;
}
function cycleInfo(date) {
  const all = periodStarts(), before = all.filter(d => d <= date);
  if (!before.length) return null;
  const lens = [];
  for (let i = 1; i < all.length; i++) { const n = daysBetween(all[i - 1], all[i]); if (n >= 18 && n <= 45) lens.push(n); }
  const recent = lens.slice(-6);
  const avg = recent.length ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length) : 28;
  const last = before[before.length - 1];
  return { last, day: daysBetween(last, date) + 1, avg, known: recent.length > 0, next: addDays(last, avg) };
}

/* ---------- sleep ---------- */
// A night is stored on the day you wake up. Bedtimes from 3 PM onward count as the previous evening.
function sleepAbs(date, hm, evening) {
  const m = toMin(hm);
  if (m == null) return null;
  return at(evening && m >= 15 * 60 ? addDays(date, -1) : date, hm);
}
function nightTrips(date, start, end) {
  let n = 0;
  for (const dd of [addDays(date, -1), date]) for (const b of (D().days[dd] || {}).bm || []) {
    const ts = at(dd, b.t);
    if (ts > start && ts < end) n++;
  }
  return n;
}
function sleepCalc(date, s) {
  if (!s || !s.inBed || !s.wake) return null;
  const inBed = sleepAbs(date, s.inBed, true), asleep = sleepAbs(date, s.asleep || s.inBed, true);
  const wake = sleepAbs(date, s.wake, false), up = sleepAbs(date, s.up || s.wake, false);
  const mins = (a, b) => Math.round((b - a) / 60000);
  const total = mins(asleep, wake), inBedDur = mins(inBed, up), latency = mins(inBed, asleep);
  const trips = nightTrips(date, inBed, up);
  return { total, inBedDur, latency, eff: inBedDur > 0 ? Math.round((total / inBedDur) * 100) : null, trips, wakeups: trips + (s.pain || 0) + (s.other || 0) };
}
function autoFactors(date) {
  const prev = addDays(date, -1), pd = D().days[prev] || {}, out = [];
  const meals = pd.meals || [];
  const last = meals.map(x => x.t).filter(Boolean).sort().pop();
  if (last) out.push(`Last meal ${fmtTime(last)}`);
  if (meals.some(x => (x.tags || []).includes('Caffeine') && x.t >= '14:00')) out.push('Caffeine after 2 PM');
  if (meals.some(x => (x.tags || []).includes('Alcohol'))) out.push('Alcohol');
  const meds = D().meds;
  if ((pd.doses || []).some(x => x.status === 'taken' && x.t >= '14:00' && meds[x.medId] && meds[x.medId].category === 'Steroid')) out.push('Steroid after 2 PM');
  return out;
}
function lastSleep(before) {
  const keys = Object.keys(D().days).filter(k => k < before && D().days[k].sleep).sort();
  return keys.length ? D().days[keys[keys.length - 1]].sleep : null;
}

/* ---------- sample data (kept in memory, never saved) ---------- */
function rng(seed) {
  let a = seed;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function makeSample() {
  const rnd = rng(20260927);
  const r = (a, b) => a + rnd() * (b - a), ri = (a, b) => Math.floor(r(a, b + 1)), pick = arr => arr[Math.floor(rnd() * arr.length)];
  const SPAN = 84, t0 = today(), start = addDays(t0, -SPAN), nowM = toMin(nowHM());
  const meds = {};
  const daily = times => ({ type: 'daily', times, weekdays: [], everyDays: 7, anchor: start });
  const add = (key, o) => { const m = Object.assign(newMed({ kind: o.kind }), o); m.id = 'sample-' + key; meds[m.id] = m; return m; };
  add('mesa', { name: 'Mesalamine', category: 'UC maintenance', form: 'tablet', strength: 1.2, unit: 'g', qty: 2, schedule: daily(['08:00', '20:00']), food: 'with', startDate: start, stock: { count: 120, date: addDays(t0, -14), time: '00:00' } });
  add('pred', { name: 'Prednisone', category: 'Steroid', form: 'tablet', strength: 5, unit: 'mg', qty: 1, schedule: daily(['08:00']), taper: { on: true, startDose: 40, step: 5, everyDays: 7, endDose: 0, startDate: addDays(t0, -27) }, food: 'with', instructions: 'Take in the morning with breakfast', startDate: addDays(t0, -27) });
  add('vedo', { name: 'Vedolizumab', category: 'Biologic', form: 'infusion', strength: 300, unit: 'mg', qty: 1, schedule: { type: 'interval', times: ['10:00'], weekdays: [], everyDays: 56, anchor: addDays(t0, 16) }, startDate: addDays(t0, -96) });
  add('vitd', { kind: 'vitamin', category: '', name: 'Vitamin D3', form: 'capsule', strength: 1000, unit: 'IU', qty: 1, schedule: daily(['08:00']), food: 'with', startDate: start });
  add('iron', { kind: 'supplement', category: '', name: 'Iron bisglycinate', form: 'tablet', strength: 25, unit: 'mg', qty: 1, schedule: daily(['13:00']), food: 'empty', instructions: 'Keep 2 hours apart from calcium', startDate: start, stock: { count: 30, date: addDays(t0, -24), time: '00:00' } });
  add('calc', { kind: 'supplement', category: '', name: 'Calcium', form: 'tablet', strength: 500, unit: 'mg', qty: 1, schedule: daily(['20:00']), food: 'with', startDate: start });
  add('prob', { kind: 'supplement', category: '', name: 'Probiotic', form: 'capsule', strength: 10, unit: 'billion CFU', qty: 1, schedule: daily(['08:00']), startDate: start });
  add('lop', { name: 'Loperamide', category: 'Anti-diarrheal', form: 'capsule', strength: 2, unit: 'mg', qty: 1, schedule: { type: 'prn', times: ['08:00'], weekdays: [], everyDays: 7, anchor: start }, startDate: start });

  const B = [['Oatmeal with banana', ['High-fiber'], [8, 3, 2, 7]], ['Toast and scrambled eggs', ['Gluten'], [5, 6, 5, 2]], ['Yogurt with honey', ['Dairy'], [5, 5, 4, 2]], ['Rice porridge', [], [8, 2, 1, 2]], ['Poha with peas', [], [8, 3, 3, 5]]];
  const L = [['Rice, dal and curd', ['Dairy'], [7, 5, 3, 5]], ['Chicken sandwich', ['Gluten', 'Processed'], [6, 6, 4, 2]], ['Khichdi', [], [7, 4, 2, 5]], ['Paneer wrap', ['Dairy', 'Gluten', 'Spicy'], [6, 6, 7, 2]], ['Grilled chicken and rice', [], [6, 8, 3, 2]], ['Big salad bowl', ['Raw veg', 'High-fiber'], [4, 3, 4, 7]]];
  const N = [['Fish curry and rice', ['Spicy'], [6, 7, 4, 2]], ['Pasta in cream sauce', ['Dairy', 'Gluten', 'Fried or fatty'], [8, 4, 8, 2]], ['Chicken soup', [], [3, 7, 3, 2]], ['Vegetable curry and roti', ['Spicy', 'Gluten'], [7, 3, 5, 5]], ['Pizza', ['Dairy', 'Gluten', 'Fried or fatty', 'Processed'], [8, 5, 8, 2]], ['Steamed fish and potatoes', [], [5, 8, 2, 2]]];
  const days = {};
  for (let i = 0; i <= SPAN; i++) {
    const date = addDays(start, i), isT = date === t0, cut = isT ? nowM : 1e9;
    // a flare that settles over the last four weeks, after a calmer stretch before it
    const p = i < SPAN - 27 ? (i < 20 ? 0.9 : i < SPAN - 34 ? 0.75 + 0.2 * Math.sin(i / 3) : 0.6 * (SPAN - 27 - i) / 7) : (i - (SPAN - 27)) / 27;
    const d = blankDay(date);
    const bm = (m, night) => ({
      id: uid(), t: fromMin(m), night,
      bristol: p < 0.3 ? ri(6, 7) : p < 0.6 ? ri(5, 6) : ri(3, 5),
      blood: p < 0.25 ? (rnd() < 0.55 ? 2 : rnd() < 0.4 ? 3 : 1) : p < 0.5 ? (rnd() < 0.45 ? 1 : 0) : (rnd() < 0.06 ? 1 : 0),
      urgency: p < 0.3 ? ri(1, 2) : p < 0.6 ? ri(0, 1) : (rnd() < 0.15 ? 1 : 0),
      pain: clamp(Math.round(6 - 5 * p + r(-1.5, 1.5)), 0, 10), note: '',
    });
    const nNight = p < 0.35 ? ri(1, 2) : p < 0.6 ? (rnd() < 0.4 ? 1 : 0) : (rnd() < 0.1 ? 1 : 0);
    const nDay = Math.max(1, Math.round(7.5 - 6 * p + r(-1, 1)) - nNight);
    for (let k = 0; k < nNight; k++) d.bm.push(bm(ri(120, 300), true));
    for (let k = 0; k < nDay; k++) d.bm.push(bm(390 + (k + r(0.1, 0.9)) * (930 / nDay), false));
    d.bm = d.bm.filter(b => toMin(b.t) <= cut);

    const meal = (m, type, [desc, tags, mac]) => ({ id: uid(), t: fromMin(m), type, desc, tags: tags.slice(), portion: 'Normal', carbs: mac ? mac[0] : null, protein: mac ? mac[1] : null, fat: mac ? mac[2] : null, fiber: mac ? mac[3] : null, note: '' });
    d.meals.push(meal(ri(490, 520), 'Breakfast', pick(B)));
    if (rnd() < 0.5) d.meals.push(meal(ri(620, 650), 'Drink', ['Coffee', ['Caffeine']]));
    d.meals.push(meal(ri(780, 810), 'Lunch', pick(L)));
    if (rnd() < 0.35) d.meals.push(meal(ri(980, 1000), 'Snack', ['Banana and almonds', ['High-fiber'], [5, 3, 5, 6]]));
    d.meals.push(meal(ri(1185, 1230), 'Dinner', pick(N)));
    if (i % 11 === 4) d.meals.push(meal(1260, 'Drink', ['Glass of wine', ['Alcohol']]));
    d.meals = d.meals.filter(x => toMin(x.t) <= cut);
    d.water = isT ? Math.min(ri(5, 8), Math.floor(nowM / 110)) : ri(4, 8);

    for (const m of Object.values(meds)) for (const s of slotsFor(m, date)) {
      const tm = toMin(s.time);
      if (tm + 25 > cut) continue;
      const a = doseAmount(m, date);
      if (rnd() < 0.94) d.doses.push({ id: uid(), medId: m.id, name: m.name, slot: s.time, status: 'taken', t: fromMin(tm + ri(0, 25)), amount: a.amount, unit: m.unit, qty: a.qty ?? 1, note: '' });
      else d.doses.push({ id: uid(), medId: m.id, name: m.name, slot: s.time, status: 'skipped', t: s.time, amount: a.amount, unit: m.unit, qty: 0, reason: 'Forgot', note: '' });
    }
    if (i === SPAN - 25 || i === SPAN - 22) d.doses.push({ id: uid(), medId: 'sample-lop', name: 'Loperamide', slot: null, status: 'taken', t: '15:10', amount: 2, unit: 'mg', qty: 1, why: 'Loose stools before a meeting', note: '' });

    const inBed = ri(1360, 1430), asleep = inBed + ri(10, 35), wake = ri(390, 440), up = wake + ri(5, 20);
    if (!isT || nowM > up) {
      d.sleep = { inBed: fromMin(inBed), asleep: fromMin(asleep), wake: fromMin(wake), up: fromMin(up), quality: p < 0.4 ? ri(2, 3) : ri(3, 4), rested: p < 0.4 ? ri(2, 3) : ri(3, 4), pain: p < 0.3 ? ri(0, 1) : 0, other: rnd() < 0.2 ? 1 : 0, factors: p < 0.3 && rnd() < 0.5 ? ['Pain'] : rnd() < 0.2 ? ['Screens in bed'] : [], note: '' };
    }
    if (p > 0.3 && rnd() < 0.5) {
      const tm = ri(1080, 1110);
      if (tm < cut) d.exercise.push({ id: uid(), t: fromMin(tm), type: rnd() < 0.8 ? 'Walk' : 'Yoga', mins: ri(20, 45), intensity: rnd() < 0.7 ? 'Easy' : 'Moderate', steps: ri(2500, 5200), before: ri(2, 4), after: ri(3, 4), symptoms: 'None', note: '' });
    }
    if (!isT || nowM > 1290) {
      const wd = parseYmd(date).getDay();
      d.checkin = {
        t: '21:30', wellbeing: p < 0.3 ? ri(2, 3) : p < 0.6 ? ri(1, 2) : ri(0, 1),
        pain: clamp(Math.round(6 - 5 * p + r(-1, 1)), 0, 10), fatigue: clamp(Math.round(7 - 4 * p + r(-1, 1)), 0, 10),
        stress: p < 0.4 ? ri(2, 4) : ri(1, 3), mood: p < 0.4 ? ri(2, 3) : ri(3, 4), tenesmus: p < 0.35 && rnd() < 0.6,
        extra: p < 0.3 && rnd() < 0.5 ? ['joints'] : [], weight: wd === 1 ? Math.round((64.6 + p * 0.9 + r(-0.2, 0.2)) * 10) / 10 : null, note: '',
      };
    }
    days[date] = d;
  }
  if (R.settings.trackCycle) {
    for (let st = addDays(start, 5); st <= t0; st = addDays(st, 27 + ri(0, 3))) {
      [3, 4, 3, 2, 1].forEach((f, k) => { const dd = addDays(st, k); if (days[dd]) days[dd].period = { flow: f, symptoms: k < 2 ? ['Cramps', 'Bloating'] : k === 2 ? ['Tiredness'] : [], note: '' }; });
    }
  }
  const settings = Object.assign(clone(DEFAULT_SETTINGS), {
    started: true, condition: R.settings.condition || 'uc', trackCycle: !!R.settings.trackCycle, lastBackup: new Date().toISOString(),
    favorites: [{ desc: 'Rice, dal and curd', tags: ['Dairy'], type: 'Lunch', carbs: 7, protein: 5, fat: 3 }, { desc: 'Oatmeal with banana', tags: ['High-fiber'], type: 'Breakfast', carbs: 8, protein: 3, fat: 2 }, { desc: 'Chicken soup', tags: [], type: 'Dinner', carbs: 3, protein: 7, fat: 3 }],
  });
  return { days, meds, settings };
}

/* ---------- rendering ---------- */
let rq = 0;
function scheduleRender() { if (!rq) rq = requestAnimationFrame(() => { rq = 0; render(); }); }
function render() {
  const views = { today: viewToday, trends: viewTrends, history: viewHistory, meds: viewMeds, more: viewMore };
  const onboarding = S.ready && !SAMPLE && !R.settings.started;
  document.body.classList.toggle('onboarding', onboarding);
  $('#main').innerHTML = !S.ready ? '<p class="loading">Loading…</p>' : onboarding ? viewWelcome() : banners() + views[S.tab]();
  if (S.ready && S.tab === 'trends' && !onboarding) drawCharts();
  document.querySelectorAll('#nav button[data-tab]').forEach(b => {
    if (b.dataset.tab === S.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}
function syncState() {
  if (SAMPLE) return ['sample', 'Sample data'];
  if (Store.mode === 'memory') return ['off', 'Not saving'];
  if (Store.mode === 'loading') return ['saving', 'Loading…'];
  return ['', 'Saved on this device'];
}
function syncBadge() {
  const el = $('#sync');
  if (!el) return;
  const [cls, txt] = syncState();
  el.className = 'sync ' + cls; el.textContent = txt;
}
function syncHtml() { const [cls, txt] = syncState(); return `<span id="sync" class="sync ${cls}">${txt}</span>`; }
function daysSinceBackup() {
  const st = R.settings, first = firstLogDate();
  if (!first) return null;
  const from = st.lastBackup ? ymd(new Date(st.lastBackup)) : first;
  return daysBetween(from, today());
}
function isInstalled() {
  try { return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true; } catch (e) { return false; }
}
function banners() {
  let h = '';
  if (SAMPLE) h += `<div class="banner"><p><strong>You're looking at sample data.</strong> It shows what three months of logging looks like. Nothing you change here is saved.</p><button class="btn primary small" data-act="exitSample">${R.settings.started ? 'Back to my log' : 'Start my own log'}</button></div>`;
  if (Store.mode === 'memory' && !SAMPLE) h += `<div class="banner warn"><p>This browser is blocking storage, so entries will be lost when you close the page. Try another browser, or leave private browsing.</p></div>`;
  if (!SAMPLE && Store.mode !== 'memory') {
    const n = daysSinceBackup(), st = R.settings;
    const snoozed = st.backupSnooze && daysBetween(st.backupSnooze, today()) < 3;
    if (n != null && n >= (st.backupEvery || 7) && !snoozed) {
      h += `<div class="banner warn"><p><strong>${st.lastBackup ? `Last backup ${n} days ago.` : 'No backup yet.'}</strong> Your entries live only on this device. Save a copy to Google Drive, iCloud or Files in case it's lost or reset.</p><span class="btns"><button class="btn primary small" data-act="exportJson">${icon('save')}Save backup</button><button class="btn ghost small" data-act="snoozeBackup">Later</button></span></div>`;
    }
    if (S.tab === 'today' && !isInstalled() && !st.installTipHidden && st.started) {
      h += `<div class="banner"><p><strong>Install Track Your IBD</strong> as an app so your browser keeps your data safe and it opens like any other app.</p><span class="btns"><button class="btn small" data-act="showInstall">Show me how</button><button class="btn ghost small" data-act="hideInstallTip">Not now</button></span></div>`;
    }
  }
  return h;
}

/* ---------- today ---------- */
function relDay(date) {
  const n = daysBetween(date, today());
  return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : n > 1 ? `${n} days ago` : 'Upcoming';
}
function viewToday() {
  const date = S.date, isToday = date === today();
  const empty = !SAMPLE && !Object.keys(D().meds).length && !firstLogDate();
  return `
  <div class="daybar">
    <button class="icon-btn" data-act="prevDay" aria-label="Previous day">${icon('left')}</button>
    <div class="title"><span class="eyebrow">${relDay(date)}</span><h1>${LONG_FMT.format(parseYmd(date))}</h1></div>
    <button class="icon-btn" data-act="nextDay" aria-label="Next day" ${isToday ? 'disabled' : ''}>${icon('right')}</button>
  </div>
  <div class="btns" style="justify-content:space-between;margin-bottom:10px">${syncHtml()}${isToday ? '' : '<button class="btn small" data-act="goToday">Back to today</button>'}</div>
  ${empty ? welcomeCard() : ''}
  <div class="today">
    <div class="col">
      ${activityPanel(date)}
      ${quickGrid(date)}
      ${waterCard(date)}
      ${sleepCard(date)}
      ${periodCard(date)}
    </div>
    <div class="col">
      ${medsDueCard(date)}
      <section class="card"><div class="card-head"><h2>Timeline</h2><span class="muted">${isToday ? 'Today so far' : fmtDay(date)}</span></div>${timeline(date)}</section>
    </div>
  </div>`;
}
function welcomeCard() {
  return `<section class="card" style="margin-bottom:16px"><div class="card-head"><h2>Your log is ready</h2></div>
  <p>Start by adding the medicines, vitamins and supplements you take. Then log bathroom trips, meals and sleep as your day goes. Everything you enter stays on this device.</p>
  <div class="card-foot"><button class="btn primary" data-act="addMed">${icon('plus')}Add a medicine</button><button class="btn" data-act="new" data-kind="bm">Log a bathroom trip</button><button class="btn ghost" data-act="enterSample">Explore sample data</button></div></section>`;
}
function gauge(score) {
  const def = scoreDef(), segs = def.segs, total = def.max + 1;
  const mark = score != null ? `<i class="mark" style="left:calc(${((Math.min(score, def.max) + 0.5) / total) * 100}% - 2px)"></i>` : '';
  return `<div class="gauge" aria-hidden="true">${segs.map((s, i) => `<span class="g${i}" style="flex:${s[0]}"></span>`).join('')}${mark}</div>
    <div class="gauge-l" aria-hidden="true">${segs.map(s => `<span style="flex:${s[0]}">${s[1]}</span>`).join('')}</div>`;
}
function activityPanel(date) {
  const day = getDay(date), sc = dayScore(day);
  if (!sc) return `<section class="activity"><span class="eyebrow">Estimated activity</span><p class="act-empty">Log bathroom trips and an evening check-in to see an estimated ${scoreDef().short} activity score for this day.</p>${gauge(null)}</section>`;
  const b = band(sc.score), bm = day.bm || [], ci = day.checkin;
  const night = bm.filter(x => x.night).length;
  const maxBlood = bm.reduce((m, x) => Math.max(m, x.blood || 0), 0);
  const maxUrg = bm.reduce((m, x) => Math.max(m, x.urgency || 0), 0);
  const facts = [`<span class="fact">${bm.length} ${plural(bm.length, 'trip', 'trips')}${night ? ` · ${night} at night` : ''}</span>`];
  facts.push(maxBlood ? `<span class="fact blood">Blood: ${BLOOD[maxBlood].toLowerCase()}</span>` : bm.length ? '<span class="fact">No blood</span>' : '');
  if (maxUrg) facts.push(`<span class="fact warn">${URGENCY[maxUrg]}</span>`);
  facts.push(ci ? `<span class="fact">Feeling: ${WELLBEING[ci.wellbeing ?? 0].toLowerCase()}</span>` : '');
  if (ci) for (const id of ci.extra || []) { const e = EXTRA.find(x => x.id === id); if (e) facts.push(`<span class="fact">${e.label}</span>`); }
  return `<section class="activity" aria-label="Estimated ${scoreDef().short} ${sc.score}, ${b.label}">
    <div class="act-top">
      <div><span class="eyebrow">Estimated activity</span><div class="act-row"><span class="act-score">${sc.score}</span><span class="band b${b.i}">${b.label}</span><span class="act-scale">${scoreDef().short}, of ${scoreDef().max}</span></div></div>
      <p class="act-note">${sc.partial ? 'Add an evening check-in to include how you feel.' : `Estimated ${scoreDef().long}. A guide to trends, not a diagnosis.`}</p>
    </div>
    ${gauge(sc.score)}
    <div class="facts">${facts.join('')}</div>
  </section>`;
}
function quickGrid(date) {
  const day = getDay(date), isToday = date === today();
  const slots = Object.values(D().meds).flatMap(m => slotsFor(m, date));
  const taken = slots.filter(s => (day.doses || []).some(x => x.medId === s.medId && x.slot === s.time && x.status === 'taken')).length;
  const sc = sleepCalc(date, day.sleep), pend = D().settings.sleepPending;
  const exMins = (day.exercise || []).reduce((a, x) => a + (x.mins || 0), 0);
  const n = (list, word) => (list.length ? `${list.length} ${isToday ? 'today' : 'logged'}` : word);
  const items = [
    ['bm', 'Bathroom', n(day.bm, 'Log a trip')],
    ['meal', 'Meal', n(day.meals, 'Log food or drink')],
    ['dose', 'Medicine', slots.length ? `${taken} of ${slots.length} taken` : 'Log a dose'],
    ['sleep', 'Sleep', sc ? `${fmtDur(sc.total)} asleep` : pend && pend.date === date ? 'In bed' : isToday ? 'Log last night' : 'Log that night'],
    ['ex', 'Exercise', exMins ? `${exMins} min` : 'Log activity'],
    ['checkin', 'Check-in', day.checkin ? 'Done' : isToday ? 'How do you feel?' : 'Not done'],
  ];
  return `<div class="quick" role="group" aria-label="Log something">${items.map(([k, label, sub]) =>
    `<button class="qbtn k-${k}" data-act="new" data-kind="${k}">${icon(k)}<strong>${label}</strong><small>${esc(sub)}</small></button>`).join('')}</div>`;
}
function waterCard(date) {
  const day = getDay(date), n = day.water || 0, goal = D().settings.waterGoal || 8, ml = D().settings.glassMl || 250;
  const pips = Array.from({ length: Math.max(goal, n) }, (_, i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
  const mac = mealMacros(day), rated = MACROS.some(([k]) => mac[k] != null);
  const macHtml = rated ? `<div class="macro-row" aria-label="Average food ratings for this day">${MACROS.map(([k, label, c]) => `<div class="macro"><span class="lbl"><span>${label}</span><span class="mono">${mac[k] != null ? fmtNum(mac[k]) : '–'}/10</span></span><div class="macro-bar ${c}"><i style="width:${(mac[k] || 0) * 10}%"></i></div></div>`).join('')}</div>` : '';
  return `<section class="card"><div class="water-row">${icon('water')}
    <div class="grow"><strong>Water</strong> <span class="muted">${n} of ${goal} glasses · ${fmtNum((n * ml) / 1000)} L</span><div class="pips" aria-hidden="true">${pips}</div></div>
    <button class="icon-btn bordered" data-act="water" data-d="-1" aria-label="Remove a glass" ${n ? '' : 'disabled'}>${icon('minus')}</button>
    <button class="icon-btn bordered" data-act="water" data-d="1" aria-label="Add a glass">${icon('plus')}</button>
  </div>${macHtml}</section>`;
}
function sleepCard(date) {
  const isToday = date === today(), day = getDay(date), sl = day.sleep, c = sleepCalc(date, sl);
  const pend = D().settings.sleepPending, h = new Date().getHours();
  let body;
  if (pend && pend.date === date && !sl) {
    body = `<div class="sleep-pend"><strong>In bed since ${fmtTime(pend.inBed)}</strong><div class="btns"><button class="btn primary" data-act="awake">${icon('today')}I'm awake</button><button class="btn ghost small" data-act="cancelBed">Cancel</button></div></div>`;
  } else if (c) {
    const chips = [];
    if (sl.quality) chips.push(`<span class="fact">Quality ${sl.quality}/5</span>`);
    if (sl.rested) chips.push(`<span class="fact">Rested ${sl.rested}/5</span>`);
    if (c.eff != null) chips.push(`<span class="fact">${c.eff}% of time in bed asleep</span>`);
    for (const f of (sl.factors || []).concat(autoFactors(date))) chips.push(`<span class="fact">${esc(f)}</span>`);
    body = `<div class="sleep-stats">
      <div><span class="lbl">Asleep</span><b>${fmtDur(c.total)}</b></div>
      <div><span class="lbl">In bed</span><b class="mono">${fmtTime(sl.inBed)}–${fmtTime(sl.up || sl.wake)}</b></div>
      <div><span class="lbl">Fell asleep in</span><b>${fmtDur(c.latency)}</b></div>
      <div><span class="lbl">Woke up</span><b>${c.wakeups}×</b><small>${c.trips} for the bathroom</small></div>
    </div><div class="facts">${chips.join('')}</div>`;
  } else {
    body = `<p class="empty">No sleep logged for the night before ${isToday ? 'today' : fmtDay(date)}.</p>`;
  }
  let tonight = '';
  if (isToday) {
    const tm = addDays(date, 1);
    if (pend && pend.date === tm) tonight = `<div class="tonight"><span>${icon('sleep')}In bed since ${fmtTime(pend.inBed)}. Good night.</span><button class="btn ghost small" data-act="cancelBed">Cancel</button></div>`;
    else if ((h >= 17 || h < 5) && !(pend && pend.date === date)) tonight = `<div class="tonight"><span class="muted">Heading to sleep? Tap now and again when you wake up.</span><button class="btn" data-act="toBed">${icon('sleep')}Going to bed</button></div>`;
  }
  const naps = (day.naps || []).slice().sort((a, b) => (a.t > b.t ? 1 : -1))
    .map(n => `<button class="fact" style="cursor:pointer" data-act="edit" data-kind="nap" data-id="${n.id}">Nap ${fmtTime(n.t)} · ${n.mins} min</button>`).join('');
  return `<section class="card"><div class="card-head"><h2>Sleep</h2><span class="muted">Night before ${isToday ? 'today' : fmtDay(date)}</span></div>
    ${body}
    <div class="naps">${naps}${pend && pend.date === date && !sl ? '' : `<button class="btn small" data-act="editSleep" data-date="${date}">${c ? 'Edit night' : 'Log the night'}</button>`}<button class="btn small ghost" data-act="new" data-kind="nap">Add a nap</button></div>
    ${tonight}
  </section>`;
}
function periodCard(date) {
  if (!D().settings.trackCycle) return '';
  const p = getDay(date).period, ci = cycleInfo(date), isToday = date === today();
  let status;
  if (!ci) status = '<p class="empty">No periods logged yet. Log the first day of your next period and the app starts predicting.</p>';
  else if (ci.day > 60) status = '<p class="empty">No period logged in the last two months. Log your next one to restart predictions.</p>';
  else {
    const diff = daysBetween(date, ci.next);
    const when = diff > 0 ? `Next period expected around ${fmtDay(ci.next)}, in ${diff} ${plural(diff, 'day', 'days')}.` : diff === 0 ? 'Next period expected around today.' : `Period was expected ${-diff} ${plural(-diff, 'day', 'days')} ago.`;
    status = `<div class="cycle-row"><div class="cycle-day"><span class="lbl">Cycle day</span><b>${ci.day}</b></div><p>${when}<br><span class="muted">Based on ${ci.known ? `your average ${ci.avg}-day cycle` : 'a typical 28-day cycle until you log more'}.</span></p></div>`;
  }
  const facts = p ? `<div class="facts">${p.flow ? `<span class="fact period">${FLOW[p.flow]}</span>` : '<span class="fact">No bleeding</span>'}${(p.symptoms || []).map(x => `<span class="fact">${esc(x)}</span>`).join('')}</div>` : '';
  return `<section class="card"><div class="card-head"><h2>Period</h2><span class="muted">${isToday ? 'Today' : fmtDay(date)}</span></div>${status}${facts}
    <div class="card-foot"><button class="btn small" data-act="new" data-kind="period">${icon('period')}${p ? 'Edit' : isToday ? 'Log today' : 'Log this day'}</button></div>
    <p class="hint" style="margin-top:8px">Predictions are estimates. Don't rely on them for contraception.</p></section>`;
}
function medsDueCard(date) {
  const meds = Object.values(D().meds);
  if (!meds.length) return `<section class="card"><div class="card-head"><h2>Medicines</h2></div><p class="empty">Add your medicines, vitamins and supplements to get a checklist for each day.</p><div class="card-foot"><button class="btn primary" data-act="addMed">${icon('plus')}Add a medicine</button></div></section>`;
  const day = getDay(date), isToday = date === today(), nowM = toMin(nowHM());
  const groups = {};
  for (const m of meds) for (const s of slotsFor(m, date)) (groups[s.time] = groups[s.time] || []).push(m);
  const used = new Set();
  let total = 0, taken = 0;
  const html = Object.keys(groups).sort().map(t => {
    const list = groups[t].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name));
    let pending = 0;
    const rows = list.map(m => {
      total++;
      const dose = (day.doses || []).find(x => x.medId === m.id && x.slot === t);
      if (dose) used.add(dose.id); else pending++;
      if (dose && dose.status === 'taken') taken++;
      const detail = [doseText(m, date), FOOD[m.food]].filter(Boolean).join(' · ');
      const act = dose
        ? `<button class="status ${dose.status}" data-act="editDose" data-id="${dose.id}">${dose.status === 'taken' ? icon('ok') + fmtTime(dose.t) : 'Skipped'}</button><button class="icon-btn small" data-act="rmDose" data-id="${dose.id}" aria-label="Remove this log for ${esc(m.name)}" title="Remove this log">${icon('x')}</button>`
        : `<button class="btn small primary" data-act="take" data-med="${m.id}" data-time="${t}">Take</button><button class="icon-btn small" data-act="doseMore" data-med="${m.id}" data-time="${t}" aria-label="More options for ${esc(m.name)}">${icon('dots')}</button>`;
      return `<li class="dose-row"><div class="dose-main"><span class="dose-name">${esc(m.name)}${m.kind !== 'medicine' ? `<span class="kind">${KINDS[m.kind]}</span>` : ''}</span><span class="dose-amt">${esc(detail)}</span>${m.instructions ? `<span class="dose-note">${esc(m.instructions)}</span>` : ''}</div><div class="dose-act">${act}</div></li>`;
    }).join('');
    const late = pending && ((isToday && toMin(t) < nowM - 60) || date < today());
    const label = late ? (isToday ? `${fmtTime(t)} · overdue` : `${fmtTime(t)} · not logged`) : fmtTime(t);
    return `<div class="slot"><div class="slot-head"><span class="slot-time ${late ? 'late' : ''}">${label}</span>${pending > 1 ? `<button class="btn small" data-act="takeAll" data-time="${t}">Take all ${pending}</button>` : ''}</div><ul class="dose-list">${rows}</ul></div>`;
  }).join('');
  const extras = (day.doses || []).filter(x => !used.has(x.id)).sort((a, b) => (a.t > b.t ? 1 : -1));
  const extraHtml = extras.length ? `<div class="extra-doses"><span class="lbl">Other doses</span><ul class="dose-list">${extras.map(x => {
    const m = D().meds[x.medId];
    return `<li class="dose-row"><div class="dose-main"><span class="dose-name">${esc(m ? m.name : x.name)}</span><span class="dose-amt">${esc([x.amount != null ? `${fmtNum(x.amount)} ${x.unit || ''}` : '', x.why].filter(Boolean).join(' · '))}</span></div><div class="dose-act"><button class="status ${x.status}" data-act="editDose" data-id="${x.id}">${x.status === 'taken' ? icon('ok') + fmtTime(x.t) : 'Skipped'}</button><button class="icon-btn small" data-act="rmDose" data-id="${x.id}" aria-label="Remove this log for ${esc(m ? m.name : x.name)}" title="Remove this log">${icon('x')}</button></div></li>`;
  }).join('')}</ul></div>` : '';
  return `<section class="card"><div class="card-head"><h2>Medicines</h2><span class="muted">${total ? `${taken} of ${total} taken` : 'Nothing scheduled'}</span></div>
    ${html || '<p class="empty">Nothing scheduled for this day.</p>'}${extraHtml}
    <div class="card-foot"><button class="btn small" data-act="new" data-kind="dose">${icon('plus')}Log an as-needed or extra dose</button></div></section>`;
}
function timeline(date) {
  const day = getDay(date), items = [];
  const push = (t, kind, title, sub, attrs) => items.push({ m: toMin(t) ?? 0, t, kind, title, sub, attrs });
  const sl = day.sleep, c = sleepCalc(date, sl);
  if (sl && c) push(sl.wake, 'sleep', 'Woke up', `${fmtDur(c.total)} asleep · in bed ${fmtTime(sl.inBed)}${sl.quality ? ` · quality ${sl.quality}/5` : ''}`, `data-act="editSleep" data-date="${date}"`);
  const next = (D().days[addDays(date, 1)] || {}).sleep;
  if (next && toMin(next.inBed) >= 900) push(next.inBed, 'sleep', 'Went to bed', '', `data-act="editSleep" data-date="${addDays(date, 1)}"`);
  const pend = D().settings.sleepPending;
  if (pend && ((pend.date === addDays(date, 1) && toMin(pend.inBed) >= 900) || (pend.date === date && toMin(pend.inBed) < 900))) push(pend.inBed, 'sleep', 'Went to bed', 'Tap “I\'m awake” when you get up', `data-act="noop"`);
  for (const b of day.bm || []) {
    const bits = [];
    if (b.blood) bits.push(`<span class="bl">Blood: ${BLOOD[b.blood].toLowerCase()}</span>`);
    if (b.urgency) bits.push(esc(URGENCY[b.urgency].toLowerCase()));
    if (b.pain) bits.push(`pain ${b.pain}/10`);
    if (b.night) bits.push('at night');
    if (b.note) bits.push(esc(b.note));
    push(b.t, 'bm', `Bathroom${b.bristol ? ` · type ${b.bristol}` : ''}`, bits.join(' · '), `data-act="edit" data-kind="bm" data-id="${b.id}"`);
  }
  for (const x of day.meals || []) {
    const mac = MACROS.filter(([k]) => typeof x[k] === 'number').map(([k, label]) => `${label.toLowerCase()} ${x[k]}`).join(', ');
    push(x.t, 'meal', `${esc(x.type || 'Meal')} · ${esc(x.desc)}`, esc([mac, (x.tags || []).map(tagLabel).join(', '), x.portion && x.portion !== 'Normal' ? x.portion.toLowerCase() + ' portion' : '', x.note].filter(Boolean).join(' · ')), `data-act="edit" data-kind="meal" data-id="${x.id}"`);
  }
  for (const x of day.exercise || []) push(x.t, 'ex', `${esc(x.type)} · ${x.mins || 0} min`, esc([x.intensity, x.steps ? `${fmtNum(x.steps)} steps` : '', x.symptoms && x.symptoms !== 'None' ? x.symptoms.toLowerCase() : ''].filter(Boolean).join(' · ')), `data-act="edit" data-kind="ex" data-id="${x.id}"`);
  for (const x of day.naps || []) push(x.t, 'nap', `Nap · ${x.mins} min`, esc(x.note || ''), `data-act="edit" data-kind="nap" data-id="${x.id}"`);
  if (day.checkin) {
    const ci = day.checkin;
    push(ci.t || '21:00', 'checkin', 'Check-in', esc([WELLBEING[ci.wellbeing ?? 0], `pain ${ci.pain ?? 0}/10`, `fatigue ${ci.fatigue ?? 0}/10`].join(' · ')), `data-act="edit" data-kind="checkin" data-id="ci"`);
  }
  const pd = day.period;
  if (pd && (pd.flow || (pd.symptoms || []).length)) items.push({ m: -1, t: '', kind: 'period', title: pd.flow ? `Period · ${FLOW[pd.flow].toLowerCase()}` : 'Period symptoms', sub: esc((pd.symptoms || []).join(', ')), attrs: 'data-act="edit" data-kind="period" data-id="p"' });
  const groups = {};
  for (const x of day.doses || []) { const k = x.t + '|' + x.status; (groups[k] = groups[k] || []).push(x); }
  for (const [k, list] of Object.entries(groups)) {
    const [t, status] = k.split('|');
    const names = list.map(x => { const m = D().meds[x.medId]; return (m ? m.name : x.name) + (x.amount != null && x.unit !== 'other' ? ` ${fmtNum(x.amount)} ${x.unit || ''}` : ''); });
    const title = status === 'taken' ? (list.length > 1 ? `Took ${list.length} medicines` : 'Took medicine') : `Skipped ${list.length > 1 ? list.length + ' medicines' : 'a dose'}`;
    push(t, 'dose', title, esc(names.join(' · ')), `data-act="doseGroup" data-ids="${list.map(x => x.id).join(',')}"`);
  }
  if (!items.length) return '<p class="empty">Nothing logged for this day yet. Use the buttons to add entries as you go.</p>';
  items.sort((a, b) => a.m - b.m);
  return `<ul class="tl">${items.map(i => `<li><button class="tl-item k-${i.kind}" ${i.attrs}><time>${i.t ? fmtTime(i.t) : 'All day'}</time><span class="tl-dot"></span><span class="tl-main"><strong>${i.title}</strong>${i.sub ? `<span class="tl-sub">${i.sub}</span>` : ''}</span></button></li>`).join('')}</ul>`;
}

/* ---------- history ---------- */
function viewHistory() {
  const ym = S.histMonth;
  const [y, mo] = ym.split('-').map(Number);
  const first = new Date(y, mo - 1, 1), offset = (first.getDay() + 6) % 7, count = new Date(y, mo, 0).getDate();
  const t = today(), atCurrent = ym >= t.slice(0, 7);
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span class="cal-cell pad" aria-hidden="true"></span>');
  for (let d = 1; d <= count; d++) {
    const date = `${ym}-${pad(d)}`, day = D().days[date], sc = dayScore(day), future = date > t;
    const bm = (day && day.bm) || [], blood = bm.some(b => b.blood);
    const c = day ? sleepCalc(date, day.sleep) : null;
    const b = sc ? band(sc.score) : null;
    const flow = (day && day.period && day.period.flow) || 0;
    const tip = [fmtDay(date), sc ? `${scoreDef().short} ${sc.score} (${b.label})${sc.partial ? ', no check-in' : ''}` : 'No symptoms logged', bm.length ? `${bm.length} ${plural(bm.length, 'trip', 'trips')}${blood ? ', blood seen' : ''}` : '', c ? `Slept ${fmtDur(c.total)}` : '', flow ? `Period: ${FLOW[flow].toLowerCase()}` : ''].filter(Boolean).join('\n');
    cells.push(`<button class="cal-cell ${b ? 'lv' + b.i : ''} ${date === t ? 'is-today' : ''} ${future ? 'future' : ''}" ${future ? 'disabled' : `data-act="openDay" data-date="${date}"`} data-tip="${esc(tip)}" aria-label="${esc(tip.replace(/\n/g, ', '))}"><span class="cal-d">${d}</span>${sc ? `<span class="cal-s">${sc.score}</span>` : ''}${blood ? '<i class="cal-blood"></i>' : ''}${flow ? '<i class="cal-period"></i>' : ''}</button>`);
  }
  return `<div class="pagehead"><h1>History</h1>${syncHtml()}</div>
  <div class="hist">
    <section class="card cal-wrap">
      <div class="cal-head"><button class="icon-btn" data-act="month" data-d="-1" aria-label="Previous month">${icon('left')}</button><h2>${MONTH_FMT.format(first)}</h2><button class="icon-btn" data-act="month" data-d="1" aria-label="Next month" ${atCurrent ? 'disabled' : ''}>${icon('right')}</button></div>
      <div class="cal">${WEEKDAYS.map(w => `<span class="cal-wd">${w}</span>`).join('')}${cells.join('')}</div>
      <div class="legend"><span><i></i>No symptoms logged</span>${scoreDef().legend.map((l, i) => `<span><i class="l${i}"></i>${l}</span>`).join('')}<span><i class="dot"></i>Blood seen</span>${D().settings.trackCycle ? '<span><i class="period"></i>Period</span>' : ''}</div>
      <p class="hint">Each day shows its estimated ${scoreDef().short} score. Tap a day to see or edit it.</p>
    </section>
    <div class="col">
      <section class="card"><div class="card-head"><h2>${MONTH_FMT.format(first)} at a glance</h2></div>${monthStats(ym)}</section>
      <section class="card">${aboutScore()}</section>
    </div>
  </div>`;
}
function monthStats(ym) {
  const t = today(), [y, mo] = ym.split('-').map(Number), count = new Date(y, mo, 0).getDate();
  let logged = 0, bmDays = 0, trips = 0, bloodDays = 0, nightTotal = 0, sleepN = 0, sleepSum = 0, scored = 0, scoreSum = 0, worst = null, due = 0, taken = 0;
  const firstLog = firstLogDate() || t, meds = Object.values(D().meds);
  for (let d = 1; d <= count; d++) {
    const date = `${ym}-${pad(d)}`;
    if (date > t) break;
    const day = D().days[date];
    if (day) {
      const bm = day.bm || [];
      if (bm.length || day.checkin || day.sleep || (day.meals || []).length || (day.doses || []).length) logged++;
      if (bm.length) { bmDays++; trips += bm.length; nightTotal += bm.filter(b => b.night).length; if (bm.some(b => b.blood)) bloodDays++; }
      const c = sleepCalc(date, day.sleep);
      if (c && c.total > 0) { sleepN++; sleepSum += c.total; }
      const sc = dayScore(day);
      if (sc) { scored++; scoreSum += sc.score; if (!worst || sc.score > worst.score) worst = { date, score: sc.score }; }
    }
    if (date >= firstLog) for (const m of meds) { const n = slotsFor(m, date).length; if (n) { due += n; taken += Math.min(n, takenCount(day, m.id)); } }
  }
  if (!logged) return '<p class="empty">Nothing logged this month.</p>';
  const stat = (label, value, sub) => `<div class="stat"><span class="lbl">${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
  return `<div class="stats">
    ${stat('Days logged', logged)}
    ${stat('Bathroom trips', bmDays ? fmtNum(Math.round((trips / bmDays) * 10) / 10) : '–', 'average per day')}
    ${stat('Days with blood', bloodDays, bmDays ? `of ${bmDays} days` : '')}
    ${stat('Night trips', bmDays ? fmtNum(Math.round((nightTotal / bmDays) * 10) / 10) : '–', 'average per night')}
    ${stat('Sleep', sleepN ? fmtDur(sleepSum / sleepN) : '–', 'average per night')}
    ${stat(scoreDef().short + ' score', scored ? fmtNum(Math.round((scoreSum / scored) * 10) / 10) : '–', worst ? `highest ${worst.score} on ${fmtDay(worst.date)}` : '')}
    ${stat('Doses taken', due ? `${Math.round((taken / due) * 100)}%` : '–', due ? `${taken} of ${due} scheduled` : '')}
  </div>`;
}
function aboutScore() {
  const hbi = scoreKind() === 'hbi';
  const rows = hbi ? [
    ['How you feel (check-in)', 'Very well 0 to terrible 4'],
    ['Belly pain (check-in)', 'None 0 · mild (1–3) 1 · moderate (4–6) 2 · severe (7–10) 3'],
    ['Liquid or very soft stools', '1 point each (Bristol type 6 or 7)'],
    ['Joints, eyes, skin lumps, skin sores, mouth ulcers, anal fissure, new fistula, abscess', '1 each'],
    ['Lump in the belly', 'Left out: this needs a doctor to examine you'],
  ] : [
    ['Trips during the day', '1–3: 0 · 4–6: 1 · 7–9: 2 · 10+: 3'],
    ['Trips that woke you at night', '1–3: 1 · 4+: 2'],
    ['Worst urgency', 'Had to hurry: 1 · Right away: 2 · Accident: 3'],
    ['Blood', 'Streaks only: 1 · Visible sometimes: 2 · Visible in most trips: 3'],
    ['How you feel (check-in)', 'Very well 0 to terrible 4'],
    ['Joints, eyes, skin lumps, skin sores', '1 each'],
  ];
  const intro = hbi
    ? `For Crohn's disease the score estimates the <strong>Harvey-Bradshaw Index (HBI)</strong>, a symptom score many GI teams use. Under 5 usually means quiet disease, 5–7 mild, 8–16 moderate and 17 or more severe.`
    : `For ulcerative colitis the score estimates the <strong>Simple Clinical Colitis Activity Index (SCCAI)</strong>, a 0–19 scale many GI teams use. 2 or less usually means quiet disease.`;
  return `<details class="about" data-key="about" ${S.open.about ? 'open' : ''}><summary>How the activity score works</summary>
  <p style="margin-top:10px">${intro} It's worked out from your bathroom log and evening check-in. Use it to spot trends and to share with your doctor. It isn't a diagnosis. You can change your condition in More.</p>
  <div class="tbl-wrap"><table><thead><tr><th>Item</th><th>Points</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('')}
  </tbody></table></div></details>`;
}

/* ---------- meds ---------- */
function viewMeds() {
  const all = Object.values(D().meds);
  const active = all.filter(m => !isStopped(m)), stopped = all.filter(isStopped);
  const sections = ['medicine', 'vitamin', 'supplement'].map(k => {
    const list = active.filter(m => m.kind === k).sort((a, b) => a.name.localeCompare(b.name));
    if (!list.length) return '';
    return `<h2 class="group-title">${{ medicine: 'Medicines', vitamin: 'Vitamins', supplement: 'Supplements' }[k]}</h2><div class="med-grid">${list.map(medCard).join('')}</div>`;
  }).join('');
  const stoppedHtml = stopped.length ? `<details data-key="stopped" ${S.open.stopped ? 'open' : ''} style="margin-top:22px"><summary class="section-title" style="cursor:pointer">Stopped (${stopped.length})</summary><ul class="stopped-list">${stopped.map(m =>
    `<li><span><strong>${esc(m.name)}</strong> <span class="muted">stopped ${fmtDay(m.endDate)}</span></span><span class="btns"><button class="btn small ghost" data-act="restartMed" data-id="${m.id}">Restart</button><button class="btn small" data-act="editMed" data-id="${m.id}">Edit</button></span></li>`).join('')}</ul></details>` : '';
  return `<div class="pagehead"><h1>Medicines &amp; supplements</h1>${syncHtml()}</div>
  <div class="btns"><button class="btn primary" data-act="addMed">${icon('plus')}Add</button>${active.length ? `<button class="btn" data-act="new" data-kind="dose">Log a dose</button>` : ''}</div>
  ${sections || `<section class="card" style="margin-top:16px"><p class="empty">Nothing added yet. Add each medicine, vitamin and supplement once with its dose and schedule. You'll get a daily checklist on the Today tab.</p></section>`}
  ${stoppedHtml}`;
}
function medCard(m) {
  const t = today(), lines = [];
  const dose = doseText(m, t);
  lines.push(`<p class="med-line">${esc([dose, scheduleText(m)].filter(Boolean).join(' · '))}</p>`);
  const sub = [FOOD[m.food] ? 'Take ' + FOOD[m.food] : '', m.instructions].filter(Boolean);
  if (sub.length) lines.push(`<p class="med-line sub">${esc(sub.join(' · '))}</p>`);
  const tp = taperText(m);
  if (tp) lines.push(`<p class="med-line">${esc(tp)}</p>`);
  if (m.schedule && m.schedule.type === 'interval') {
    const nd = nextDue(m, t);
    if (nd) { const n = daysBetween(t, nd); lines.push(`<p class="med-line"><strong>Next ${formWord(m.form, 1)}:</strong> ${fmtDay(nd)} (${n === 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`})</p>`); }
  }
  const st = stockLeft(m);
  if (st) {
    const low = st.days != null && st.days <= (m.refillDays ?? 7);
    const txt = `${fmtNum(st.left)} ${formWord(m.form, st.left)} left${st.days != null ? ` · about ${st.days} ${plural(st.days, 'day', 'days')}` : ''}`;
    lines.push(low ? `<p><span class="pill-warn">Refill soon · ${esc(txt)}</span></p>` : `<p class="med-line sub">${esc(txt)}</p>`);
  }
  if (m.schedule && m.schedule.type !== 'prn') {
    const first = firstLogDate() || t;
    const from = [addDays(t, -30), m.startDate || first, first].sort().pop();
    const a = from <= addDays(t, -1) ? adherence(m, from, addDays(t, -1)) : null;
    const strip = stripStates(m).map(s => `<i class="${s.cls}" title="${esc(fmtDay(s.d) + ': ' + s.label)}"></i>`).join('');
    lines.push(`<div class="adh"><span class="strip" aria-hidden="true">${strip}</span><span>${a ? `<b>${a.pct}%</b> taken, last ${daysBetween(from, t)} days` : 'Last 14 days'}</span></div>`);
  }
  const ch = (m.changes || []).slice(-1)[0];
  if (ch) lines.push(`<p class="med-line sub">Changed ${fmtDay(ch.date)}: ${esc(ch.text)}</p>`);
  const tag = m.kind === 'medicine' ? m.category || 'Medicine' : KINDS[m.kind];
  return `<article class="med-card"><header><h3>${esc(m.name)}</h3><span class="tag">${esc(tag)}</span></header>${lines.join('')}
    <footer><button class="btn small" data-act="editMed" data-id="${m.id}">Edit</button><button class="btn small" data-act="logMed" data-id="${m.id}">Log a dose</button>${m.stock ? `<button class="btn small ghost" data-act="refill" data-id="${m.id}">Refilled</button>` : ''}</footer></article>`;
}

/* ---------- welcome (first run) ---------- */
function viewWelcome() {
  const c = R.settings.condition;
  return `<div class="welcome">
    <img class="mark" src="icons/icon.svg" alt="">
    <h1>Track Your IBD<span>One day at a time</span></h1>
    <p class="lead">Log bathroom trips, symptoms, food, sleep, exercise and medicines in one place, and see how your IBD is trending.</p>
    <div class="promise">
      <div>${icon('lock')}<span><strong>Private by design.</strong> No account and no sign-up. Everything you enter stays on this device. We never see it.</span></div>
      <div>${icon('save')}<span><strong>You keep the copies.</strong> Save backups to Google Drive, iCloud or Files whenever you like.</span></div>
    </div>
    <form id="welcome-form" class="field">
      ${group('Which condition do you have?', seg('condition', CONDITIONS.map(x => x[1]), c || '', { values: CONDITIONS.map(x => x[0]) }) + '<span class="hint">This picks the right symptom score. You can change it later.</span>')}
      <label class="toggle"><input type="checkbox" name="trackCycle" id="w-cycle"><span>Track my periods too <span class="hint">optional</span></span></label>
    </form>
    <div class="btns"><button class="btn primary" data-act="startApp">Start tracking</button><button class="btn" data-act="enterSample">Look around with sample data</button></div>
    <p class="hint">By using Track Your IBD you agree it's a personal log, not medical advice. <a href="privacy.html">Privacy</a></p>
  </div>`;
}

/* ---------- more ---------- */
function installHelp() {
  const ua = navigator.userAgent || '';
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const safariMac = /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|Firefox/.test(ua) && !ios;
  if (isInstalled()) return '<p>Track Your IBD is installed on this device.</p>';
  if (deferredInstall) return `<p>Install the app so it opens from your home screen and your browser keeps your data.</p><div class="card-foot"><button class="btn primary" data-act="install">Install Track Your IBD</button></div>`;
  if (ios) return `<p>On iPhone or iPad, open this page in Safari, then:</p><ol class="steps"><li>Tap the Share button.</li><li>Choose <strong>Add to Home Screen</strong>.</li></ol>`;
  if (safariMac) return `<p>In Safari on your Mac, choose <strong>File › Add to Dock</strong>.</p>`;
  return `<p>In Chrome, open the ⋮ menu and choose <strong>Add to Home screen</strong> (Android) or <strong>Install Track Your IBD</strong> (computer).</p>`;
}
function viewMore() {
  const st = D().settings, favs = st.favorites || [];
  const n = SAMPLE ? null : daysSinceBackup();
  const when = SAMPLE ? '' : st.lastBackup ? `Last backup: ${fmtDay(ymd(new Date(st.lastBackup)))}${n ? ` (${n} ${plural(n, 'day', 'days')} ago)` : ' (today)'}.` : 'No backup saved yet.';
  const persisted = Store.persisted === true ? 'Your browser has agreed to keep this data.' : 'Install the app so your browser keeps this data.';
  return `<div class="pagehead"><h1>More</h1>${syncHtml()}</div>
  <div class="more">
    <section class="card"><div class="card-head"><h2>Your data</h2></div>
      ${SAMPLE ? `<p>You're viewing sample data. Nothing you change is saved.</p><div class="card-foot"><button class="btn primary" data-act="exitSample">${R.settings.started ? 'Back to my log' : 'Start my own log'}</button></div>`
        : `<p><strong>Everything stays on this device.</strong> There's no account and nothing is sent anywhere. Your phone and your computer each keep their own log. To move entries between them, save a backup on one and restore it on the other.</p><p class="muted">${persisted}</p>`}
    </section>
    <section class="card"><div class="card-head"><h2>Backup</h2></div>
      <p>Save a copy of everything. On a phone you can send it straight to Google Drive, iCloud Drive or Files. On a computer it goes to your Downloads folder.</p>
      ${when ? `<p class="backup-when">${when}</p>` : ''}
      <div class="card-foot">
        <button class="btn primary" data-act="exportJson">${icon('save')}Save backup</button>
        ${SAMPLE ? '' : `<label class="btn file-btn">Restore from backup<input type="file" id="f-import" accept="application/json,.json"></label>`}
        <button class="btn" data-act="exportCsv">Spreadsheet for your doctor (.csv)</button>
      </div>
      ${SAMPLE ? '' : `<label class="field" style="margin-top:14px;max-width:320px"><span class="lbl">Remind me to back up every</span><select id="s-backupEvery" name="backupEvery" form="settings-form">${[3, 7, 14, 30].map(d => `<option value="${d}" ${st.backupEvery === d ? 'selected' : ''}>${d} days</option>`).join('')}</select></label>`}
    </section>
    <section class="card"><div class="card-head"><h2>Install the app</h2></div>${installHelp()}</section>
    <section class="card"><div class="card-head"><h2>Settings</h2></div>
      <form id="settings-form" class="field">
        ${group('Condition', seg('condition', CONDITIONS.map(x => x[1]), st.condition || '', { values: CONDITIONS.map(x => x[0]) }) + `<span class="hint">Crohn's uses the Harvey-Bradshaw Index. The others use the colitis score (SCCAI).</span>`)}
        <label class="toggle"><input type="checkbox" name="trackCycle" id="s-cycle" ${st.trackCycle ? 'checked' : ''}><span>Track my periods</span></label>
        <div class="row3">
          <label class="field"><span class="lbl">Water goal (glasses)</span><input type="number" id="s-goal" name="waterGoal" min="1" max="30" value="${st.waterGoal}"></label>
          <label class="field"><span class="lbl">Glass size (mL)</span><input type="number" id="s-glass" name="glassMl" min="50" max="1000" step="10" value="${st.glassMl}"></label>
          <label class="field"><span class="lbl">Weight unit</span><select id="s-weight" name="weightUnit"><option value="kg" ${st.weightUnit === 'kg' ? 'selected' : ''}>kg</option><option value="lb" ${st.weightUnit === 'lb' ? 'selected' : ''}>lb</option></select></label>
        </div>
      </form></section>
    <section class="card"><div class="card-head"><h2>Favourite meals</h2></div>
      ${favs.length ? `<ul class="fav-list">${favs.map((f, i) => `<li><span>${esc(f.desc)} <span class="muted">${esc((f.tags || []).map(tagLabel).join(', '))}</span></span><button class="icon-btn small" data-act="rmFav" data-i="${i}" aria-label="Remove ${esc(f.desc)}">${icon('x')}</button></li>`).join('')}</ul>` : '<p class="empty">Meals you log 3 times within a couple of weeks are added here automatically. You can also tick “Save to favourites” when logging a meal.</p>'}
    </section>
    <section class="card">${aboutScore()}</section>
    ${SAMPLE ? '' : `<section class="card"><div class="card-head"><h2>Sample data</h2></div><p>See what three months of logging looks like without touching your own entries.</p><div class="card-foot"><button class="btn" data-act="enterSample">Look around with sample data</button></div></section>
    <section class="card danger-zone"><div class="card-head"><h2>Delete all data</h2></div><p>Erase every entry, medicine and setting on this device. Save a backup first if you might want them back. This can't be undone.</p><div class="card-foot"><button class="btn danger" data-act="deleteAll">Delete everything on this device</button></div></section>`}
    <p class="hint">Track Your IBD is a personal log. It doesn't give medical advice. Talk to your doctor before changing your treatment, and get urgent help for heavy bleeding, severe pain, high fever or signs of dehydration. <a href="privacy.html">Privacy</a></p>
  </div>`;
}

/* ---------- trends ---------- */
function trendRows(n, end = today()) {
  const rows = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = addDays(end, -i), day = D().days[date];
    const sc = day ? dayScore(day) : null, bm = (day && day.bm) || [];
    const c = day ? sleepCalc(date, day.sleep) : null, mac = day ? mealMacros(day) : {};
    rows.push({
      date, score: sc ? sc.score : null, trips: bm.length, blood: bm.filter(b => b.blood).length,
      sleep: c && c.total > 0 ? c.total / 60 : null, carbs: mac.carbs ?? null, protein: mac.protein ?? null, fat: mac.fat ?? null, fiber: mac.fiber ?? null,
      tags: new Set(((day && day.meals) || []).flatMap(x => x.tags || [])), flow: (day && day.period && day.period.flow) || 0,
    });
  }
  return rows;
}
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const round1 = v => (v == null ? null : Math.round(v * 10) / 10);
function viewTrends() {
  const n = S.trendDays, rows = trendRows(n), prev = trendRows(n, addDays(today(), -n));
  S.trendData = rows;
  const def = scoreDef();
  const scores = rows.filter(r => r.score != null).map(r => r.score), prevScores = prev.filter(r => r.score != null).map(r => r.score);
  const avg = round1(mean(scores)), prevAvg = round1(mean(prevScores));
  const bmDays = rows.filter(r => r.trips > 0), bloodDays = bmDays.filter(r => r.blood > 0).length;
  const sleeps = rows.filter(r => r.sleep != null).map(r => r.sleep);
  const first = firstLogDate() || today();
  let due = 0, taken = 0;
  for (const r of rows) {
    if (r.date < first || r.date >= today()) continue;
    for (const m of Object.values(D().meds)) { const k = slotsFor(m, r.date).length; if (k) { due += k; taken += Math.min(k, takenCount(D().days[r.date], m.id)); } }
  }
  const b = avg != null ? band(avg) : null;
  let cmp = '';
  if (avg != null && prevAvg != null) {
    const d = round1(avg - prevAvg);
    cmp = d === 0 ? 'Same as the previous period' : `${d > 0 ? 'Up' : 'Down'} ${fmtNum(Math.abs(d))} from ${fmtNum(prevAvg)} the ${n} days before`;
  }
  const tile = (label, value, sub) => `<div class="tile"><span class="lbl">${label}</span><b>${value}</b><small>${sub || '&nbsp;'}</small></div>`;
  const ranges = [[14, '2 weeks'], [30, '1 month'], [90, '3 months']];
  const hasAny = rows.some(r => r.score != null || r.trips || r.sleep != null || MACROS.some(([k]) => r[k] != null));
  return `<div class="pagehead"><h1>Trends</h1><div class="segbtns" role="group" aria-label="Time range">${ranges.map(([d, l]) => `<button type="button" data-act="trendRange" data-n="${d}" aria-pressed="${d === n}">${l}</button>`).join('')}</div></div>
  <div class="trends">
    <div class="tiles">
      ${tile(`Average ${def.short}`, avg != null ? `${fmtNum(avg)} <span class="band b${b.i}">${b.label}</span>` : '–', avg != null ? cmp || `${scores.length} ${plural(scores.length, 'day', 'days')} scored` : 'Log symptoms to see this')}
      ${tile('Days with blood', bmDays.length ? bloodDays : '–', bmDays.length ? `of ${bmDays.length} days with bathroom logs` : '')}
      ${tile('Average sleep', sleeps.length ? fmtDur(mean(sleeps) * 60) : '–', sleeps.length ? `over ${sleeps.length} ${plural(sleeps.length, 'night', 'nights')}` : '')}
      ${tile('Doses taken', due ? `${Math.round((taken / due) * 100)}%` : '–', due ? `${taken} of ${due} scheduled` : '')}
    </div>
    ${hasAny ? '' : '<section class="card"><p class="empty">Nothing logged in this period yet. Charts fill in as you log bathroom trips, check-ins, sleep and meals.</p></section>'}
    <section class="card"><div class="card-head"><h2>${def.short} activity score</h2><span class="muted">${esc(def.long)}, estimated</span></div><div class="chart" data-chart="score" aria-label="Chart of daily activity score"></div>
      <div class="chart-legend">${def.legend.map((l, i) => `<span><i class="b${i}"></i>${l}</span>`).join('')}${D().settings.trackCycle ? '<span><i class="period-swatch"></i>Period days</span>' : ''}</div>${periodCompare(rows)}</section>
    <div class="pair">
      <section class="card"><div class="card-head"><h2>Bathroom trips</h2><span class="muted">per day</span></div><div class="chart" data-chart="trips" aria-label="Chart of bathroom trips per day"></div>
        <div class="chart-legend"><span><i style="background:var(--bar-neutral)"></i>Trips</span><span><i style="background:var(--blood)"></i>With blood</span></div></section>
      <section class="card"><div class="card-head"><h2>Sleep</h2><span class="muted">hours asleep</span></div><div class="chart" data-chart="sleep" aria-label="Chart of hours slept per night"></div>
        <div class="chart-legend"><span><i style="background:var(--c-sleep)"></i>Hours asleep</span><span><i class="line" style="background:var(--muted)"></i>7-hour line</span></div></section>
    </div>
    <section class="card"><div class="card-head"><h2>Carbs, protein, fat and fibre</h2><span class="muted">average meal rating, 1–10</span></div><div class="chart" data-chart="food" aria-label="Chart of daily carbs, protein, fat and fibre ratings"></div>
      <div class="chart-legend">${MACROS.map(([, l], i) => `<span><i class="line" style="background:var(--s${i + 1})"></i>${l}</span>`).join('')}</div></section>
    <section class="card"><div class="card-head"><h2>Food and next-day symptoms</h2></div>${triggerTable(rows)}</section>
    <section class="card"><details data-key="dailyTable" ${S.open.dailyTable ? 'open' : ''}><summary class="section-title" style="cursor:pointer">Daily numbers</summary>${dailyTable(rows)}</details></section>
  </div>`;
}
function periodCompare(rows) {
  if (!D().settings.trackCycle) return '';
  const on = rows.filter(r => r.flow && r.score != null).map(r => r.score), off = rows.filter(r => !r.flow && r.score != null).map(r => r.score);
  if (on.length < 3 || off.length < 3) return '';
  return `<p class="hint" style="margin-top:8px">Average ${scoreDef().short} on period days: <strong>${fmtNum(round1(mean(on)))}</strong> · other days: <strong>${fmtNum(round1(mean(off)))}</strong></p>`;
}
function triggerTable(rows) {
  const next = {};
  rows.forEach((r, i) => { if (i + 1 < rows.length && rows[i + 1].score != null) next[r.date] = rows[i + 1].score; });
  const days = rows.filter(r => next[r.date] != null && (r.tags.size || MACROS.some(([k]) => r[k] != null)));
  if (days.length < 10) return '<p class="empty">Keep logging meals and symptoms for a couple of weeks. This table then compares your next-day score after different foods.</p>';
  const tests = FOOD_TAGS.map(t => [tagLabel(t), r => r.tags.has(t)]).concat(MACROS.map(([k, l]) => [`${l} rated 6 or more`, r => r[k] != null && r[k] >= 6]));
  const out = [];
  for (const [label, has] of tests) {
    const yes = days.filter(has).map(r => next[r.date]), no = days.filter(r => !has(r)).map(r => next[r.date]);
    if (yes.length < 3 || no.length < 3) continue;
    const a = mean(yes), c = mean(no);
    out.push({ label, n: yes.length, a, c, d: a - c });
  }
  if (!out.length) return '<p class="empty">Not enough tagged meals yet. Add tags and food ratings when you log meals.</p>';
  out.sort((x, y) => y.d - x.d);
  const def = scoreDef();
  return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Food</th><th>Days</th><th>Next-day ${def.short}</th><th>Other days</th><th>Difference</th></tr></thead><tbody>
    ${out.map(o => `<tr><td>${esc(o.label)}</td><td>${o.n}</td><td>${fmtNum(round1(o.a))}</td><td>${fmtNum(round1(o.c))}</td><td class="${o.d >= 0.5 ? 'delta-up' : o.d <= -0.5 ? 'delta-down' : ''}">${o.d > 0 ? '+' : o.d < 0 ? '−' : ''}${fmtNum(Math.abs(round1(o.d)))}</td></tr>`).join('')}
  </tbody></table></div><p class="hint" style="margin-top:8px">Patterns in your own log, not proof that a food causes symptoms. Talk to your doctor or dietitian before cutting foods out.</p>`;
}
function dailyTable(rows) {
  const r = rows.slice().reverse().filter(x => x.score != null || x.trips || x.sleep != null || MACROS.some(([k]) => x[k] != null));
  if (!r.length) return '<p class="empty" style="margin-top:8px">Nothing logged in this period.</p>';
  const v = x => (x == null ? '–' : fmtNum(round1(x)));
  return `<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Day</th><th>${scoreDef().short}</th><th>Trips</th><th>With blood</th><th>Sleep</th><th>Carbs</th><th>Protein</th><th>Fat</th><th>Fibre</th>${D().settings.trackCycle ? '<th>Period</th>' : ''}</tr></thead><tbody>
    ${r.map(x => `<tr><td>${fmtDay(x.date)}</td><td>${v(x.score)}</td><td>${x.trips}</td><td>${x.blood}</td><td>${x.sleep != null ? fmtDur(x.sleep * 60) : '–'}</td><td>${v(x.carbs)}</td><td>${v(x.protein)}</td><td>${v(x.fat)}</td><td>${v(x.fiber)}</td>${D().settings.trackCycle ? `<td>${x.flow ? FLOW[x.flow] : '–'}</td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}

/* ---------- charts (plain SVG, drawn at the container's real width) ---------- */
const SHORT_DAY = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });
function niceStep(max, count) {
  const raw = max / count, p = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= raw) return k * p;
  return 10 * p;
}
function frame(el, rows, yMax, opts = {}) {
  const W = Math.max(260, el.clientWidth), H = opts.h || (W < 520 ? 170 : 210);
  const m = { l: 30, r: opts.r || 10, t: 10, b: 24 };
  const iw = W - m.l - m.r, ih = H - m.t - m.b, step = iw / rows.length;
  const x = i => m.l + step * (i + 0.5), y = v => m.t + ih - (Math.min(v, yMax) / yMax) * ih;
  const ts = opts.step || niceStep(yMax, 4);
  let g = '';
  for (let v = 0; v <= yMax + 1e-9; v += ts) g += `<line class="${v === 0 ? 'baseline' : 'gridline'}" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text x="${m.l - 6}" y="${y(v) + 3.5}" text-anchor="end">${fmtNum(v)}</text>`;
  const every = Math.max(1, Math.ceil(rows.length / Math.max(2, Math.floor(iw / 64))));
  rows.forEach((r, i) => { if ((rows.length - 1 - i) % every === 0) g += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${SHORT_DAY.format(parseYmd(r.date))}</text>`; });
  const hits = tips => rows.map((r, i) => `<rect class="hit" x="${m.l + step * i}" y="${m.t}" width="${step}" height="${ih}" data-tip="${esc(tips(r))}"/>`).join('');
  return { W, H, m, iw, ih, step, x, y, grid: g, hits };
}
function linePath(rows, key, f, maxGap = 3) {
  let d = '', last = -99;
  rows.forEach((r, i) => {
    if (r[key] == null) return;
    d += `${i - last > maxGap ? 'M' : 'L'}${f.x(i).toFixed(1)},${f.y(r[key]).toFixed(1)}`;
    last = i;
  });
  return d;
}
function topRounded(x, y, w, h, r) {
  r = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
function svgWrap(f, body) { return `<svg width="${f.W}" height="${f.H}" viewBox="0 0 ${f.W} ${f.H}" role="img">${body}</svg>`; }
function emptyChart(el, msg) { el.innerHTML = `<div class="chart-empty">${msg}</div>`; }

function chartScore(el, rows) {
  const def = scoreDef(), vals = rows.filter(r => r.score != null).map(r => r.score);
  if (!vals.length) return emptyChart(el, 'Log bathroom trips and evening check-ins to see your score over time.');
  const yMax = Math.min(def.max + 1, Math.max(8, Math.ceil((Math.max(...vals) + 2) / 2) * 2));
  const f = frame(el, rows, yMax, { r: 64, step: niceStep(yMax, 4) });
  const labels = ['Low', 'Mild', 'Moderate', 'High'];
  let bands = '';
  [-0.5, ...def.cuts.map(c => c + 0.5), yMax].forEach((lo, i, arr) => {
    if (i === arr.length - 1 || lo >= yMax) return;
    const top = Math.min(arr[i + 1], yMax), y0 = f.y(top), y1 = f.y(Math.max(0, lo));
    bands += `<rect x="${f.m.l}" y="${y0}" width="${f.iw}" height="${y1 - y0}" style="fill:var(--lvl-${i});fill-opacity:.16"/>`;
    if (y1 - y0 >= 13) bands += `<text x="${f.W - f.m.r + 6}" y="${(y0 + y1) / 2 + 4}">${labels[i]}</text>`;
  });
  const dots = f.step >= 9 ? rows.map((r, i) => (r.score == null ? '' : `<circle cx="${f.x(i)}" cy="${f.y(r.score)}" r="4" style="fill:var(--ink);stroke:var(--surface);stroke-width:2"/>`)).join('') : '';
  const li = rows.reduce((a, r, i) => (r.score != null ? i : a), -1);
  const end = li >= 0 ? `<circle cx="${f.x(li)}" cy="${f.y(rows[li].score)}" r="5.5" style="fill:var(--ink);stroke:var(--surface);stroke-width:2.5"/>` : '';
  const tip = r => `${fmtDay(r.date)}\n${r.score != null ? `${def.short} ${r.score} (${band(r.score).label})` : 'No score'}`;
  const per = D().settings.trackCycle ? rows.map((r, i) => (r.flow ? `<rect x="${f.m.l + f.step * i}" y="${f.m.t}" width="${f.step}" height="${f.ih}" style="fill:var(--c-period);fill-opacity:.18"/>` : '')).join('') : '';
  el.innerHTML = svgWrap(f, `${bands}${per}${f.grid}<path d="${linePath(rows, 'score', f)}" style="fill:none;stroke:var(--ink);stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>${dots}${end}${f.hits(tip)}`);
}
function chartTrips(el, rows) {
  const max = Math.max(0, ...rows.map(r => r.trips));
  if (!max) return emptyChart(el, 'Log bathroom trips to see them here.');
  const yMax = Math.max(4, Math.ceil(max / 2) * 2), f = frame(el, rows, yMax, { step: niceStep(yMax, 4) });
  const w = Math.max(1.5, f.step * 0.62);
  let bars = '';
  rows.forEach((r, i) => {
    if (!r.trips) return;
    const x0 = f.x(i) - w / 2, clean = r.trips - r.blood;
    const yTop = f.y(r.trips), yMid = f.y(clean), base = f.y(0);
    if (r.blood) {
      bars += `<path d="${topRounded(x0, yTop, w, yMid - yTop - (clean ? 1 : 0), 4)}" style="fill:var(--blood)"/>`;
      if (clean) bars += `<rect x="${x0}" y="${yMid + 1}" width="${w}" height="${Math.max(0, base - yMid - 1)}" style="fill:var(--bar-neutral)"/>`;
    } else bars += `<path d="${topRounded(x0, yTop, w, base - yTop, 4)}" style="fill:var(--bar-neutral)"/>`;
  });
  const tip = r => `${fmtDay(r.date)}\n${r.trips ? `${r.trips} ${plural(r.trips, 'trip', 'trips')}${r.blood ? `, ${r.blood} with blood` : ''}` : 'No trips logged'}`;
  el.innerHTML = svgWrap(f, `${f.grid}${bars}${f.hits(tip)}`);
}
function chartSleep(el, rows) {
  const vals = rows.filter(r => r.sleep != null).map(r => r.sleep);
  if (!vals.length) return emptyChart(el, 'Log your nights to see how much you sleep.');
  const yMax = Math.max(10, Math.ceil(Math.max(...vals))), f = frame(el, rows, yMax, { step: yMax > 10 ? 4 : 2, r: 30 });
  const w = Math.max(1.5, f.step * 0.62);
  let bars = '';
  rows.forEach((r, i) => { if (r.sleep != null) bars += `<path d="${topRounded(f.x(i) - w / 2, f.y(r.sleep), w, f.y(0) - f.y(r.sleep), 4)}" style="fill:var(--c-sleep)"/>`; });
  const ref = `<line x1="${f.m.l}" x2="${f.W - f.m.r}" y1="${f.y(7)}" y2="${f.y(7)}" style="stroke:var(--muted);stroke-width:1.5;stroke-dasharray:4 4"/><text x="${f.W - f.m.r + 4}" y="${f.y(7) + 4}">7 h</text>`;
  const tip = r => `${fmtDay(r.date)}\n${r.sleep != null ? `Slept ${fmtDur(r.sleep * 60)}` : 'No sleep logged'}`;
  el.innerHTML = svgWrap(f, `${f.grid}${bars}${ref}${f.hits(tip)}`);
}
function chartFood(el, rows) {
  if (!rows.some(r => MACROS.some(([k]) => r[k] != null))) return emptyChart(el, 'Rate carbs, protein, fat and fibre when you log meals to see them here.');
  const f = frame(el, rows, 10, { step: 2, r: 62 });
  let body = '';
  const ends = [];
  MACROS.forEach(([k, label], i) => {
    const color = `var(--s${i + 1})`;
    body += `<path d="${linePath(rows, k, f)}" style="fill:none;stroke:${color};stroke-width:2;stroke-linejoin:round;stroke-linecap:round"/>`;
    if (f.step >= 9) body += rows.map((r, j) => (r[k] == null ? '' : `<circle cx="${f.x(j)}" cy="${f.y(r[k])}" r="4" style="fill:${color};stroke:var(--surface);stroke-width:2"/>`)).join('');
    const li = rows.reduce((a, r, j) => (r[k] != null ? j : a), -1);
    if (li >= 0) ends.push({ label, y: f.y(rows[li][k]), color });
  });
  ends.sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 13) ends[i].y = ends[i - 1].y + 13;
  body += ends.map(e => `<text class="end-label" x="${f.W - f.m.r + 6}" y="${e.y + 4}">${e.label}</text>`).join('');
  const tip = r => `${fmtDay(r.date)}\n${!MACROS.some(([k]) => r[k] != null) ? 'No meals rated' : MACROS.map(([k, l]) => `${l} ${r[k] != null ? fmtNum(r[k]) : '–'}`).join(' · ')}`;
  el.innerHTML = svgWrap(f, `${f.grid}${body}${f.hits(tip)}`);
}
function drawCharts() {
  const rows = S.trendData;
  if (!rows) return;
  const fns = { score: chartScore, trips: chartTrips, sleep: chartSleep, food: chartFood };
  document.querySelectorAll('.chart[data-chart]').forEach(el => { const fn = fns[el.dataset.chart]; if (fn) fn(el, rows); });
}

/* ---------- sheet infrastructure ---------- */
let sheetCtx = null;
function openSheet({ title, body, onSave, onDelete, onInput, saveLabel = 'Save', extraFoot = '' }) {
  const root = $('#sheet');
  root.innerHTML = `<div class="scrim" data-act="closeSheet"></div>
    <form class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title" tabindex="-1" novalidate>
      <header class="sheet-head"><h2 id="sheet-title">${esc(title)}</h2><button type="button" class="icon-btn" data-act="closeSheet" aria-label="Close">${icon('x')}</button></header>
      <div class="sheet-body">${body}</div>
      <footer class="sheet-foot">${onDelete ? '<button type="button" class="btn danger ghost" data-act="sheetDelete">Delete</button>' : ''}${extraFoot}<span class="grow"></span>
        ${onSave ? `<button type="button" class="btn ghost" data-act="closeSheet">Cancel</button><button type="submit" class="btn primary">${esc(saveLabel)}</button>` : '<button type="button" class="btn primary" data-act="closeSheet">Done</button>'}</footer>
    </form>`;
  root.hidden = false;
  document.body.classList.add('sheet-open');
  const form = $('form', root);
  sheetCtx = { onSave, onDelete, onInput, form };
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!onSave) return closeSheet();
    if (!form.reportValidity()) return;
    if (SAMPLE) toast('Sample data: this change is shown but not saved.');
    if (onSave(new FormData(form), form) !== false) closeSheet();
  });
  const changed = e => { applyWhen(form); if (onInput) onInput(form, e); };
  form.addEventListener('change', changed);
  form.addEventListener('input', changed);
  applyWhen(form);
  if (onInput) onInput(form, null);
  requestAnimationFrame(() => form.focus({ preventScroll: true }));
}
function closeSheet() {
  const root = $('#sheet');
  root.hidden = true; root.innerHTML = '';
  document.body.classList.remove('sheet-open');
  sheetCtx = null;
}
function formVal(form, name) {
  const el = form.elements[name];
  if (!el) return '';
  if (typeof RadioNodeList !== 'undefined' && el instanceof RadioNodeList) return el.value;
  if (el.type === 'checkbox') return el.checked ? 'on' : '';
  return el.value;
}
function applyWhen(form) {
  form.querySelectorAll('[data-when]').forEach(el => {
    const [name, vals] = el.dataset.when.split(':');
    el.hidden = !vals.split(',').includes(formVal(form, name));
  });
}
const fid = name => `f-${name}`;
function field(label, control, attrs = '') { return `<label class="field" ${attrs}><span class="lbl">${label}</span>${control}</label>`; }
function group(label, control, attrs = '') { return `<fieldset class="field" ${attrs}><legend class="lbl">${label}</legend>${control}</fieldset>`; }
function timeInput(name, value, req = true) { return `<input type="time" name="${name}" id="${fid(name)}" value="${esc(value || '')}" ${req ? 'required' : ''}>`; }
function textInput(name, value, ph = '', extra = '') { return `<input type="text" name="${name}" id="${fid(name)}" value="${esc(value || '')}" placeholder="${esc(ph)}" autocomplete="off" ${extra}>`; }
function numInput(name, value, extra = '') { return `<input type="number" name="${name}" id="${fid(name)}" value="${value ?? ''}" inputmode="decimal" step="any" ${extra}>`; }
function seg(name, labels, value, { values, cls = '' } = {}) {
  return `<div class="seg ${cls}">${labels.map((l, i) => { const v = values ? values[i] : i; return `<label><input type="radio" name="${name}" value="${esc(v)}" ${String(v) === String(value) ? 'checked' : ''}><span>${esc(l)}</span></label>`; }).join('')}</div>`;
}
function chips(name, labels, selected = [], values) {
  return `<div class="chips">${labels.map((l, i) => { const v = values ? values[i] : l; return `<label><input type="checkbox" name="${name}" value="${esc(v)}" ${selected.includes(v) ? 'checked' : ''}><span>${esc(l)}</span></label>`; }).join('')}</div>`;
}
function range(name, min, max, value) {
  return `<div class="range"><input type="range" name="${name}" id="${fid(name)}" min="${min}" max="${max}" step="1" value="${value ?? min}" data-out="o-${name}"><output id="o-${name}">${value ?? min}</output></div>`;
}
function scale5(name, value, low, high) {
  return `${seg(name, ['1', '2', '3', '4', '5'], value, { values: [1, 2, 3, 4, 5] })}<span class="hint">1 = ${low}, 5 = ${high}</span>`;
}
const noteField = v => field('Note', textInput('note', v, 'Optional'));
const defTime = date => (date === today() ? nowHM() : '12:00');
function findEntry(date, list, id) { return (getDay(date)[list] || []).find(x => x.id === id); }

/* ---------- bathroom ---------- */
function isNightTime(hm, date) {
  const m = toMin(hm);
  const pend = D().settings.sleepPending;
  if (pend && date === today() && pend.date === date) return true;
  return m != null && (m >= 23 * 60 || m < 6 * 60);
}
function sheetBm(date, entry) {
  const prev = (getDay(date).bm || []).slice(-1)[0];
  const t = entry ? entry.t : defTime(date);
  const e = entry || { id: uid(), t, bristol: prev ? prev.bristol : 4, blood: 0, urgency: 0, pain: 0, night: isNightTime(t, date), note: '' };
  const bristol = `<div class="bristol">${[1, 2, 3, 4, 5, 6, 7].map(n => `<label><input type="radio" name="bristol" value="${n}" ${n === e.bristol ? 'checked' : ''}><span><b>${n}</b><small>${BRISTOL[n]}</small></span></label>`).join('')}</div>`;
  openSheet({
    title: entry ? 'Edit bathroom trip' : 'Bathroom trip',
    body: `<div class="row2">${field('Time', timeInput('t', e.t))}<label class="toggle"><input type="checkbox" name="night" id="f-night" ${e.night ? 'checked' : ''}><span>Woke me up at night</span></label></div>
      ${group('Stool type <span class="hint">Bristol scale</span>', bristol + '<span class="hint">3–4 is typical. 6–7 means loose or watery.</span>')}
      ${group('Blood', seg('blood', BLOOD, e.blood, { cls: 'blood' }))}
      ${group('Urgency', seg('urgency', URGENCY, e.urgency))}
      <div class="field"><label class="lbl" for="f-pain">Pain or cramping (0–10)</label>${range('pain', 0, 10, e.pain)}</div>
      ${hasIron() ? '<p class="sub-note">You take iron, which often turns stool dark or black. Mention any change you are unsure about to your doctor.</p>' : ''}
      ${noteField(e.note)}`,
    onInput: (form, ev) => {
      if (!ev) return;
      if (ev.target.name === 'night') form.dataset.nightTouched = '1';
      if (ev.target.name === 't' && !form.dataset.nightTouched) form.elements.night.checked = isNightTime(ev.target.value, date);
    },
    onSave: fd => {
      upsertEntry(date, 'bm', { id: e.id, t: fd.get('t'), bristol: Number(fd.get('bristol')) || null, blood: Number(fd.get('blood')) || 0, urgency: Number(fd.get('urgency')) || 0, pain: Number(fd.get('pain')) || 0, night: fd.get('night') === 'on', note: (fd.get('note') || '').trim() });
      if (!entry) toast('Bathroom trip logged');
    },
    onDelete: entry ? () => removeEntry(date, 'bm', e.id, 'bathroom trip') : null,
  });
}

/* ---------- meal ---------- */
function mealTypeFor(hm) { const m = toMin(hm) ?? 720; return m < 630 ? 'Breakfast' : m < 900 ? 'Lunch' : m < 1050 ? 'Snack' : 'Dinner'; }
function sheetMeal(date, entry) {
  const t = entry ? entry.t : defTime(date);
  const e = entry || { id: uid(), t, type: mealTypeFor(t), desc: '', tags: [], portion: 'Normal', carbs: null, protein: null, fat: null, fiber: null, note: '' };
  const rate = (k, label, hint) => `<fieldset class="field"><div class="rate-head"><legend class="lbl">${label} <span class="hint">${hint}</span></legend><button type="button" data-act="clearRate" data-k="${k}">Clear</button></div>${seg(k, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'], e[k] ?? '', { values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], cls: 'rate' })}</fieldset>`;
  const favs = D().settings.favorites || [];
  const recent = [...new Set(Object.values(D().days).flatMap(d => (d.meals || []).map(x => x.desc)).filter(Boolean))].slice(-40);
  openSheet({
    title: entry ? 'Edit meal' : 'Meal or drink',
    body: `${!entry && favs.length ? group('Favourites', `<div class="favs">${favs.map((f, i) => `<button type="button" class="chip-btn" data-act="useFav" data-i="${i}">${esc(f.desc)}</button>`).join('')}</div>`) : ''}
      <div class="row2">${field('Time', timeInput('t', e.t))}${field('Portion', `<select name="portion" id="f-portion">${PORTIONS.map(p => `<option ${p === e.portion ? 'selected' : ''}>${p}</option>`).join('')}</select>`)}</div>
      ${group('Type', seg('type', MEAL_TYPES, e.type, { values: MEAL_TYPES }))}
      ${field('What did you have?', textInput('desc', e.desc, 'e.g. Rice, dal and curd', 'required list="meal-list"') + `<datalist id="meal-list">${recent.map(r => `<option value="${esc(r)}"></option>`).join('')}</datalist>`)}
      ${rate('carbs', 'Carbs', '1 = very little, 10 = mostly carbs')}
      ${rate('protein', 'Protein', '1 = very little, 10 = a lot')}
      ${rate('fiber', 'Fibre', '1 = very little, 10 = lots of veg, whole grains or beans')}
      ${rate('fat', 'Fat', '1 = very little, 10 = very rich or fried')}
      ${group('Tags <span class="hint">used to spot triggers</span>', chips('tags', FOOD_TAGS.map(tagLabel), e.tags || [], FOOD_TAGS))}
      ${noteField(e.note)}
      ${favs.some(f => f.desc === e.desc) ? '' : '<label class="toggle"><input type="checkbox" name="fav" id="f-fav"><span>Save to favourites</span></label>'}`,
    onSave: fd => {
      const rating = k => { const v = Number(fd.get(k)); return v >= 1 && v <= 10 ? v : null; };
      const x = { id: e.id, t: fd.get('t'), type: fd.get('type') || 'Snack', desc: (fd.get('desc') || '').trim(), tags: fd.getAll('tags'), portion: fd.get('portion') || 'Normal', carbs: rating('carbs'), protein: rating('protein'), fat: rating('fat'), fiber: rating('fiber'), note: (fd.get('note') || '').trim() };
      upsertEntry(date, 'meals', x);
      if (!entry && fd.get('fav') !== 'on') autoFavourite(x);
      if (fd.get('fav') === 'on' && x.desc) { D().settings.favorites = (D().settings.favorites || []).concat({ desc: x.desc, tags: x.tags, type: x.type, carbs: x.carbs, protein: x.protein, fat: x.fat, fiber: x.fiber }).slice(-24); D().settings.favDismissed = (D().settings.favDismissed || []).filter(k => k !== mealKey(x.desc)); saveSettings(); }
      if (!entry) toast('Meal logged');
    },
    onDelete: entry ? () => removeEntry(date, 'meals', e.id, 'meal') : null,
  });
}

// A meal logged 3 times, with no more than 15 days between one log and the next, becomes a favourite.
// Meals someone removed from favourites are never added back automatically.
const mealKey = t => String(t || '').trim().toLowerCase();
function autoFavourite(x) {
  const st = D().settings, key = mealKey(x.desc);
  if (!key || (st.favorites || []).some(f => mealKey(f.desc) === key) || (st.favDismissed || []).includes(key)) return;
  const dates = [];
  for (const [date, day] of Object.entries(D().days)) for (const m of day.meals || []) if (mealKey(m.desc) === key) dates.push(date);
  dates.sort();
  if (dates.length < 3) return;
  const [a, b, c] = dates.slice(-3);
  if (daysBetween(a, b) > 15 || daysBetween(b, c) > 15) return;
  st.favorites = (st.favorites || []).concat({ desc: x.desc, tags: x.tags, type: x.type, carbs: x.carbs, protein: x.protein, fat: x.fat, fiber: x.fiber, auto: true }).slice(-24);
  saveSettings();
  setTimeout(() => toast(`Added “${x.desc}” to favourites`), 50);
}

/* ---------- period ---------- */
function sheetPeriod(date) {
  const cur = getDay(date).period, prev = (getDay(addDays(date, -1)).period || {}).flow || 0;
  const e = cur || { flow: prev || 3, symptoms: [], note: '' };
  openSheet({
    title: cur ? 'Edit period' : 'Period',
    body: `${group('Bleeding', seg('flow', FLOW, e.flow, { cls: 'blood' }))}
      ${group('Symptoms', chips('psym', PERIOD_SYMPTOMS, e.symptoms || []))}
      ${noteField(e.note)}
      <p class="hint">Log each day you bleed, starting on the first day. Over time this shows whether your IBD symptoms change around your period.</p>`,
    onSave: fd => {
      const x = { flow: Number(fd.get('flow')) || 0, symptoms: fd.getAll('psym'), note: (fd.get('note') || '').trim() };
      mutDay(date, d => { d.period = x.flow || x.symptoms.length || x.note ? x : null; });
      if (!cur) toast('Period logged');
    },
    onDelete: cur ? () => { const old = cur; mutDay(date, d => { d.period = null; }); toast('Deleted period entry', 'Undo', () => mutDay(date, d => { d.period = old; })); } : null,
  });
}

/* ---------- exercise ---------- */
function sheetEx(date, entry) {
  const e = entry || { id: uid(), t: defTime(date), type: 'Walk', mins: 30, intensity: 'Easy', steps: null, before: 3, after: 3, symptoms: 'None', note: '' };
  openSheet({
    title: entry ? 'Edit exercise' : 'Exercise',
    body: `${group('Activity', seg('type', EX_TYPES, e.type, { values: EX_TYPES }))}
      <div class="row3">${field('Started', timeInput('t', e.t))}${field('Minutes', numInput('mins', e.mins, 'min="1" max="600" required'))}${field('Steps', numInput('steps', e.steps, 'min="0" placeholder="Optional"'))}</div>
      ${group('Intensity', seg('intensity', INTENSITY, e.intensity, { values: INTENSITY }))}
      ${group('Energy before', scale5('before', e.before, 'drained', 'full of energy'))}
      ${group('Energy after', scale5('after', e.after, 'drained', 'full of energy'))}
      ${group('Symptoms during or after', seg('symptoms', EX_SYMPTOMS, e.symptoms, { values: EX_SYMPTOMS }))}
      ${noteField(e.note)}`,
    onSave: fd => {
      upsertEntry(date, 'exercise', { id: e.id, t: fd.get('t'), type: fd.get('type') || 'Other', mins: num(fd.get('mins')) || 0, intensity: fd.get('intensity') || 'Easy', steps: num(fd.get('steps')), before: Number(fd.get('before')) || null, after: Number(fd.get('after')) || null, symptoms: fd.get('symptoms') || 'None', note: (fd.get('note') || '').trim() });
      if (!entry) toast('Exercise logged');
    },
    onDelete: entry ? () => removeEntry(date, 'exercise', e.id, 'exercise') : null,
  });
}

/* ---------- nap ---------- */
function sheetNap(date, entry) {
  const e = entry || { id: uid(), t: date === today() ? fromMin(toMin(nowHM()) - 30) : '15:00', mins: 30, note: '' };
  openSheet({
    title: entry ? 'Edit nap' : 'Nap',
    body: `<div class="row2">${field('Started', timeInput('t', e.t))}${field('Minutes', numInput('mins', e.mins, 'min="1" max="600" required'))}</div>${noteField(e.note)}`,
    onSave: fd => { upsertEntry(date, 'naps', { id: e.id, t: fd.get('t'), mins: num(fd.get('mins')) || 0, note: (fd.get('note') || '').trim() }); if (!entry) toast('Nap logged'); },
    onDelete: entry ? () => removeEntry(date, 'naps', e.id, 'nap') : null,
  });
}

/* ---------- check-in ---------- */
function sheetCheckin(date) {
  const cur = getDay(date).checkin;
  const e = cur || { t: date === today() ? nowHM() : '21:00', wellbeing: 0, pain: 0, fatigue: 0, stress: 2, mood: 3, tenesmus: false, extra: [], weight: null, note: '' };
  const wu = D().settings.weightUnit || 'kg';
  openSheet({
    title: cur ? 'Edit check-in' : 'Daily check-in',
    body: `${field('Time', timeInput('t', e.t))}
      ${group('Overall, how have you felt today?', seg('wellbeing', WELLBEING, e.wellbeing ?? 0))}
      <div class="field"><label class="lbl" for="f-pain">Belly pain (0–10)</label>${range('pain', 0, 10, e.pain)}</div>
      <div class="field"><label class="lbl" for="f-fatigue">Tiredness (0–10)</label>${range('fatigue', 0, 10, e.fatigue)}</div>
      ${group('Stress', scale5('stress', e.stress, 'calm', 'very stressed'))}
      ${group('Mood', scale5('mood', e.mood, 'low', 'great'))}
      <label class="toggle"><input type="checkbox" name="tenesmus" id="f-tenesmus" ${e.tenesmus ? 'checked' : ''}><span>Felt the need to go, but nothing came</span></label>
      ${(() => { const list = EXTRA.filter(x => !x.cd || D().settings.condition === 'cd' || (e.extra || []).includes(x.id)); return group('Anything else today?', chips('extra', list.map(x => x.label), e.extra || [], list.map(x => x.id))); })()}
      <div class="row2">${field(`Weight (${wu})`, numInput('weight', e.weight, 'min="0" placeholder="Optional"'))}<span></span></div>
      ${noteField(e.note)}`,
    onSave: fd => {
      const x = { t: fd.get('t'), wellbeing: Number(fd.get('wellbeing')) || 0, pain: Number(fd.get('pain')) || 0, fatigue: Number(fd.get('fatigue')) || 0, stress: Number(fd.get('stress')) || null, mood: Number(fd.get('mood')) || null, tenesmus: fd.get('tenesmus') === 'on', extra: fd.getAll('extra'), weight: num(fd.get('weight')), weightUnit: wu, note: (fd.get('note') || '').trim() };
      mutDay(date, d => { d.checkin = x; });
      if (!cur) toast('Check-in saved');
    },
    onDelete: cur ? () => { const old = cur; mutDay(date, d => { d.checkin = null; }); toast('Deleted check-in', 'Undo', () => mutDay(date, d => { d.checkin = old; })); } : null,
  });
}

/* ---------- doses ---------- */
function sheetDose(date, opts = {}) {
  const meds = D().meds, existing = opts.dose;
  const list = Object.values(meds).filter(m => medActiveOn(m, date) || (existing && m.id === existing.medId)).sort((a, b) => a.name.localeCompare(b.name));
  if (!list.length && !existing) { toast('Add a medicine or supplement first.'); S.tab = 'meds'; render(); sheetMed(); return; }
  const medId = (existing && existing.medId) || opts.medId || (list.find(m => m.schedule && m.schedule.type === 'prn') || list[0]).id;
  const m0 = meds[medId];
  const a0 = m0 ? doseAmount(m0, date) : { amount: null };
  const site0 = nextSite(medId);
  const d = existing ? clone(existing) : { id: uid(), medId, slot: opts.slot || null, status: opts.status || 'taken', t: date === today() ? nowHM() : opts.slot || '12:00', amount: a0.amount, unit: m0 && m0.unit, reason: 'Forgot', why: '', site: site0.next, note: '' };
  const fixed = !!(existing || opts.slot);
  const unitOf = m => (m && m.unit !== 'other' ? m.unit : 'units');
  const who = fixed
    ? `<input type="hidden" name="medId" value="${esc(medId)}"><div class="btns" style="justify-content:space-between"><p><strong>${esc(m0 ? m0.name : d.name || 'Medicine')}</strong>${d.slot ? ` <span class="muted">· scheduled ${fmtTime(d.slot)}</span>` : ''}</p>${m0 ? `<button type="button" class="btn small ghost" data-act="editMed" data-id="${m0.id}">Edit or remove this medicine</button>` : ''}</div>`
    : field('Medicine or supplement', `<select name="medId" id="f-medId">${list.map(m => `<option value="${m.id}" ${m.id === medId ? 'selected' : ''}>${esc(m.name)}${m.schedule && m.schedule.type === 'prn' ? ' (as needed)' : ''}</option>`).join('')}</select>`);
  openSheet({
    title: existing ? 'Edit dose' : 'Log a dose',
    body: `${who}
      ${group('Status', seg('status', ['Taken', 'Skipped'], d.status, { values: ['taken', 'skipped'] }))}
      <div class="row2">${field('Time', timeInput('t', d.t))}${field(`Amount (<span data-unit>${esc(unitOf(m0))}</span>)`, numInput('amount', d.amount, 'min="0"'), 'data-when="status:taken"')}</div>
      ${field('Why was it skipped?', `<select name="reason" id="f-reason">${SKIP_REASONS.map(r => `<option ${r === d.reason ? 'selected' : ''}>${r}</option>`).join('')}</select>`, 'data-when="status:skipped"')}
      <div data-prn ${m0 && m0.schedule && m0.schedule.type === 'prn' ? '' : 'hidden'}>${field('What was it for?', textInput('why', d.why, 'e.g. Loose stools before travel'))}</div>
      <div data-site ${m0 && m0.form === 'injection' ? '' : 'hidden'}>${group(`Injection site${site0.last ? ` <span class="hint">last time: ${esc(site0.last)}</span>` : ''}`, seg('site', SITES, d.site, { values: SITES }))}</div>
      ${noteField(d.note)}`,
    onInput: (form, ev) => {
      if (!ev || ev.target.name !== 'medId') return;
      const m = meds[form.elements.medId.value];
      if (!m) return;
      form.elements.amount.value = doseAmount(m, date).amount ?? '';
      form.querySelectorAll('[data-unit]').forEach(el => { el.textContent = unitOf(m); });
      form.querySelector('[data-prn]').hidden = !(m.schedule && m.schedule.type === 'prn');
      form.querySelector('[data-site]').hidden = m.form !== 'injection';
    },
    onSave: fd => {
      const id = fd.get('medId'), m = meds[id], status = fd.get('status') || 'taken', amount = num(fd.get('amount'));
      const qty = status !== 'taken' ? 0 : m && m.strength && amount != null ? amount / m.strength : (m && m.qty) || 1;
      upsertEntry(date, 'doses', {
        id: d.id, medId: id, name: m ? m.name : d.name, slot: d.slot, status, t: fd.get('t'), amount, unit: m ? m.unit : d.unit, qty,
        reason: status === 'skipped' ? fd.get('reason') : '', why: (fd.get('why') || '').trim(), site: m && m.form === 'injection' ? fd.get('site') || '' : '', note: (fd.get('note') || '').trim(),
      });
      if (!existing && m && m.schedule && m.schedule.type === 'interval' && status === 'taken' && !slotsFor(m, date).length) {
        const m2 = clone(m); m2.schedule.anchor = date; saveMed(m2);
      }
      if (!existing) toast(status === 'taken' ? 'Dose logged' : 'Marked as skipped');
    },
    onDelete: existing ? () => removeEntry(date, 'doses', d.id, 'dose') : null,
  });
}
function takeDose(date, medId, slot) {
  const m = D().meds[medId];
  if (!m) return;
  if (m.form === 'injection') return sheetDose(date, { medId, slot });
  const a = doseAmount(m, date), id = uid();
  upsertEntry(date, 'doses', { id, medId, name: m.name, slot, status: 'taken', t: date === today() ? nowHM() : slot, amount: a.amount, unit: m.unit, qty: a.qty ?? 1, note: '' });
  toast(`Took ${m.name}`, 'Undo', () => mutDay(date, d => { d.doses = d.doses.filter(x => x.id !== id); }));
}
function takeAll(date, slot) {
  const day = getDay(date), now = date === today() ? nowHM() : slot, added = [];
  for (const m of Object.values(D().meds)) {
    if (!slotsFor(m, date).some(s => s.time === slot)) continue;
    if ((day.doses || []).some(x => x.medId === m.id && x.slot === slot)) continue;
    const a = doseAmount(m, date);
    added.push({ id: uid(), medId: m.id, name: m.name, slot, status: 'taken', t: now, amount: a.amount, unit: m.unit, qty: a.qty ?? 1, note: '' });
  }
  if (!added.length) return;
  mutDay(date, d => { d.doses.push(...added); });
  toast(`Logged ${added.length} doses`, 'Undo', () => mutDay(date, d => { d.doses = d.doses.filter(x => !added.some(a => a.id === x.id)); }));
}
function sheetDoseGroup(date, ids) {
  const doses = (getDay(date).doses || []).filter(x => ids.includes(x.id));
  if (doses.length === 1) return sheetDose(date, { dose: doses[0] });
  openSheet({
    title: `Doses at ${fmtTime(doses[0] && doses[0].t)}`,
    body: `<ul class="dose-list">${doses.map(x => { const m = D().meds[x.medId]; return `<li class="dose-row"><div class="dose-main"><span class="dose-name">${esc(m ? m.name : x.name)}</span><span class="dose-amt">${x.status === 'taken' ? `Taken${x.amount != null ? ` · ${fmtNum(x.amount)} ${esc(x.unit || '')}` : ''}` : `Skipped · ${esc(x.reason || '')}`}</span></div><button type="button" class="btn small" data-act="editDose" data-id="${x.id}">Edit</button></li>`; }).join('')}</ul>`,
  });
}

/* ---------- sleep ---------- */
function sheetSleep(date, prefill) {
  const cur = getDay(date).sleep, last = lastSleep(date);
  const base = cur || Object.assign({ inBed: '23:00', asleep: '23:20', wake: '07:00', up: '07:10' }, last ? { inBed: last.inBed, asleep: last.asleep, wake: last.wake, up: last.up } : {});
  const s = Object.assign({ quality: 3, rested: 3, pain: 0, other: 0, factors: [], note: '' }, base, prefill || {});
  const auto = autoFactors(date);
  openSheet({
    title: `Night before ${date === today() ? 'today' : fmtDay(date)}`,
    body: `<div class="row2">${field('Got into bed', timeInput('inBed', s.inBed))}${field('Fell asleep (roughly)', timeInput('asleep', s.asleep))}${field('Woke up', timeInput('wake', s.wake))}${field('Got out of bed', timeInput('up', s.up))}</div>
      <p class="calc" data-calc></p>
      ${group('Sleep quality', scale5('quality', s.quality, 'very poor', 'great'))}
      ${group('How rested do you feel?', scale5('rested', s.rested, 'exhausted', 'fully rested'))}
      <div class="row2">${field('Woke from pain', numInput('pain', s.pain, 'min="0" max="20" step="1"'))}${field('Woke for other reasons', numInput('other', s.other, 'min="0" max="20" step="1"'))}</div>
      ${auto.length ? group('From your log the evening before', `<div class="info-chips">${auto.map(a => `<span class="fact">${esc(a)}</span>`).join('')}</div>`) : ''}
      ${group('Anything else?', chips('factor', SLEEP_FACTORS, s.factors || []))}
      ${noteField(s.note)}`,
    onInput: form => {
      const v = n => form.elements[n].value;
      const c = sleepCalc(date, { inBed: v('inBed'), asleep: v('asleep'), wake: v('wake'), up: v('up') });
      const out = form.querySelector('[data-calc]');
      if (!c || c.total <= 0) { out.textContent = 'Waking up should come after falling asleep.'; return; }
      out.textContent = `${fmtDur(c.total)} asleep · ${fmtDur(c.inBedDur)} in bed · fell asleep in ${fmtDur(c.latency)}${c.eff != null ? ` · ${c.eff}% asleep` : ''} · ${c.trips} bathroom ${plural(c.trips, 'trip', 'trips')} logged overnight`;
    },
    onSave: fd => {
      const x = { inBed: fd.get('inBed'), asleep: fd.get('asleep') || fd.get('inBed'), wake: fd.get('wake'), up: fd.get('up') || fd.get('wake'), quality: Number(fd.get('quality')) || null, rested: Number(fd.get('rested')) || null, pain: num(fd.get('pain')) || 0, other: num(fd.get('other')) || 0, factors: fd.getAll('factor'), note: (fd.get('note') || '').trim() };
      const c = sleepCalc(date, x);
      if (!c || c.total <= 0 || c.latency < 0) { toast('Check the times: you fell asleep after getting into bed, and woke after falling asleep.'); return false; }
      mutDay(date, d => { d.sleep = x; });
      const pend = D().settings.sleepPending;
      if (pend && pend.date <= date) { D().settings.sleepPending = null; saveSettings(); }
      if (!cur) toast(`Logged ${fmtDur(c.total)} of sleep`);
    },
    onDelete: cur ? () => { const old = cur; mutDay(date, d => { d.sleep = null; }); toast('Deleted night', 'Undo', () => mutDay(date, d => { d.sleep = old; })); } : null,
  });
}

/* ---------- medicine editor ---------- */
function timeRow(t) { return `<div class="time-row"><input type="time" name="time" value="${esc(t)}" aria-label="Dose time" required><button type="button" class="icon-btn" data-act="rmTime" aria-label="Remove this time">${icon('x')}</button></div>`; }
function collectMed(fd, base) {
  const m = clone(base);
  m.kind = fd.get('kind') || 'medicine';
  m.name = (fd.get('name') || '').trim();
  m.category = m.kind === 'medicine' ? fd.get('category') || 'Other' : '';
  m.form = fd.get('form') || 'tablet';
  m.strength = num(fd.get('strength'));
  m.unit = fd.get('unit') || 'mg';
  m.qty = num(fd.get('qty')) || 1;
  const type = fd.get('stype') || 'daily', times = fd.getAll('time').filter(Boolean).sort();
  const n = Math.max(1, Math.round(num(fd.get('everyN')) || 1));
  m.schedule = { type, times: times.length ? times : ['08:00'], weekdays: fd.getAll('wd').map(Number), everyDays: fd.get('everyU') === 'weeks' ? n * 7 : n, anchor: fd.get('anchor') || today() };
  if (type === 'interval') m.schedule.times = m.schedule.times.slice(0, 1);
  m.taper = { on: m.kind === 'medicine' && fd.get('taperOn') === 'on', startDose: num(fd.get('tStart')), step: num(fd.get('tStep')) || 0, everyDays: Math.max(1, Math.round(num(fd.get('tEvery')) || 7)), endDose: num(fd.get('tEnd')) || 0, startDate: fd.get('tDate') || today() };
  m.food = fd.get('food') || 'any';
  m.instructions = (fd.get('instructions') || '').trim();
  m.startDate = fd.get('startDate') || today();
  m.endDate = fd.get('endDate') || '';
  m.refillDays = num(fd.get('refillDays')) ?? 7;
  return m;
}
function sheetMed(existing) {
  const m = existing ? clone(existing) : newMed();
  const s = m.schedule, tp = m.taper;
  const weeks = s.everyDays % 7 === 0, everyN = weeks ? s.everyDays / 7 : s.everyDays;
  const anchor = s.type === 'interval' ? nextDue(m, today()) || s.anchor : s.anchor || today();
  const st = stockLeft(m);
  const opt = (v, cur, label = v) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(label)}</option>`;
  openSheet({
    title: existing ? `Edit ${m.name}` : 'Add a medicine or supplement',
    saveLabel: existing ? 'Save changes' : 'Add',
    extraFoot: existing && !isStopped(m) ? '<button type="button" class="btn ghost" data-act="stopMed">Stop taking</button>' : '',
    body: `${group('Type', seg('kind', ['Medicine', 'Vitamin', 'Supplement'], m.kind, { values: ['medicine', 'vitamin', 'supplement'] }))}
      ${existing ? '' : group('Quick start', `<div class="presets">${PRESETS.map((p, i) => `<button type="button" class="chip-btn" data-act="preset" data-i="${i}" data-when="kind:${p.kind}">${esc(p.name)}</button>`).join('')}</div>`)}
      ${field('Name', textInput('name', m.name, 'e.g. Mesalamine', 'required'))}
      <div class="row2">
        ${field('Category', `<select name="category" id="f-category">${CATEGORIES.map(c => opt(c, m.category)).join('')}</select>`, 'data-when="kind:medicine"')}
        ${field('Form', `<select name="form" id="f-form">${Object.entries(FORMS).map(([k, v]) => opt(k, m.form, v[0])).join('')}</select>`)}
      </div>
      <div class="row3">
        ${field('Strength of one <span data-formword>unit</span>', numInput('strength', m.strength, 'min="0" placeholder="e.g. 1.2"'))}
        ${field('Unit', `<select name="unit" id="f-unit">${UNITS.map(u => opt(u, m.unit)).join('')}</select>`)}
        ${field('How many per dose', numInput('qty', m.qty, 'min="0.25" step="0.25"'), 'data-when="taperOn:"')}
      </div>
      <p class="calc" data-dose></p>
      ${group('When', seg('stype', ['Every day', 'Some weekdays', 'Every few days or weeks', 'As needed'], s.type, { values: ['daily', 'weekly', 'interval', 'prn'] }))}
      ${group('Days', chips('wd', WEEKDAYS, s.weekdays || [], [1, 2, 3, 4, 5, 6, 7]), 'data-when="stype:weekly"')}
      <div class="row2" data-when="stype:interval">
        ${field('Every', `<div class="inline">${numInput('everyN', everyN, 'min="1" step="1"')}<select name="everyU" id="f-everyU">${opt('weeks', weeks ? 'weeks' : 'days')}${opt('days', weeks ? 'weeks' : 'days')}</select></div>`)}
        ${field('Next dose on', `<input type="date" name="anchor" id="f-anchor" value="${esc(anchor)}">`)}
      </div>
      ${group('Time of day', `<div class="times" data-times>${(s.times && s.times.length ? s.times : ['08:00']).map(timeRow).join('')}</div><div><button type="button" class="btn small ghost" data-act="addTime" data-when="stype:daily,weekly">${icon('plus')}Add another time</button></div>`, 'data-when="stype:daily,weekly,interval"')}
      <div class="field" data-when="kind:medicine">
        <label class="toggle"><input type="checkbox" name="taperOn" id="f-taperOn" ${tp.on ? 'checked' : ''}><span>Tapering dose, for example a steroid that steps down each week</span></label>
        <div data-when="taperOn:on" class="field">
          <div class="row2">
            ${field('Starting dose (<span data-unitword>mg</span>)', numInput('tStart', tp.startDose, 'min="0"'))}
            ${field('Starting on', `<input type="date" name="tDate" id="f-tDate" value="${esc(tp.startDate)}">`)}
            ${field('Reduce by (<span data-unitword>mg</span>)', numInput('tStep', tp.step, 'min="0"'))}
            ${field('Every (days)', numInput('tEvery', tp.everyDays, 'min="1" step="1"'))}
            ${field('Stop at (<span data-unitword>mg</span>)', numInput('tEnd', tp.endDose, 'min="0"'))}
          </div>
          <p class="calc" data-taper></p>
        </div>
      </div>
      ${group('Food', seg('food', ['Any time', 'With food', 'Empty stomach'], m.food, { values: ['any', 'with', 'empty'] }))}
      ${field('Instructions or reminders', textInput('instructions', m.instructions, 'e.g. Keep 2 hours apart from calcium'))}
      <div class="row2">${field('Started', `<input type="date" name="startDate" id="f-startDate" value="${esc(m.startDate)}">`)}${field('Ends <span class="hint">optional</span>', `<input type="date" name="endDate" id="f-endDate" value="${esc(m.endDate)}">`)}</div>
      <div class="row2">${field('Number on hand <span class="hint">optional</span>', numInput('stock', st ? st.left : '', 'min="0" placeholder="e.g. 60"'))}${field('Warn when days left', numInput('refillDays', m.refillDays ?? 7, 'min="0" step="1"'))}</div>`,
    onInput: form => {
      const x = collectMed(new FormData(form), m);
      form.querySelectorAll('[data-formword]').forEach(el => { el.textContent = formWord(x.form, 1); });
      form.querySelectorAll('[data-unitword]').forEach(el => { el.textContent = x.unit === 'other' ? 'units' : x.unit; });
      const dt = doseText(x, today());
      form.querySelector('[data-dose]').textContent = dt ? `Each dose today: ${dt}` : '';
      const tpEl = form.querySelector('[data-taper]');
      if (tpEl) tpEl.textContent = x.taper.on ? taperText(x) || 'Enter a starting dose to see the plan.' : '';
    },
    onSave: fd => {
      const x = collectMed(fd, m);
      if (!x.name) { toast('Add a name.'); return false; }
      if (x.schedule.type === 'weekly' && !x.schedule.weekdays.length) { toast('Pick at least one day.'); return false; }
      if (x.taper.on && x.taper.startDose == null) { toast('Add the starting dose for the taper.'); return false; }
      const stock = num(fd.get('stock'));
      if (stock == null) x.stock = null;
      else if (!st || stock !== st.left) x.stock = { count: stock, date: today(), time: nowHM() };
      if (existing) {
        const before = `${doseText(existing)} · ${scheduleText(existing)}`, after = `${doseText(x)} · ${scheduleText(x)}`;
        if (before !== after) x.changes = (x.changes || []).concat({ date: today(), text: after }).slice(-20);
      }
      saveMed(x);
      toast(existing ? 'Saved' : `Added ${x.name}`);
    },
    onDelete: existing ? () => { const old = clone(existing); deleteMed(existing.id); toast(`Deleted ${old.name}`, 'Undo', () => saveMed(old)); } : null,
  });
  sheetCtx.medId = m.id;
}
function applyPreset(form, p) {
  const set = (n, v) => { const el = form.elements[n]; if (!el) return; if (typeof RadioNodeList !== 'undefined' && el instanceof RadioNodeList) { for (const r of el) r.checked = r.value === v; } else el.value = v; };
  set('name', p.name);
  if (p.category) set('category', p.category);
  set('form', p.form); set('unit', p.unit); set('stype', p.schedule || 'daily');
  if (form.elements.taperOn) form.elements.taperOn.checked = !!p.taper;
  if (p.schedule === 'interval') { set('everyN', p.form === 'infusion' ? '8' : '2'); set('everyU', 'weeks'); }
  applyWhen(form);
  if (sheetCtx && sheetCtx.onInput) sheetCtx.onInput(form, null);
}
function sheetRefill(m) {
  openSheet({
    title: `Refill ${m.name}`,
    body: `${field(`How many ${formWord(m.form, 2)} do you have now?`, numInput('count', '', 'min="0" required'))}<p class="hint">This resets the count. Doses you log from now on come off it.</p>`,
    onSave: fd => { const c = num(fd.get('count')); if (c == null) return false; const x = clone(m); x.stock = { count: c, date: today(), time: nowHM() }; saveMed(x); toast('Stock updated'); },
  });
}

/* ---------- toast ---------- */
function toast(msg, actLabel, fn) {
  const el = $('#toast');
  el.innerHTML = `<span>${esc(msg)}</span>${actLabel ? `<button type="button">${esc(actLabel)}</button>` : ''}`;
  el.hidden = false;
  clearTimeout(toast.t);
  const hide = () => { el.hidden = true; };
  if (actLabel) el.querySelector('button').onclick = () => { hide(); fn(); };
  toast.t = setTimeout(hide, actLabel ? 6000 : 2800);
}

/* ---------- sample mode ---------- */
function enterSample() { SAMPLE = makeSample(); S.date = today(); S.followToday = true; S.histMonth = today().slice(0, 7); S.tab = 'today'; window.scrollTo(0, 0); render(); }
function exitSample() { SAMPLE = null; S.date = today(); S.followToday = true; S.tab = 'today'; window.scrollTo(0, 0); render(); }
function markReady() { if (S.ready) return; S.ready = true; render(); }

/* ---------- export / import ---------- */
// On phones the share menu lets people save straight to Google Drive, iCloud Drive or Files.
// On computers the file goes to Downloads.
async function saveFile(filename, text, mime) {
  let touch = false;
  try { touch = window.matchMedia('(pointer: coarse)').matches; } catch (e) { /* ignore */ }
  if (touch && navigator.canShare) {
    try {
      const file = new File([text], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: filename });
        return 'shared';
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled';
    }
  }
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return 'downloaded';
  } catch (e) { toast("Couldn't save the file on this device."); return 'failed'; }
}
function gatherAll() {
  const days = clone(Object.values(D().days)).sort((a, b) => (a.date > b.date ? 1 : -1));
  return { app: 'ibd-tracker', version: 1, exportedAt: new Date().toISOString(), settings: clone(D().settings), meds: clone(Object.values(D().meds)), days };
}
async function exportJson() {
  const res = await saveFile(`track-your-ibd-backup-${today()}.json`, JSON.stringify(gatherAll(), null, 1), 'application/json');
  if ((res === 'shared' || res === 'downloaded') && !SAMPLE) {
    R.settings.lastBackup = new Date().toISOString(); R.settings.backupSnooze = null; saveSettings(); render();
    toast(res === 'shared' ? 'Backup saved' : 'Backup saved to your Downloads folder');
  }
}
async function exportCsv() {
  const all = gatherAll();
  const meds = Object.fromEntries(all.meds.map(m => [m.id, m]));
  const rows = [['Date', 'Time', 'Category', 'Item', 'Amount', 'Details', 'Note']];
  const add = (...r) => rows.push(r);
  for (const d of all.days) {
    const date = d.date;
    if (d.sleep) { const c = sleepCalc(date, d.sleep); add(date, d.sleep.wake, 'Sleep', 'Night', c ? fmtDur(c.total) : '', `In bed ${d.sleep.inBed}; asleep ${d.sleep.asleep}; woke ${d.sleep.wake}; up ${d.sleep.up}; quality ${d.sleep.quality ?? ''}/5; rested ${d.sleep.rested ?? ''}/5; bathroom trips ${c ? c.trips : ''}; woke from pain ${d.sleep.pain || 0}; other ${d.sleep.other || 0}; ${(d.sleep.factors || []).join(', ')}`, d.sleep.note); }
    for (const x of d.naps || []) add(date, x.t, 'Nap', 'Nap', `${x.mins} min`, '', x.note);
    for (const b of d.bm || []) add(date, b.t, 'Bathroom', `Bristol type ${b.bristol ?? ''}`, '', `Blood: ${BLOOD[b.blood || 0]}; urgency: ${URGENCY[b.urgency || 0]}; pain ${b.pain || 0}/10${b.night ? '; at night' : ''}`, b.note);
    for (const x of d.meals || []) add(date, x.t, 'Meal', x.desc, x.portion, `${x.type}; carbs ${x.carbs ?? '–'}/10; protein ${x.protein ?? '–'}/10; fat ${x.fat ?? '–'}/10; fibre ${x.fiber ?? '–'}/10; tags: ${(x.tags || []).map(tagLabel).join(', ')}`, x.note);
    for (const x of d.doses || []) { const m = meds[x.medId]; add(date, x.t, m ? KINDS[m.kind] : 'Medicine', m ? m.name : x.name, x.amount != null ? `${x.amount} ${x.unit || ''}` : '', x.status === 'taken' ? `Taken${x.slot ? ` (scheduled ${x.slot})` : ''}${x.why ? `; for: ${x.why}` : ''}${x.site ? `; site: ${x.site}` : ''}` : `Skipped: ${x.reason || ''}`, x.note); }
    for (const x of d.exercise || []) add(date, x.t, 'Exercise', x.type, `${x.mins} min`, `${x.intensity}; steps ${x.steps ?? ''}; energy ${x.before ?? ''}→${x.after ?? ''}; symptoms: ${x.symptoms}`, x.note);
    if (d.checkin) { const c = d.checkin, sc = dayScore(d); add(date, c.t, 'Check-in', WELLBEING[c.wellbeing ?? 0], sc ? `${scoreDef().short} ${sc.score}` : '', `Belly pain ${c.pain}/10; tiredness ${c.fatigue}/10; stress ${c.stress ?? ''}/5; mood ${c.mood ?? ''}/5${c.tenesmus ? '; tenesmus' : ''}; ${(c.extra || []).map(id => (EXTRA.find(e => e.id === id) || {}).label).join(', ')}${c.weight ? `; weight ${c.weight} ${c.weightUnit || ''}` : ''}`, c.note); }
    if (d.period) add(date, '', 'Period', FLOW[d.period.flow || 0], '', (d.period.symptoms || []).join(', '), d.period.note);
    if (d.water) add(date, '', 'Water', 'Glasses', String(d.water), '', '');
  }
  const csvCell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const res = await saveFile(`track-your-ibd-${today()}.csv`, '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv');
  if (res === 'downloaded') toast('Spreadsheet saved to your Downloads folder');
}
function mergeDay(a, b) {
  const out = Object.assign(blankDay(b.date), clone(a || {}));
  for (const k of ['bm', 'meals', 'doses', 'exercise', 'naps']) {
    const map = new Map((out[k] || []).map(x => [x.id, x]));
    for (const x of b[k] || []) map.set(x.id, x);
    out[k] = [...map.values()];
  }
  out.sleep = out.sleep || b.sleep || null;
  out.checkin = out.checkin || b.checkin || null;
  out.period = out.period || b.period || null;
  out.water = Math.max(out.water || 0, b.water || 0);
  out.date = b.date; out.updatedAt = Date.now();
  return out;
}
async function importFile(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { toast("That file isn't a Track Your IBD backup."); return; }
  if (!data || !['ibd-tracker', 'uc-daybook'].includes(data.app) || !Array.isArray(data.days)) { toast("That file isn't a Track Your IBD backup."); return; }
  toast(`Restoring ${data.days.length} days…`);
  let n = 0;
  try {
    for (const m of data.meds || []) if (m && m.id && !R.meds[m.id]) { R.meds[m.id] = m; await Store.putNow('meds/' + m.id, m); }
    for (const d of data.days) {
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue;
      const merged = mergeDay(R.days[d.date], d);
      R.days[d.date] = merged;
      await Store.putNow('days/' + d.date, merged);
      n++;
    }
    const favs = (R.settings.favorites || []).concat((data.settings && data.settings.favorites) || []);
    R.settings.favorites = favs.filter((f, i) => favs.findIndex(g => g.desc === f.desc) === i).slice(-24);
    R.settings.started = true;
    if (!R.settings.condition && data.settings && data.settings.condition) R.settings.condition = data.settings.condition;
    if (!R.settings.condition && data.app === 'uc-daybook') R.settings.condition = 'uc';
    await Store.putNow('meta/settings', R.settings);
    toast(`Restored ${n} days and ${(data.meds || []).length} medicines`);
  } catch (e) { toast(`Restored ${n} days, then stopped. Try the restore again.`); }
  render();
}

/* ---------- actions ---------- */
function openNew(kind, date = S.date) {
  if (kind === 'bm') return sheetBm(date);
  if (kind === 'meal') return sheetMeal(date);
  if (kind === 'dose') return sheetDose(date);
  if (kind === 'ex') return sheetEx(date);
  if (kind === 'nap') return sheetNap(date);
  if (kind === 'checkin') return sheetCheckin(date);
  if (kind === 'period') return sheetPeriod(date);
  if (kind === 'sleep') {
    const pend = D().settings.sleepPending;
    if (pend && pend.date === date && !getDay(date).sleep) return A.awake();
    return sheetSleep(date);
  }
}
function setDate(d) { S.date = d > today() ? today() : d; S.followToday = S.date === today(); render(); }
const A = {
  noop() {},
  tab(el) { S.tab = el.dataset.tab; if (S.tab === 'today' && S.followToday) S.date = today(); render(); window.scrollTo(0, 0); },
  prevDay() { setDate(addDays(S.date, -1)); },
  nextDay() { setDate(addDays(S.date, 1)); },
  goToday() { setDate(today()); },
  new(el) { openNew(el.dataset.kind); },
  edit(el) {
    const k = el.dataset.kind, id = el.dataset.id, d = S.date;
    if (k === 'bm') sheetBm(d, findEntry(d, 'bm', id));
    else if (k === 'meal') sheetMeal(d, findEntry(d, 'meals', id));
    else if (k === 'ex') sheetEx(d, findEntry(d, 'exercise', id));
    else if (k === 'nap') sheetNap(d, findEntry(d, 'naps', id));
    else if (k === 'checkin') sheetCheckin(d);
    else if (k === 'period') sheetPeriod(d);
  },
  editSleep(el) { sheetSleep(el.dataset.date || S.date); },
  water(el) { const delta = Number(el.dataset.d); mutDay(S.date, d => { d.water = clamp((d.water || 0) + delta, 0, 40); }); },
  take(el) { takeDose(S.date, el.dataset.med, el.dataset.time); },
  takeAll(el) { takeAll(S.date, el.dataset.time); },
  doseMore(el) { sheetDose(S.date, { medId: el.dataset.med, slot: el.dataset.time }); },
  editDose(el) { const x = findEntry(S.date, 'doses', el.dataset.id); if (x) sheetDose(S.date, { dose: x }); },
  doseGroup(el) { sheetDoseGroup(S.date, el.dataset.ids.split(',')); },
  toBed() {
    const h = new Date().getHours();
    D().settings.sleepPending = { date: h >= 15 ? addDays(today(), 1) : today(), inBed: nowHM() };
    saveSettings(); render(); toast('Good night. Tap “I\'m awake” when you get up.');
  },
  cancelBed() { D().settings.sleepPending = null; saveSettings(); render(); },
  awake() {
    const pend = D().settings.sleepPending;
    if (!pend) return sheetSleep(S.date);
    const now = nowHM();
    sheetSleep(pend.date, { inBed: pend.inBed, asleep: fromMin(toMin(pend.inBed) + 15), wake: now, up: now });
  },
  addMed() { if (S.tab !== 'meds') { S.tab = 'meds'; render(); } sheetMed(); },
  editMed(el) { const m = D().meds[el.dataset.id]; if (m) sheetMed(m); },
  logMed(el) { sheetDose(today(), { medId: el.dataset.id }); },
  refill(el) { const m = D().meds[el.dataset.id]; if (m) sheetRefill(m); },
  restartMed(el) { const m = clone(D().meds[el.dataset.id]); if (!m) return; m.endDate = ''; saveMed(m); toast(`${m.name} is active again`); },
  stopMed() {
    const m = sheetCtx && D().meds[sheetCtx.medId];
    if (!m) return;
    const old = clone(m), x = clone(m);
    x.endDate = today();
    saveMed(x); closeSheet();
    toast(`Stopped ${m.name}`, 'Undo', () => saveMed(old));
  },
  preset(el) { applyPreset(el.closest('form'), PRESETS[Number(el.dataset.i)]); },
  addTime(el) {
    const box = el.closest('form').querySelector('[data-times]');
    const last = [...box.querySelectorAll('input')].map(i => i.value).filter(Boolean).sort().pop();
    box.insertAdjacentHTML('beforeend', timeRow(last ? fromMin(Math.min(toMin(last) + 720, 1380)) : '08:00'));
    sheetCtx && sheetCtx.onInput && sheetCtx.onInput(sheetCtx.form, null);
  },
  rmTime(el) {
    const box = el.closest('[data-times]');
    if (box.children.length > 1) el.closest('.time-row').remove();
    sheetCtx && sheetCtx.onInput && sheetCtx.onInput(sheetCtx.form, null);
  },
  useFav(el) {
    const f = (D().settings.favorites || [])[Number(el.dataset.i)], form = el.closest('form');
    if (!f || !form) return;
    form.elements.desc.value = f.desc;
    for (const c of form.querySelectorAll('input[name=tags]')) c.checked = (f.tags || []).includes(c.value);
    if (f.type) for (const r of form.querySelectorAll('input[name=type]')) r.checked = r.value === f.type;
    for (const [k] of MACROS) for (const r of form.querySelectorAll(`input[name="${k}"]`)) r.checked = Number(r.value) === f[k];
    const fav = form.querySelector('#f-fav'); if (fav) fav.closest('label').hidden = true;
  },
  rmFav(el) {
    const st = D().settings, list = (st.favorites || []).slice(), [gone] = list.splice(Number(el.dataset.i), 1);
    st.favorites = list;
    if (gone) st.favDismissed = (st.favDismissed || []).filter(k => k !== mealKey(gone.desc)).concat(mealKey(gone.desc)).slice(-200);
    saveSettings(); render();
  },
  rmDose(el) { removeEntry(S.date, 'doses', el.dataset.id, 'dose log'); },
  openDay(el) { S.date = el.dataset.date; S.followToday = S.date === today(); S.tab = 'today'; render(); window.scrollTo(0, 0); },
  month(el) {
    const [y, m] = S.histMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.d), 1);
    const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    if (ym <= today().slice(0, 7)) { S.histMonth = ym; render(); }
  },
  closeSheet() { closeSheet(); },
  sheetDelete(el) {
    if (!el.dataset.armed) {
      el.dataset.armed = '1'; el.classList.add('armed'); el.textContent = 'Tap again to delete';
      setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.classList.remove('armed'); el.textContent = 'Delete'; } }, 4000);
      return;
    }
    const fn = sheetCtx && sheetCtx.onDelete;
    closeSheet();
    if (fn) fn();
  },
  enterSample() { enterSample(); },
  startApp() {
    const f = $('#welcome-form'), c = f ? formVal(f, 'condition') : '';
    R.settings.condition = c || 'unsure'; R.settings.started = true;
    R.settings.trackCycle = !!(f && f.elements.trackCycle && f.elements.trackCycle.checked);
    saveSettings(); Store.checkPersist(true); S.tab = 'today'; S.date = today(); render();
  },
  trendRange(el) { S.trendDays = Number(el.dataset.n) || 30; render(); },
  snoozeBackup() { R.settings.backupSnooze = today(); saveSettings(); render(); },
  showInstall() { S.tab = 'more'; render(); window.scrollTo(0, 0); },
  hideInstallTip() { R.settings.installTipHidden = true; saveSettings(); render(); },
  async install() {
    if (!deferredInstall) return;
    deferredInstall.prompt();
    try { await deferredInstall.userChoice; } catch (e) { /* ignore */ }
    deferredInstall = null; render();
  },
  async deleteAll(el) {
    if (!el.dataset.armed) {
      el.dataset.armed = '1'; el.classList.add('armed'); el.textContent = 'Tap again to erase everything';
      setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.classList.remove('armed'); el.textContent = 'Delete everything on this device'; } }, 5000);
      return;
    }
    await Store.clearAll(); SAMPLE = null; S.tab = 'today'; S.date = today(); render(); toast('All data on this device was deleted');
  },
  clearRate(el) { for (const r of el.closest('form').querySelectorAll(`input[name="${el.dataset.k}"]`)) r.checked = false; },
  exitSample() { exitSample(); },
  exportJson() { exportJson(); },
  exportCsv() { exportCsv(); },
};

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el, e); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.type === 'range' && t.dataset.out) { const o = document.getElementById(t.dataset.out); if (o) o.textContent = t.value; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'f-import' && t.files && t.files[0]) { importFile(t.files[0]); t.value = ''; return; }
  if (t.form && t.form.id === 'settings-form') {
    const st = D().settings;
    if (t.name === 'condition') st.condition = t.value;
    if (t.name === 'trackCycle') st.trackCycle = t.checked;
    if (t.name === 'backupEvery') st.backupEvery = Number(t.value) || 7;
    if (t.name === 'waterGoal') st.waterGoal = clamp(Math.round(num(t.value) || 8), 1, 30);
    if (t.name === 'glassMl') st.glassMl = clamp(Math.round(num(t.value) || 250), 50, 1000);
    if (t.name === 'weightUnit') st.weightUnit = t.value === 'lb' ? 'lb' : 'kg';
    saveSettings(); toast('Settings saved');
    if (t.name === 'condition' || t.name === 'trackCycle') render();
  }
});
document.addEventListener('submit', e => { if (e.target.id === 'settings-form') e.preventDefault(); });
document.addEventListener('toggle', e => { const k = e.target.dataset && e.target.dataset.key; if (k) S.open[k] = e.target.open; }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheetCtx) closeSheet(); });

/* tooltip for calendar cells (mouse only) */
const tip = $('#tip');
document.addEventListener('pointerover', e => {
  const el = e.target.closest && e.target.closest('[data-tip]');
  if (!el || e.pointerType !== 'mouse') return;
  tip.textContent = el.dataset.tip; tip.hidden = false;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8) + 'px';
  tip.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + 'px';
});
document.addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && e.target.closest && e.target.closest('[data-tip]')) tip.hidden = true; });
document.addEventListener('pointerdown', e => {
  const el = e.target.closest && e.target.closest('.chart [data-tip]');
  if (!el || e.pointerType === 'mouse') return;
  tip.textContent = el.dataset.tip; tip.hidden = false;
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = clamp(r.left + r.width / 2 - w / 2, 8, window.innerWidth - w - 8) + 'px';
  tip.style.top = Math.max(8, r.top - h - 8) + 'px';
  clearTimeout(tip.t); tip.t = setTimeout(() => { tip.hidden = true; }, 2500);
});
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (S.tab === 'today' || !document.querySelector('.chart')) return; drawCharts(); }, 150); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') Store.flushAll();
  else if (S.followToday && S.date !== today()) { S.date = today(); render(); }
});
window.addEventListener('pagehide', () => Store.flushAll());

/* ---------- install + offline ---------- */
let deferredInstall = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (S.tab === 'more') render(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; Store.checkPersist(true); render(); });
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) toast('A new version of Track Your IBD is ready', 'Update', () => w.postMessage('skipWaiting'));
      });
    });
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; Store.flush().then(() => location.reload()); } });
}

/* ---------- boot ---------- */
render();
Store.init();
})();
