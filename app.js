const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = () => new Date().toISOString().slice(0, 10);
const fd = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('fa-IR') : '-';
const addDays = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const diff = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ---------- ذخیره‌سازی پایدار (IndexedDB + localStorage + درخواست ذخیره دائمی) ----------
let S = { logs: [], meds: [], labs: [], backupAt: null, ts: 0 };
const idb = () => new Promise((res, rej) => { const r = indexedDB.open('msapp', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
async function idbGet() { const db = await idb(); return new Promise(res => { const q = db.transaction('kv').objectStore('kv').get('data'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); }
async function idbSet(v) { const db = await idb(); return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, 'data'); t.oncomplete = () => res(true); t.onerror = () => res(false); }); }
async function load() {
  let a = null, b = null;
  try { a = await idbGet(); } catch {}
  try { b = JSON.parse(localStorage.getItem('ms_data') || 'null'); } catch {}
  const best = [a, b].filter(Boolean).sort((x, y) => (y.ts || 0) - (x.ts || 0))[0];
  if (best) S = Object.assign(S, best);
  try { if (navigator.storage && navigator.storage.persist) await navigator.storage.persist(); } catch {}
}
async function save() {
  S.ts = Date.now();
  try { localStorage.setItem('ms_data', JSON.stringify(S)); } catch {}
  try { await idbSet(S); } catch {}
}

// ---------- ناوبری ----------
const TABS = [['home', '🏠 خانه'], ['log', '✍️ ثبت علائم'], ['trend', '📈 تحلیل'], ['doc', '🩺 گزارش پزشک'], ['med', '💊 دارو و آزمایش'], ['bot', '🤖 مشاور'], ['bak', '💾 پشتیبان']];
$('nav').innerHTML = TABS.map(t => `<button data-t="${t[0]}" onclick="show('${t[0]}')">${t[1]}</button>`).join('');
function show(id) {
  document.querySelectorAll('.sec').forEach(s => s.classList.toggle('on', s.id === id));
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('on', b.dataset.t === id));
  ({ home: renderHome, log: renderLogs, trend: renderTrend, med: renderMeds, bak: renderBak }[id] || (() => {}))();
  window.scrollTo(0, 0);
}

// ---------- علائم ----------
function addLog() {
  const sym = $('lsym').value.trim(); if (!sym) return alert('نام علامت را بنویسید');
  S.logs.push({ id: uid(), date: $('ldate').value || iso(), sym, sev: +$('lsev').value, note: $('lnote').value.trim() });
  S.logs.sort((a, b) => b.date.localeCompare(a.date)); $('lsym').value = $('lnote').value = ''; save(); renderLogs();
}
function renderLogs() {
  $('ldate').value = $('ldate').value || iso();
  $('loglist').innerHTML = S.logs.length ? '<table><tr><th>تاریخ</th><th>علامت</th><th>شدت</th><th>توضیح</th><th></th></tr>' +
    S.logs.slice(0, 60).map(l => `<tr><td>${fd(l.date)}</td><td>${esc(l.sym)}</td><td>${l.sev}</td><td>${esc(l.note)}</td><td><button onclick="del('logs','${l.id}')">حذف</button></td></tr>`).join('') + '</table>' : 'هنوز چیزی ثبت نشده.';
}
function del(k, id) { if (confirm('حذف شود؟')) { S[k] = S[k].filter(x => x.id !== id); save(); renderLogs(); renderMeds(); renderHome(); } }

// ---------- تحلیل ----------
const avg = a => a.length ? a.reduce((s, x) => s + x.sev, 0) / a.length : null;
function window_(from, to) { const a = addDays(iso(), -from), b = addDays(iso(), -to); return S.logs.filter(l => l.date > b && l.date <= a); }
function trendInfo() { const r = window_(0, 14), p = window_(14, 28); return { a1: avg(r), a0: avg(p) }; }
function renderTrend() {
  const L = window_(0, 30);
  if (L.length < 2) { $('trendbox').innerHTML = 'برای تحلیل حداقل ۲ علامت ثبت کنید.'; return; }
  const { a1, a0 } = trendInfo();
  let t = 'داده کافی برای مقایسه با دو هفتهٔ قبل نیست.';
  if (a1 !== null && a0 !== null) t = a1 > a0 + 0.7 ? '📈 شدت علائم در ۱۴ روز اخیر بیشتر از ۱۴ روز قبل بوده. اگر ادامه دارد به پزشک اطلاع دهید.' : a1 < a0 - 0.7 ? '📉 شدت علائم نسبت به ۱۴ روز قبل کمتر شده.' : '➖ شدت علائم تقریبا ثابت بوده.';
  const g = {}; L.forEach(l => (g[l.sym] = g[l.sym] || []).push(l.sev));
  const rows = Object.entries(g).sort((a, b) => b[1].length - a[1].length);
  $('trendbox').innerHTML = `<p>میانگین شدت در ۳۰ روز گذشته: <b>${avg(L).toFixed(1)}</b> از ۱۰ (${L.length} ثبت)</p><p>${t}</p><h3>به تفکیک علامت</h3>` +
    rows.map(([s, v]) => { const m = v.reduce((x, y) => x + y, 0) / v.length; return `<div class="row" style="align-items:center;flex-wrap:nowrap"><span style="flex:0 0 120px">${esc(s)} (${v.length})</span><div style="flex:1"><div class="bar" style="width:${m * 10}%"></div></div><span style="flex:0 0 30px">${m.toFixed(1)}</span></div>`; }).join('') +
    '<p class="small">این تحلیل فقط بر پایه داده‌های ثبت‌شدهٔ خودتان است و تشخیص پزشکی نیست.</p>';
}

// ---------- دارو، تزریق و آزمایش ----------
function addMed() {
  if (!$('mname').value.trim()) return alert('نام دارو را وارد کنید');
  S.meds.push({ id: uid(), name: $('mname').value.trim(), type: $('mtype').value, dose: $('mdose').value.trim(), freq: +$('mfreq').value, last: $('mstart').value || iso() });
  $('mname').value = $('mdose').value = ''; save(); renderMeds();
}
function took(id) { const m = S.meds.find(x => x.id === id); m.last = iso(); save(); renderMeds(); renderHome(); }
function addLab() {
  if (!$('ltype').value.trim()) return alert('نوع آزمایش را بنویسید');
  S.labs.push({ id: uid(), type: $('ltype').value.trim(), date: $('ldt').value || iso(), next: $('lnext').value, note: $('lres').value.trim() });
  S.labs.sort((a, b) => b.date.localeCompare(a.date)); $('ltype').value = $('lres').value = $('lnext').value = ''; save(); renderMeds();
}
const FQ = { 1: 'هر روز', 2: 'یک روز در میان', 7: 'هفتگی', 14: 'هر دو هفته', 30: 'ماهانه', 182: 'هر ۶ ماه' };
const nextDue = m => addDays(m.last, m.freq);
function renderMeds() {
  $('mstart').value = $('mstart').value || iso(); $('ldt').value = $('ldt').value || iso();
  $('medlist').innerHTML = S.meds.length ? '<table><tr><th>دارو</th><th>نوع / دوز</th><th>تکرار</th><th>آخرین مصرف</th><th>نوبت بعد</th><th></th></tr>' + S.meds.map(m =>
    `<tr><td>${esc(m.name)}</td><td>${esc(m.type)} ${esc(m.dose)}</td><td>${FQ[m.freq]}</td><td>${fd(m.last)}</td><td>${fd(nextDue(m))}</td><td><button class="pr" onclick="took('${m.id}')">امروز مصرف شد</button> <button onclick="del('meds','${m.id}')">حذف</button></td></tr>`).join('') + '</table>' : 'دارویی ثبت نشده.';
  $('lablist').innerHTML = S.labs.length ? '<table><tr><th>نوع</th><th>تاریخ</th><th>موعد بعدی</th><th>یادداشت</th><th></th></tr>' + S.labs.map(l =>
    `<tr><td>${esc(l.type)}</td><td>${fd(l.date)}</td><td>${fd(l.next)}</td><td>${esc(l.note)}</td><td><button onclick="del('labs','${l.id}')">حذف</button></td></tr>`).join('') + '</table>' : 'آزمایشی ثبت نشده.';
}
function dueItems() {
  const it = [...S.meds.map(m => ({ t: m.name + ' ' + m.dose, d: nextDue(m) })), ...S.labs.filter(l => l.next).map(l => ({ t: l.type, d: l.next }))];
  return it.map(x => ({ ...x, n: diff(x.d, iso()) })).filter(x => x.n <= 14).sort((a, b) => a.n - b.n);
}

// ---------- خانه ----------
function renderHome() {
  const D = dueItems(), ba = S.backupAt ? diff(iso(), S.backupAt) : null, b = [];
  if (S.logs.length + S.meds.length + S.labs.length > 0 && (ba === null || ba > 14)) b.push('<div class="warn">💾 مدتی است پشتیبان نگرفته‌اید. از بخش «پشتیبان» فایل ذخیره کنید تا اطلاعاتتان از بین نرود.</div>');
  $('banners').innerHTML = b.join('');
  $('dueBox').innerHTML = D.length ? D.map(x => `<div class="${x.n <= 0 ? 'late' : ''}">${esc(x.t)} — ${x.n < 0 ? Math.abs(x.n) + ' روز دیرتر از موعد' : x.n === 0 ? 'امروز' : x.n + ' روز دیگر'} (${fd(x.d)})</div>`).join('') : 'موردی در ۱۴ روز آینده نیست.';
  $('recent').innerHTML = S.logs.length ? S.logs.slice(0, 5).map(l => `${fd(l.date)}: ${esc(l.sym)} (شدت ${l.sev})`).join('<br>') : 'هنوز علامتی ثبت نشده.';
}
let remindedKey = '';
setInterval(() => { const D = dueItems().filter(x => x.n <= 0), k = iso() + D.length; if (D.length && k !== remindedKey) { remindedKey = k; alert('⏰ موعد دارو/آزمایش:\n' + D.map(x => x.t).join('\n')); } }, 60000);

// ---------- گزارش پزشک ----------
function makeReport() {
  const d = +$('rdays').value, from = d > 9000 ? '0000-00-00' : addDays(iso(), -d);
  const L = S.logs.filter(l => l.date >= from).sort((a, b) => a.date.localeCompare(b.date)), B = S.labs.filter(l => l.date >= from);
  const g = {}; L.forEach(l => (g[l.sym] = g[l.sym] || []).push(l.sev));
  $('rbox').innerHTML = `<h2>گزارش وضعیت بیمار ام‌اس</h2><p>تاریخ گزارش: ${fd(iso())}</p><h3>خلاصه علائم</h3>` +
    (Object.keys(g).length ? '<table><tr><th>علامت</th><th>تعداد ثبت</th><th>میانگین شدت</th><th>بیشترین شدت</th></tr>' + Object.entries(g).map(([s, v]) => `<tr><td>${esc(s)}</td><td>${v.length}</td><td>${(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1)}</td><td>${Math.max(...v)}</td></tr>`).join('') + '</table>' : '<p>-</p>') +
    '<h3>داروها و تزریق‌ها</h3>' + (S.meds.length ? '<table><tr><th>دارو</th><th>نوع / دوز</th><th>تکرار</th><th>آخرین مصرف</th></tr>' + S.meds.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.type)} ${esc(m.dose)}</td><td>${FQ[m.freq]}</td><td>${fd(m.last)}</td></tr>`).join('') + '</table>' : '<p>-</p>') +
    '<h3>آزمایش و تصویربرداری</h3>' + (B.length ? '<table><tr><th>نوع</th><th>تاریخ</th><th>نتیجه</th></tr>' + B.map(l => `<tr><td>${esc(l.type)}</td><td>${fd(l.date)}</td><td>${esc(l.note)}</td></tr>`).join('') + '</table>' : '<p>-</p>') +
    '<h3>جزئیات روزانه</h3>' + (L.length ? '<table><tr><th>تاریخ</th><th>علامت</th><th>شدت</th><th>توضیح</th></tr>' + L.map(l => `<tr><td>${fd(l.date)}</td><td>${esc(l.sym)}</td><td>${l.sev}</td><td>${esc(l.note)}</td></tr>`).join('') + '</table>' : '<p>-</p>') +
    '<p class="small">این گزارش بر اساس اطلاعات واردشده توسط بیمار تهیه شده است.</p>';
}

// ---------- مشاور الگوریتمی (منطق در engine.js) ----------
const LV = { 3: ['🚨 اورژانس: همین حالا', 'l3'], 2: ['⚠️ مراجعه به پزشک در اولین فرصت', 'l2'], 1: ['ℹ️ در ویزیت بعدی به پزشک بگویید', 'l1'] };
const MS = { yes: 'این علامت می‌تواند به ام‌اس مربوط باشد.', maybe: 'این علامت ممکن است به ام‌اس مربوط باشد اما علل دیگری هم دارد.', no: 'این علامت معمولا مربوط به ام‌اس نیست و علت دیگری باید بررسی شود.' };
const CH = E.KB.filter(e => e.lv < 3);
$('chips').innerHTML = '<span class="small">یا یکی را انتخاب کنید: </span>' + CH.map((e, i) => `<button onclick="pick(${i})" style="margin:2px;padding:2px 9px;font-size:13px">${e.name}</button>`).join('');
let pend = null;
function bot(t, cls = '', btns) {
  const d = document.createElement('div'); d.className = 'msg bot ' + cls; d.textContent = t;
  if (btns) { const w = document.createElement('div'); w.style.marginTop = '8px'; btns.forEach(([l, f]) => { const b = document.createElement('button'); b.textContent = l; b.onclick = () => { w.remove(); f(); }; w.appendChild(b); w.appendChild(document.createTextNode(' ')); }); d.appendChild(w); }
  $('chatbox').appendChild(d); $('chatbox').scrollTop = 1e9;
}
function me(t) { const d = document.createElement('div'); d.className = 'msg me'; d.textContent = t; $('chatbox').appendChild(d); $('chatbox').scrollTop = 1e9; }
function startEntry(e, more) { pend = { e, i: 0, ans: [], more: more || [] }; if (e.lv === 3) return finish(); ask(); }
function pick(i) { me(CH[i].name); startEntry(CH[i]); }
function send() {
  const t = $('chatin').value.trim(); if (!t) return; $('chatin').value = ''; me(t); pend = null;
  const m = E.match(t);
  if (!m.length) return bot('این علامت را در پایگاه دانش خودم پیدا نکردم. دقیق‌تر بنویسید (کجای بدن، از کی، چقدر شدید) یا یکی از دکمه‌های بالا را انتخاب کنید. اگر علامت جدید، ناگهانی یا نگران‌کننده است منتظر پاسخ من نمانید و با پزشک خود تماس بگیرید.');
  startEntry(m[0], m.slice(1, 3).map(x => x.name));
}
function ask() {
  const q = pend.e.qs[pend.i]; if (!q) return finish();
  bot(`سؤال ${(pend.i + 1).toLocaleString("fa-IR")} از ${pend.e.qs.length.toLocaleString("fa-IR")} درباره «${pend.e.name}»:\n${q[0]}`, '', [['بله', () => ans(true)], ['خیر', () => ans(false)]]);
}
function ans(y) { me(y ? 'بله' : 'خیر'); pend.ans.push(y); pend.i++; E.level(pend.e, pend.ans) === 3 ? finish() : ask(); }
function finish() {
  const { e, more, ans: A } = pend; let lv = E.level(e, A), note = '';
  const { a1, a0 } = trendInfo();
  if (a1 !== null && a0 !== null && a1 > a0 + 1) { note = '\n\nتوجه: شدت علائمی که خودتان در ۱۴ روز اخیر ثبت کرده‌اید بالا رفته؛ این را هم به پزشک بگویید.'; if (lv === 1) lv = 2; }
  const l = LV[lv];
  bot(`${l[0]}\n\n${MS[e.ms]}\n${e.adv}${note}\n\nمنبع: ${e.src}${more.length ? '\nعلائم مرتبط دیگر: ' + more.join('، ') : ''}\n\nاین راهنما جایگزین پزشک نیست.`, l[1]);
  pend = null;
}
$('chatin').addEventListener('keydown', e => { if (e.key === 'Enter') send(); });

// ---------- پشتیبان ----------
function renderBak() { $('bakinfo').textContent = S.backupAt ? 'آخرین پشتیبان: ' + fd(S.backupAt) : 'هنوز پشتیبان نگرفته‌اید.'; }
function backup() {
  S.backupAt = iso(); save();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }));
  a.download = 'ms-backup-' + iso() + '.json'; a.click(); renderBak();
}
function restore(inp) {
  const f = inp.files[0]; if (!f) return; const r = new FileReader();
  r.onload = () => { try { const d = JSON.parse(r.result); if (!Array.isArray(d.logs) || !Array.isArray(d.meds)) throw 0; S = Object.assign({ logs: [], meds: [], labs: [], backupAt: null }, d); save(); alert('بازیابی شد'); show('home'); } catch { alert('فایل معتبر نیست'); } };
  r.readAsText(f);
}
function wipe() { if (confirm('همه اطلاعات برای همیشه پاک شود؟') && confirm('مطمئن هستید؟ این کار قابل بازگشت نیست.')) { S = { logs: [], meds: [], labs: [], backupAt: null, ts: 0 }; save(); show('home'); } }

// ---------- شروع ----------
bot('سلام! علامت یا مشکلتان را بنویسید تا بررسی کنم. اگر لازم باشد چند سؤال کوتاه هم می‌پرسم.');
load().then(() => show('home'));
