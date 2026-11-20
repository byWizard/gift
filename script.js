/* ============================================================
   ХОТЕЛКИ — script.js (ядро приложения)
   Вход: auth.js · Темы: theme.js · Админка: admin.js
   Настройки владельца: config.js
   ============================================================ */
(function () {
'use strict';

/* ================= 1. УТИЛИТЫ ================= */
const CFG = window.HotelkiConfig || {};
const SITE = CFG.siteName || 'Хотелки';
const EX = 'example';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const rid = n => Math.random().toString(36).slice(2, 2 + (n || 8));
const DAY = 86400000;
const RM = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)').matches : false;
const LS = {
  get(k, d) { try { const v = localStorage.getItem('hotelki.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hotelki.' + k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem('hotelki.' + k); } catch (e) {} }
};
const money = n => n == null ? '' : Number(n).toLocaleString('ru-RU') + ' ₽';
function nextDate(m, d, endOfDay) {
  const now = new Date(), y = now.getFullYear();
  const mk = yy => new Date(yy, m - 1, d, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0).getTime();
  let t = mk(y); if (t < now.getTime()) t = mk(y + 1);
  return t;
}
const fmtDate = ms => new Date(ms).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' }).replace(' г.', '');
function fmtShort(ms) {
  const d = new Date(ms), n = new Date();
  const o = { day:'numeric', month:'long' }; if (d.getFullYear() !== n.getFullYear()) o.year = 'numeric';
  return d.toLocaleDateString('ru-RU', o).replace(' г.', '');
}
const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0].toUpperCase()).join('');
function hueOf(s) { let h = 0; const t = String(s || ''); for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) % 360; return h; }
function safeLink(v) {
  if (!v) return ''; v = String(v).trim(); if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = 'https://' + v;
  try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; }
}
const TR = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya',' ':'-' };
const translit = s => String(s).toLowerCase().split('').map(c => TR[c] !== undefined ? TR[c] : c).join('')
  .replace(/[^a-z0-9-_]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 24);
function debounce(f, ms) { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => f.apply(null, a), ms); }; }
const shareUrl = pid => location.href.split('#')[0] + '#/u/' + pid;
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e2) {} ta.remove();
  }
  toast('Скопировано 📋');
}
function download(name, text, mime) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function imgFromFile(file) {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(file), i = new Image();
    i.onload = () => { URL.revokeObjectURL(u); res(i); };
    i.onerror = () => { URL.revokeObjectURL(u); rej(new Error('Не удалось прочитать картинку')); };
    i.src = u;
  });
}
async function fileToDataUrl(file, maxSide, maxChars) {
  if (!file || !file.type || file.type.indexOf('image/') !== 0) throw new Error('Нужен файл-картинка (jpg, png, webp)');
  let src;
  try { src = await createImageBitmap(file); } catch (e) { src = await imgFromFile(file); }
  const W = src.width, H = src.height;
  let side = maxSide, q = 0.85;
  for (let i = 0; i < 7; i++) {
    const r = Math.min(1, side / Math.max(W, H));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(W * r)); c.height = Math.max(1, Math.round(H * r));
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(src, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', q);
    if (url.length <= maxChars) return url;
    if (q > 0.55) q -= 0.12; else side = Math.round(side * 0.78);
  }
  throw new Error('Фото слишком большое даже после сжатия — возьмите другое');
}

/* ================= 2. СПРАВОЧНИКИ ================= */
const HOLIDAYS = {
  newyear:  { label:'Новый год',     emoji:'🎄', m:12, d:31, c1:'#123c2b', c2:'#1e6b4a' },
  birthday: { label:'День рождения', emoji:'🎂',             c1:'#5b2a86', c2:'#a4508b' },
  valentine:{ label:'14 Февраля',    emoji:'💘', m:2,  d:14, c1:'#8f1d4e', c2:'#e0447c' },
  feb23:    { label:'23 Февраля',    emoji:'🛡️', m:2,  d:23, c1:'#243b55', c2:'#5a7d4f' },
  march8:   { label:'8 Марта',       emoji:'🌷', m:3,  d:8,  c1:'#a12d5d', c2:'#e77aa0' },
  wedding:  { label:'Свадьба',       emoji:'💍', off:30,     c1:'#7a5c1e', c2:'#c9a24b' },
  just:     { label:'Просто так',    emoji:'🎁', off:30,     c1:'#0e5c4a', c2:'#2c8c6e' },
  custom:   { label:'Своя дата',     emoji:'📅', off:30,     c1:'#28407a', c2:'#4a6fb5' }
};
const HORDER = ['newyear','birthday','valentine','feb23','march8','wedding','just','custom'];
const SORTS = { manual:'Мой порядок', new:'Сначала новые', free:'Сначала свободные', cheap:'Сначала дешёвые', pricey:'Сначала дорогие', az:'По алфавиту' };
const RULES = [
  "rules_version = '2';",
  "service cloud.firestore {",
  "  match /databases/{database}/documents {",
  "    match /profiles/{pid} {",
  "      allow read: if true;",
  "      allow create: if request.auth != null && request.resource.data.ownerUid == request.auth.uid;",
  "      allow update, delete: if request.auth != null && resource.data.ownerUid == request.auth.uid;",
  "      match /gifts/{gid} {",
  "        allow read: if true;",
  "        allow create, delete: if request.auth != null &&",
  "          get(/databases/$(database)/documents/profiles/$(pid)).data.ownerUid == request.auth.uid;",
  "        allow update: if request.auth != null && (",
  "          get(/databases/$(database)/documents/profiles/$(pid)).data.ownerUid == request.auth.uid ||",
  "          (request.resource.data.diff(resource.data).affectedKeys()",
  "             .hasOnly(['reservedBy','reservedByName','reservedAt','reservedUntil'])",
  "           && (request.resource.data.reservedBy == request.auth.uid",
  "               || request.resource.data.reservedBy == null))",
  "        );",
  "      }",
  "    }",
  "  }",
  "}"
].join('\n');
const isReserved = g => !!g.reservedBy && (g.reservedUntil || 0) > Date.now();
function reserveUntil(g, profile) {
  const h = HOLIDAYS[g.holiday] || HOLIDAYS.just;
  if (g.holiday === 'birthday' && profile && profile.birthday) { const p = profile.birthday.split('-'); return nextDate(+p[1], +p[2], true); }
  if (g.holiday === 'custom' && g.customDate) { const t = new Date(g.customDate + 'T23:59:59').getTime(); if (t > Date.now()) return t; }
  if (h.m) return nextDate(h.m, h.d, true);
  return Date.now() + (h.off || 30) * DAY;
}
function giftDoc(d) {
  return {
    title:d.title, description:d.description || '', link:d.link || '',
    price:d.price == null ? null : d.price, holiday:d.holiday || 'just',
    customDate:d.customDate || null, dream:!!d.dream, photo:d.photo || null,
    order:d.order == null ? Date.now() : d.order, createdAt:d.createdAt || Date.now(),
    reservedBy:d.reservedBy || null, reservedByName:d.reservedByName || null,
    reservedAt:d.reservedAt || null, reservedUntil:d.reservedUntil || null
  };
}

/* ================= 3. ИКОНКИ И АРТ ================= */
const PATHS = {
  gift:'<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5" rx="1"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  search:'<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/>',
  x:'<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  pen:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash:'<path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  ext:'<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
  copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
  sliders:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
  vol:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/>',
  volx:'<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>',
  cloud:'<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>',
  dl:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  ul:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>',
  grip:'<circle cx="9" cy="6" r="1.4"/><circle cx="15" cy="6" r="1.4"/><circle cx="9" cy="12" r="1.4"/><circle cx="15" cy="12" r="1.4"/><circle cx="9" cy="18" r="1.4"/><circle cx="15" cy="18" r="1.4"/>',
  cl:'<polyline points="15 18 9 12 15 6"/>', cr:'<polyline points="9 18 15 12 9 6"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  mark:'<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  eye:'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  alert:'<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  info:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  home:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  spark:'<path d="M12 3l1.9 5.6L20 10.5l-5.6 1.9L12 18l-2.4-5.6L4 10.5l6.1-1.9Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8Z"/>',
  sun:'<circle cx="12" cy="12" r="4.2"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.6" y1="4.6" x2="6.4" y2="6.4"/><line x1="17.6" y1="17.6" x2="19.4" y2="19.4"/><line x1="4.6" y1="19.4" x2="6.4" y2="17.6"/><line x1="17.6" y1="6.4" x2="19.4" y2="4.6"/>',
  moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  out:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7L12 19"/>'
};
function icon(n, s) {
  s = s || 18;
  return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[n] || PATHS.gift) + '</svg>';
}
const svgUri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s);
const ART = {
  head: svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#e7ebff'/><circle cx='332' cy='52' r='78' fill='#c7d2fe' opacity='.55'/><circle cx='58' cy='250' r='60' fill='#c7d2fe' opacity='.4'/><ellipse cx='200' cy='256' rx='118' ry='15' fill='#312e81' opacity='.14'/><path d='M118 196v-34a82 82 0 0 1 164 0v34' fill='none' stroke='#312e81' stroke-width='17' stroke-linecap='round'/><rect x='99' y='180' width='40' height='70' rx='18' fill='#4338ca'/><rect x='261' y='180' width='40' height='70' rx='18' fill='#4338ca'/><rect x='108' y='190' width='22' height='50' rx='11' fill='#818cf8'/><rect x='270' y='190' width='22' height='50' rx='11' fill='#818cf8'/><circle cx='200' cy='84' r='6' fill='#f59e0b'/></svg>"),
  watch: svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#dff3f0'/><circle cx='60' cy='60' r='70' fill='#99f6e4' opacity='.5'/><circle cx='344' cy='240' r='66' fill='#99f6e4' opacity='.4'/><ellipse cx='200' cy='262' rx='100' ry='13' fill='#134e4a' opacity='.14'/><rect x='168' y='34' width='64' height='230' rx='30' fill='#0f766e'/><rect x='258' y='136' width='12' height='28' rx='6' fill='#0f766e'/><rect x='142' y='94' width='116' height='118' rx='30' fill='#134e4a'/><rect x='154' y='106' width='92' height='94' rx='22' fill='#99f6e4'/><path d='M200 128v26l18 12' fill='none' stroke='#134e4a' stroke-width='8' stroke-linecap='round'/><circle cx='200' cy='154' r='5' fill='#134e4a'/></svg>"),
  pad: svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#e3e9f4'/><circle cx='330' cy='60' r='66' fill='#c3cfe2' opacity='.6'/><circle cx='66' cy='240' r='54' fill='#c3cfe2' opacity='.5'/><ellipse cx='200' cy='240' rx='130' ry='14' fill='#334155' opacity='.15'/><rect x='90' y='116' width='220' height='100' rx='50' fill='#334155'/><path d='M146 142h18v16h16v18h-16v16h-18v-16h-16v-18h16z' fill='#cbd5e1'/><circle cx='262' cy='146' r='10' fill='#f87171'/><circle cx='286' cy='166' r='10' fill='#fbbf24'/><circle cx='238' cy='166' r='10' fill='#34d399'/><circle cx='262' cy='186' r='10' fill='#60a5fa'/><circle cx='200' cy='140' r='7' fill='#94a3b8'/></svg>"),
  cam: svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#f6e8d8'/><circle cx='58' cy='64' r='60' fill='#ecd3b3' opacity='.7'/><circle cx='348' cy='230' r='70' fill='#ecd3b3' opacity='.6'/><ellipse cx='200' cy='248' rx='126' ry='14' fill='#6b4423' opacity='.16'/><rect x='120' y='86' width='72' height='30' rx='8' fill='#6b4423'/><rect x='96' y='106' width='208' height='124' rx='20' fill='#8a5a2b'/><rect x='96' y='140' width='208' height='58' fill='#6b4423'/><circle cx='216' cy='168' r='46' fill='#3f2d1d'/><circle cx='216' cy='168' r='33' fill='#1c1917'/><circle cx='216' cy='168' r='18' fill='#4c1d95' opacity='.85'/><circle cx='206' cy='158' r='7' fill='#fff' opacity='.75'/><circle cx='282' cy='122' r='9' fill='#f59e0b'/><rect x='134' y='118' width='30' height='17' rx='4' fill='#f6e8d8' opacity='.9'/></svg>"),
  coffee: svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#f7e9dc'/><circle cx='340' cy='58' r='64' fill='#eed6bd' opacity='.8'/><circle cx='56' cy='236' r='58' fill='#eed6bd' opacity='.7'/><ellipse cx='200' cy='256' rx='96' ry='12' fill='#78350f' opacity='.16'/><path d='M186 58q7-13 0-24M214 62q9-13 2-26' fill='none' stroke='#b45309' stroke-width='5' stroke-linecap='round' opacity='.5'/><circle cx='200' cy='78' r='9' fill='#78350f'/><rect x='160' y='84' width='80' height='14' rx='7' fill='#92400e'/><path d='M164 98h72l8 62h-88z' fill='#d97706'/><path d='M244 108q42 10 24 54l-16-6q10-28-14-36z' fill='#78350f'/><rect x='152' y='158' width='96' height='13' rx='6' fill='#92400e'/><path d='M158 171h84l-12 76h-60z' fill='#b45309'/></svg>"),
  thermo: svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#e4f0e2'/><circle cx='66' cy='66' r='62' fill='#c9e2c4' opacity='.8'/><circle cx='340' cy='232' r='68' fill='#c9e2c4' opacity='.7'/><ellipse cx='200' cy='258' rx='84' ry='11' fill='#1d4a2a' opacity='.16'/><rect x='166' y='54' width='68' height='32' rx='12' fill='#1d4a2a'/><rect x='160' y='78' width='80' height='168' rx='26' fill='#2f6b3f'/><rect x='160' y='150' width='80' height='26' fill='#f2c14e'/><circle cx='200' cy='120' r='12' fill='#e4f0e2' opacity='.85'/><rect x='166' y='236' width='68' height='12' rx='6' fill='#1d4a2a'/></svg>"),
  book: svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect width='400' height='300' fill='#f3e3e3'/><circle cx='338' cy='60' r='64' fill='#e7c9c9' opacity='.7'/><circle cx='60' cy='238' r='56' fill='#e7c9c9' opacity='.6'/><ellipse cx='202' cy='244' rx='118' ry='13' fill='#7f1d1d' opacity='.14'/><rect x='120' y='198' width='170' height='26' rx='6' fill='#7f1d1d'/><rect x='132' y='170' width='150' height='26' rx='6' fill='#b45309'/><rect x='126' y='142' width='158' height='26' rx='6' fill='#9f1239'/><rect x='138' y='96' width='140' height='44' rx='8' fill='#881337'/><rect x='152' y='108' width='84' height='7' rx='3.5' fill='#fda4af'/><rect x='152' y='122' width='56' height='5' rx='2.5' fill='#fda4af' opacity='.7'/><path d='M254 96v36l-9-7-9 7V96z' fill='#f2c14e'/></svg>"),
  ava: svgUri("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop stop-color='#0e7a5c'/><stop offset='1' stop-color='#bf8712'/></linearGradient></defs><rect width='96' height='96' fill='url(#g)'/><text x='48' y='61' font-family='Georgia,serif' font-size='34' font-weight='700' fill='#fff' text-anchor='middle'>АЗ</text></svg>")
};

/* ================= 4. ЛОКАЛЬНАЯ БАЗА + ПРИМЕР ================= */
function seedExample() {
  const now = Date.now(), oz = q => 'https://www.ozon.ru/search/?text=' + encodeURIComponent(q);
  const mk = (i, o) => Object.assign({ id:'eg' + i, order:i, createdAt: now - (7 - i) * DAY,
    reservedBy:null, reservedByName:null, reservedAt:null, reservedUntil:null }, o);
  const list = [
    mk(0,{ title:'Наушники с шумоподавлением', description:'Беспроводные, лучше Sony WH-1000XM5 или похожие. Цвет — чёрный или графит.', link:oz('наушники с шумоподавлением'), price:7990, holiday:'newyear', dream:true, photo:ART.head }),
    mk(1,{ title:'Умные часы', description:'Garmin или Apple Watch SE. Главное — пульс, сон и батарея на неделю.', link:oz('умные часы garmin'), price:12990, holiday:'newyear', photo:ART.watch,
      reservedBy:'example-marina', reservedByName:'Марина', reservedAt: now - 2 * DAY, reservedUntil: nextDate(12, 31, true) }),
    mk(2,{ title:'Геймпад для ПК', description:'Беспроводной, Xbox-раскладка — чтобы работал из коробки.', link:oz('геймпад xbox беспроводной'), price:5490, holiday:'newyear', photo:ART.pad }),
    mk(3,{ title:'Плёночный фотоаппарат', description:'Мечтаю снимать на плёнку. Olympus Trip 35 или Canonet, можно б/у в хорошем состоянии.', link:oz('плёночный фотоаппарат olympus'), price:15900, holiday:'birthday', dream:true, photo:ART.cam }),
    mk(4,{ title:'Гейзерная кофеварка', description:'Bialetti на 4 чашки — классика. Плита газовая, индукция не нужна.', link:oz('гейзерная кофеварка bialetti'), price:3290, holiday:'birthday', photo:ART.coffee }),
    mk(5,{ title:'Термокружка 0.5 л', description:'Держит тепло часов шесть и не протекает в рюкзаке. Цвет любой тёмный.', link:oz('термокружка 0.5 л'), price:1490, holiday:'feb23', photo:ART.thermo }),
    mk(6,{ title:'«Мастер и Маргарита», иллюстрированное издание', description:'Твёрдый переплёт, с картинками. Хочу перечитать и поставить на полку.', link:oz('мастер и маргарита иллюстрированное издание'), price:1190, holiday:'just', photo:ART.book })
  ];
  const map = {}; list.forEach(g => { map[g.id] = g; });
  return {
    profile: { id:EX, name:'Алексей Зимин', bio:'Люблю технику, кофе и толстые книги. Носки и гели для душа — мимо 😄', birthday:'1994-04-12', avatar:ART.ava, ownerUid:'example-owner', createdAt: now - 30 * DAY },
    gifts: map
  };
}
let L = LS.get('db', null) || { profiles:{}, gifts:{} };
if (!L.profiles) L.profiles = {};
if (!L.gifts) L.gifts = {};
if (!L.profiles[EX]) { const s = seedExample(); L.profiles[EX] = s.profile; L.gifts[EX] = s.gifts; }
LS.set('db', L);
if (!LS.get('uid', null)) LS.set('uid', 'u-' + rid(10));
/* перенос старых записей о бронях */
(function () {
  const r = LS.get('res', null);
  if (Array.isArray(r)) LS.set('res', r.map(e => ({ pid: e.pid === 'demo' ? EX : e.pid, gid: e.gid, mode: e.mode === 'live' ? 'cloud' : (e.mode === 'demo' ? 'local' : e.mode), at: e.at })));
})();

const subs = [];
const localGifts = pid => Object.keys(L.gifts[pid] || {}).map(k => clone(L.gifts[pid][k]));
function notifyLocal() {
  subs.forEach(s => { if (s.type === 'gifts') s.cb(localGifts(s.pid)); else s.cb(L.profiles[s.pid] ? clone(L.profiles[s.pid]) : null); });
}
function persist() { LS.set('db', L); notifyLocal(); }
const Local = {
  uid: () => LS.get('uid', 'u-local'),
  _all: () => L.profiles,
  async getProfile(pid) { return L.profiles[pid] ? clone(L.profiles[pid]) : null; },
  async findMyProfile() { const pid = LS.get('myPid', null); return pid && L.profiles[pid] && L.profiles[pid].ownerUid === Local.uid() ? pid : null; },
  async createProfile(pid, data) {
    if (L.profiles[pid]) { const e = new Error('slug-taken'); e.code = 'slug-taken'; throw e; }
    L.profiles[pid] = Object.assign({ id: pid, createdAt: Date.now() }, data); persist();
  },
  async updateProfile(pid, patch) { Object.assign(L.profiles[pid], patch); persist(); },
  async gifts(pid) { return localGifts(pid); },
  async getGift(pid, gid) { return L.gifts[pid] && L.gifts[pid][gid] ? clone(L.gifts[pid][gid]) : null; },
  watchGifts(pid, cb) { const s = { pid, cb, type:'gifts' }; subs.push(s); cb(localGifts(pid)); return () => { const i = subs.indexOf(s); if (i > -1) subs.splice(i, 1); }; },
  watchProfile(pid, cb) { const s = { pid, cb, type:'profile' }; subs.push(s); cb(L.profiles[pid] ? clone(L.profiles[pid]) : null); return () => { const i = subs.indexOf(s); if (i > -1) subs.splice(i, 1); }; },
  async addGift(pid, g) { if (!L.gifts[pid]) L.gifts[pid] = {}; L.gifts[pid][g.id] = clone(g); persist(); },
  async updateGift(pid, gid, patch) { if (L.gifts[pid] && L.gifts[pid][gid]) Object.assign(L.gifts[pid][gid], clone(patch)); persist(); },
  async deleteGift(pid, gid) { if (L.gifts[pid]) delete L.gifts[pid][gid]; persist(); },
  async restoreGift(pid, g) { if (!L.gifts[pid]) L.gifts[pid] = {}; L.gifts[pid][g.id] = clone(g); persist(); },
  async reorder(pid, ids) { ids.forEach((id, i) => { if (L.gifts[pid] && L.gifts[pid][id]) L.gifts[pid][id].order = i; }); persist(); },
  async reserve(pid, gid, o) {
    const g = L.gifts[pid] && L.gifts[pid][gid];
    if (!g) { const e = new Error('not-found'); e.code = 'not-found'; throw e; }
    if (g.reservedBy && g.reservedBy !== o.by && (g.reservedUntil || 0) > Date.now()) { const e = new Error('already-reserved'); e.code = 'already-reserved'; throw e; }
    g.reservedBy = o.by; g.reservedByName = o.name; g.reservedAt = Date.now(); g.reservedUntil = o.until; persist();
  },
  async release(pid, gid, by) {
    const g = L.gifts[pid] && L.gifts[pid][gid]; if (!g) return;
    if (g.reservedBy && g.reservedBy !== by) { const e = new Error('not-yours'); e.code = 'not-yours'; throw e; }
    g.reservedBy = null; g.reservedByName = null; g.reservedAt = null; g.reservedUntil = null; persist();
  }
};

/* ================= 5. ОБЛАЧНАЯ БАЗА ================= */
const FS = () => window.Auth.fs();
const pRef = pid => FS().collection('profiles').doc(pid);
const gRef = (pid, gid) => FS().collection('profiles').doc(pid).collection('gifts').doc(gid);
function err(code) { const e = new Error(code); e.code = code; return e; }
const Live = {
  uid: () => window.Auth.uid(),
  async getProfile(pid) { const s = await pRef(pid).get(); return s.exists ? Object.assign({ id: pid }, s.data()) : null; },
  async findMyProfile() {
    const uid = window.Auth.uid(); if (!uid) return null;
    const cached = LS.get('myPid.live', null);
    if (cached) { const s = await pRef(cached).get(); if (s.exists && s.data().ownerUid === uid) return cached; }
    const r = await FS().collection('profiles').where('ownerUid', '==', uid).limit(1).get();
    if (!r.empty) { LS.set('myPid.live', r.docs[0].id); return r.docs[0].id; }
    return null;
  },
  async createProfile(pid, data) {
    await FS().runTransaction(async tx => {
      const s = await tx.get(pRef(pid));
      if (s.exists) throw err('slug-taken');
      tx.set(pRef(pid), Object.assign({ createdAt: Date.now() }, data));
    });
    LS.set('myPid.live', pid);
  },
  async updateProfile(pid, patch) { await pRef(pid).update(clone(patch)); },
  async gifts(pid) { const r = await pRef(pid).collection('gifts').get(); return r.docs.map(d => Object.assign({ id: d.id }, d.data())); },
  async getGift(pid, gid) { const s = await gRef(pid, gid).get(); return s.exists ? Object.assign({ id: gid }, s.data()) : null; },
  watchGifts(pid, cb) {
    let warned = false;
    return pRef(pid).collection('gifts').onSnapshot(
      s => cb(s.docs.map(d => Object.assign({ id: d.id }, d.data()))),
      e => { if (!warned) { warned = true; toast(friendly(e), { type:'err' }); } }
    );
  },
  watchProfile(pid, cb) { return pRef(pid).onSnapshot(s => cb(s.exists ? Object.assign({ id: pid }, s.data()) : null), () => {}); },
  async addGift(pid, g) { await gRef(pid, g.id).set(giftDoc(g)); },
  async updateGift(pid, gid, patch) { await gRef(pid, gid).update(clone(patch)); },
  async deleteGift(pid, gid) { await gRef(pid, gid).delete(); },
  async restoreGift(pid, g) { await gRef(pid, g.id).set(giftDoc(g)); },
  async reorder(pid, ids) { const b = FS().batch(); ids.forEach((id, i) => b.update(gRef(pid, id), { order: i })); await b.commit(); },
  async reserve(pid, gid, o) {
    await FS().runTransaction(async tx => {
      const s = await tx.get(gRef(pid, gid));
      if (!s.exists) throw err('not-found');
      const g = s.data();
      if (g.reservedBy && g.reservedBy !== o.by && (g.reservedUntil || 0) > Date.now()) throw err('already-reserved');
      tx.update(gRef(pid, gid), { reservedBy:o.by, reservedByName:o.name, reservedAt:Date.now(), reservedUntil:o.until });
    });
  },
  async release(pid, gid, by) {
    await FS().runTransaction(async tx => {
      const s = await tx.get(gRef(pid, gid));
      if (!s.exists) throw err('not-found');
      const g = s.data();
      if (g.reservedBy && g.reservedBy !== by) throw err('not-yours');
      tx.update(gRef(pid, gid), { reservedBy:null, reservedByName:null, reservedAt:null, reservedUntil:null });
    });
  }
};
function friendly(e) {
  const c = String((e && (e.code || e.message)) || '');
  if (c.indexOf('slug-taken') > -1) return 'Такой адрес ссылки уже занят — придумайте другой';
  if (c.indexOf('already-reserved') > -1) return 'Кто-то успел раньше 😅 Подарок уже забронирован';
  if (c.indexOf('not-yours') > -1) return 'Эту бронь может снять только тот, кто её поставил';
  if (c.indexOf('permission-denied') > -1 || c.indexOf('insufficient permissions') > -1) return 'База отклонила запрос — владельцу нужно обновить правила (панель #/admin)';
  if (c.indexOf('unavailable') > -1 || c.indexOf('network') > -1) return 'Нет связи с интернетом';
  if (c.indexOf('not-found') > -1) return 'Не найдено — возможно, уже удалено';
  if (window.Auth && (c.indexOf('auth/') > -1 || c.indexOf('unauthorized-domain') > -1)) return window.Auth.friendly(e);
  return (e && e.message) || 'Неизвестная ошибка';
}
const db = pid => (window.Auth.online() && pid !== EX) ? Live : Local;
const myUid = () => window.Auth.uid();
const modeOf = pid => (window.Auth.online() && pid !== EX) ? 'cloud' : 'local';

/* ================= 6. СОСТОЯНИЕ ================= */
const S = { route:{ name:'home' }, myPid:null, myProfile:null, profile:null, gifts:[], q:'', filterH:'all', sort:'manual', resData:[] };
let token = 0, cleanups = [], lastFocus = null, confirmCb = null;
let formPhoto = null, formAvatar = null, cdTimer = 0, dragId = null, menuOpen = false;
const onClean = f => cleanups.push(f);

/* ================= 7. ЗВУК / ЧАСТИЦЫ / КОНФЕТТИ ================= */
const SND = {
  ctx:null, on: LS.get('sound', '1') !== '0',
  ensure() {
    if (!this.ctx) { try { const A = window.AudioContext || window.webkitAudioContext; if (A) this.ctx = new A(); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(f, t, d, type, g) {
    const c = this.ctx, o = c.createOscillator(), v = c.createGain();
    o.type = type; o.frequency.value = f;
    v.gain.setValueAtTime(0.0001, t);
    v.gain.exponentialRampToValueAtTime(g, t + 0.02);
    v.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(v); v.connect(c.destination); o.start(t); o.stop(t + d + 0.05);
  },
  play(n) {
    if (!this.on) return; this.ensure(); if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    if (n === 'ok') [523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, t + i * 0.09, 0.4, 'sine', 0.09));
    else if (n === 'pop') { this.tone(880, t, 0.12, 'triangle', 0.08); this.tone(1318.5, t + 0.06, 0.16, 'triangle', 0.06); }
    else if (n === 'del') { this.tone(392, t, 0.12, 'triangle', 0.07); this.tone(261.6, t + 0.08, 0.2, 'triangle', 0.06); }
    else if (n === 'err') this.tone(196, t, 0.22, 'square', 0.05);
  }
};
const FX = {
  c:null, x:null, ps:[], raf:0, W:0, H:0, style:'business', col:{ a:'#fff', b:'#fff', op:.6 },
  init() {
    this.c = $('#fx'); this.x = this.c.getContext('2d'); this.resize(); this.sync();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); else this.start(); });
    this.start();
  },
  resize() {
    const d = Math.min(window.devicePixelRatio || 1, 1.5);
    this.W = innerWidth; this.H = innerHeight;
    this.c.width = this.W * d; this.c.height = this.H * d;
    this.x.setTransform(d, 0, 0, d, 0, 0);
  },
  sync() {
    this.style = window.Theme.style();
    this.col = window.Theme.fx();
    const n = RM ? 0 : this.style === 'newyear' ? 70 : this.style === 'love' ? 26 : this.style === 'spring' ? 30 : 22;
    this.ps = []; for (let i = 0; i < n; i++) this.ps.push(this.spawn(true));
  },
  spawn(any) {
    const t = this.style, r = Math.random;
    return { x:r() * this.W, y: any ? r() * this.H : (t === 'business' ? this.H + 10 : -14),
      s: t === 'newyear' ? 1.4 + r() * 2.4 : t === 'business' ? 1 + r() * 1.6 : 5 + r() * 7,
      v: t === 'newyear' ? 0.35 + r() * 0.8 : t === 'business' ? -(0.06 + r() * 0.14) : 0.3 + r() * 0.55,
      sw:r() * 6.28, rot:r() * 6.28, vr:(r() - 0.5) * 0.03, a:0.3 + r() * 0.7, hue:r() };
  },
  start() { if (this.raf || RM) return; const loop = () => { this.raf = requestAnimationFrame(loop); this.draw(); }; this.raf = requestAnimationFrame(loop); },
  stop() { cancelAnimationFrame(this.raf); this.raf = 0; },
  draw() {
    const x = this.x, t = this.style, op = this.col.op;
    x.clearRect(0, 0, this.W, this.H);
    for (let i = 0; i < this.ps.length; i++) {
      const p = this.ps[i];
      p.sw += 0.012; p.y += p.v; p.x += Math.sin(p.sw) * 0.4 + (t === 'spring' ? 0.25 : 0); p.rot += p.vr;
      if (p.y > this.H + 16 || p.y < -20 || p.x > this.W + 20) { this.ps[i] = this.spawn(false); continue; }
      x.save(); x.translate(p.x, p.y); x.globalAlpha = p.a * op;
      x.fillStyle = p.hue > 0.5 ? this.col.a : this.col.b;
      if (t === 'newyear' || t === 'business') { x.beginPath(); x.arc(0, 0, p.s, 0, 6.283); x.fill(); }
      else if (t === 'love') {
        x.rotate(Math.sin(p.sw) * 0.3);
        const s = p.s; x.beginPath(); x.moveTo(0, s * 0.3);
        x.bezierCurveTo(-s * 0.55, -s * 0.3, -s * 1.1, s * 0.3, 0, s);
        x.bezierCurveTo(s * 1.1, s * 0.3, s * 0.55, -s * 0.3, 0, s * 0.3); x.fill();
      } else { x.rotate(p.rot); x.beginPath(); x.ellipse(0, 0, p.s, p.s * 0.45, 0, 0, 6.283); x.fill(); }
      x.restore();
    }
  }
};
const CF = {
  c:null, x:null, ps:[], raf:0,
  init() {
    this.c = $('#confetti'); this.x = this.c.getContext('2d');
    const rs = () => { const d = Math.min(window.devicePixelRatio || 1, 1.5); this.c.width = innerWidth * d; this.c.height = innerHeight * d; this.x.setTransform(d, 0, 0, d, 0, 0); };
    rs(); window.addEventListener('resize', rs);
  },
  burst(cx, cy) {
    if (RM) return;
    const cs = getComputedStyle(document.documentElement);
    const cols = ['--acc','--acc2','--ok','--info'].map(v => cs.getPropertyValue(v).trim()).concat('#ffffff');
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * 6.283, v = 4 + Math.random() * 7;
      this.ps.push({ x:cx, y:cy, vx:Math.cos(a) * v, vy:Math.sin(a) * v - 5, g:0.26,
        rot:Math.random() * 6.283, vr:(Math.random() - 0.5) * 0.3, w:5 + Math.random() * 5, h:7 + Math.random() * 7,
        c:cols[i % cols.length], life:80 + Math.random() * 40 });
    }
    if (this.raf) return;
    const loop = () => {
      this.x.clearRect(0, 0, innerWidth, innerHeight);
      this.ps = this.ps.filter(p => p.life > 0 && p.y < innerHeight + 40);
      this.ps.forEach(p => {
        p.life--; p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.985; p.rot += p.vr;
        this.x.save(); this.x.translate(p.x, p.y); this.x.rotate(p.rot);
        this.x.globalAlpha = Math.min(1, p.life / 30); this.x.fillStyle = p.c;
        this.x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); this.x.restore();
      });
      if (this.ps.length) this.raf = requestAnimationFrame(loop);
      else { this.raf = 0; this.x.clearRect(0, 0, innerWidth, innerHeight); }
    };
    this.raf = requestAnimationFrame(loop);
  }
};

/* ================= 8. ТОСТЫ / МОДАЛКИ ================= */
function toast(msg, opt) {
  opt = opt || {};
  const type = opt.type || 'ok', dur = opt.dur || 4200, root = $('#toasts');
  while (root.children.length > 3) root.removeChild(root.firstChild);
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.style.setProperty('--dur', dur + 'ms');
  el.innerHTML = '<span class="ti">' + icon(type === 'ok' ? 'check' : type === 'err' ? 'alert' : 'info', 19) + '</span>' +
    '<span class="tm">' + esc(msg) + '</span>' +
    (opt.action ? '<button class="ta">' + esc(opt.action.label) + '</button>' : '') +
    '<button class="tx" aria-label="Закрыть">' + icon('x', 15) + '</button>';
  const kill = () => { el.classList.add('out'); setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 260); };
  const t = setTimeout(kill, dur);
  el.querySelector('.tx').onclick = () => { clearTimeout(t); kill(); };
  if (opt.action) el.querySelector('.ta').onclick = () => { clearTimeout(t); kill(); opt.action.fn(); };
  root.appendChild(el);
}
const lockUpdate = () => document.body.classList.toggle('locked', !!$('#modal-root').children.length || !!$('#confirm-root').children.length);
function openModal(html) {
  lastFocus = document.activeElement; menuOpen = false;
  $('#modal-root').innerHTML = '<div class="m-back" data-mback><div class="m-card" role="dialog" aria-modal="true">' + html + '</div></div>';
  lockUpdate();
  const f = $('#modal-root [autofocus]') || $('#modal-root input:not([type=hidden]):not([type=file]), #modal-root textarea, #modal-root select');
  if (f) setTimeout(() => { try { f.focus(); } catch (e) {} }, 90);
}
function closeModal(silent) {
  $('#modal-root').innerHTML = ''; lockUpdate();
  if (!silent && lastFocus && lastFocus.isConnected) { try { lastFocus.focus(); } catch (e) {} }
}
function openConfirm(o) {
  confirmCb = o.onOk;
  $('#confirm-root').innerHTML = '<div class="m-back" data-cback style="z-index:110"><div class="m-card" style="width:min(420px,100%)">' +
    '<div class="m-head"><h2>' + esc(o.title) + '</h2></div><p style="color:var(--muted)">' + esc(o.text) + '</p>' +
    '<div class="m-foot"><button class="btn ghost grow" data-action="close-confirm">Отмена</button>' +
    '<button class="btn ' + (o.danger ? 'danger' : 'primary') + ' grow" data-action="confirm-ok">' + esc(o.ok || 'Подтвердить') + '</button></div></div></div>';
  lockUpdate();
}
function closeConfirm() { $('#confirm-root').innerHTML = ''; confirmCb = null; lockUpdate(); }

/* ================= 9. ОТРИСОВКА ================= */
function avaHtml(p, cls) {
  const h = hueOf(p && p.name);
  return '<div class="' + (cls || 'ava') + '" style="background:linear-gradient(135deg,hsl(' + h + ',55%,42%),hsl(' + ((h + 60) % 360) + ',60%,48%))">' +
    (p && p.avatar ? '<img src="' + esc(p.avatar) + '" alt="">' : esc(initials(p && p.name))) + '</div>';
}
const userAva = u => avaHtml({ name: u.name || u.email || 'Гость', avatar: u.photo }, 'ava');
function photoHtml(g) {
  const h = HOLIDAYS[g.holiday] || HOLIDAYS.just;
  return g.photo ? '<img src="' + esc(g.photo) + '" alt="" loading="lazy" draggable="false">'
    : '<div class="ph-fallback" style="--pf1:' + h.c1 + ';--pf2:' + h.c2 + '"><span>' + h.emoji + '</span></div>';
}
function currentCtx() {
  if (S.route.name === 'home') return 'owner';
  if (S.route.name === 'res') return 'res';
  const own = S.profile && S.profile.ownerUid === myUid() && S.route.pid !== EX;
  return own ? 'self' : 'visitor';
}
function giftCard(g, ctx, i) {
  const res = isReserved(g), mine = res && g.reservedBy === myUid();
  const h = HOLIDAYS[g.holiday] || HOLIDAYS.just;
  const drag = ctx === 'owner' && S.sort === 'manual' && !S.q && S.filterH === 'all';
  const link = g.link ? '<a class="shoplink" href="' + esc(g.link) + '" target="_blank" rel="noopener noreferrer">' + icon('ext', 13) + 'магазин</a>' : '';
  let foot = '';
  if (ctx === 'owner') {
    foot = '<span class="badge ' + (res ? 'b-lock' : 'b-free') + '"' + (res ? ' title="Кто-то готовит подарок. Кто именно — секрет 🤫"' : '') + '>' +
      (res ? icon('lock', 13) + ' Занято' : 'Свободно') + '</span><span class="gtools">' +
      (drag ? '<span class="grip">' + icon('grip', 15) + '</span>' +
        '<button class="ibtn sm mv" data-action="move" data-dir="-1" data-id="' + g.id + '" title="Левее">' + icon('cl', 14) + '</button>' +
        '<button class="ibtn sm mv" data-action="move" data-dir="1" data-id="' + g.id + '" title="Правее">' + icon('cr', 14) + '</button>' : '') +
      '<button class="ibtn sm" data-action="edit-gift" data-id="' + g.id + '" title="Редактировать">' + icon('pen', 14) + '</button>' +
      '<button class="ibtn sm danger" data-action="del-gift" data-id="' + g.id + '" title="Удалить">' + icon('trash', 14) + '</button></span>';
  } else if (ctx === 'self') {
    foot = '<span class="badge ' + (res ? 'b-lock' : 'b-free') + '">' + (res ? icon('lock', 13) + ' Занято' : 'Ваш подарок') + '</span>';
  } else if (ctx === 'res') {
    foot = res
      ? '<span class="badge b-mine">' + icon('check', 13) + ' до ' + fmtShort(g.reservedUntil) + '</span><button class="btn ghost sm" style="margin-left:auto" data-action="release" data-id="' + g.id + '" data-pid="' + g._pid + '">Отменить</button>'
      : '<span class="badge b-warn">' + icon('cal', 13) + ' Срок истёк</span><button class="btn ghost sm" style="margin-left:auto" data-action="res-forget" data-id="' + g.id + '" data-pid="' + g._pid + '">Убрать</button>';
  } else {
    foot = res
      ? (mine ? '<span class="badge b-mine">' + icon('check', 13) + ' Ваша бронь</span><button class="btn ghost sm" style="margin-left:auto" data-action="release" data-id="' + g.id + '">Отменить</button>'
              : '<span class="badge b-lock">' + icon('lock', 13) + ' Забронировано</span>')
      : '<button class="btn primary sm grow" data-action="reserve" data-id="' + g.id + '">' + icon('gift', 15) + ' Забронировать</button>';
  }
  return '<article class="card gift reveal' + (res && ctx !== 'res' ? ' is-res' : '') + '" style="--d:' + Math.min(i, 8) * 45 + 'ms"' +
    (drag ? ' draggable="true"' : '') + ' data-action="detail" data-id="' + g.id + '"' + (ctx === 'res' ? ' data-pid="' + g._pid + '"' : '') +
    ' tabindex="0" role="button" aria-label="' + esc(g.title) + '">' +
    '<div class="ph">' + photoHtml(g) +
      '<div class="ph-tags"><span class="tag">' + h.emoji + ' ' + h.label + '</span>' + (g.dream ? '<span class="tag dream">💫 Мечта</span>' : '') + '</div>' +
      (res && ctx !== 'res' ? '<div class="lock-veil"><span>' + icon('lock', 14) + ' ' + (mine ? 'Ваша бронь' : 'Занято') + '</span></div>' : '') +
    '</div><div class="gbody"><h3>' + esc(g.title) + '</h3>' + (g.description ? '<p class="gdesc">' + esc(g.description) + '</p>' : '') +
    '<div class="gmeta">' + (g.price != null ? '<span class="price">' + money(g.price) + '</span>' : '') + link + '</div></div>' +
    '<div class="gfoot">' + foot + '</div></article>';
}
function visibleGifts() {
  let arr = S.gifts.slice();
  if (S.q) { const q = S.q.toLowerCase(); arr = arr.filter(g => (g.title + ' ' + (g.description || '')).toLowerCase().indexOf(q) > -1); }
  if (S.filterH !== 'all') arr = arr.filter(g => g.holiday === S.filterH);
  const man = (a, b) => (a.order == null ? a.createdAt : a.order) - (b.order == null ? b.createdAt : b.order);
  const map = {
    manual: man, new: (a, b) => b.createdAt - a.createdAt,
    cheap: (a, b) => (a.price == null ? Infinity : a.price) - (b.price == null ? Infinity : b.price),
    pricey: (a, b) => (b.price == null ? -1 : b.price) - (a.price == null ? -1 : a.price),
    free: (a, b) => (isReserved(a) ? 1 : 0) - (isReserved(b) ? 1 : 0) || (b.dream ? 1 : 0) - (a.dream ? 1 : 0) || man(a, b),
    az: (a, b) => a.title.localeCompare(b.title, 'ru')
  };
  return arr.sort(map[S.sort] || man);
}
function chipsHtml() {
  const cnt = {}; S.gifts.forEach(g => { cnt[g.holiday] = (cnt[g.holiday] || 0) + 1; });
  let out = '<button class="chip' + (S.filterH === 'all' ? ' on' : '') + '" data-action="chip" data-h="all">Все <b>' + S.gifts.length + '</b></button>';
  HORDER.forEach(h => { if (cnt[h]) out += '<button class="chip' + (S.filterH === h ? ' on' : '') + '" data-action="chip" data-h="' + h + '">' + HOLIDAYS[h].emoji + ' ' + HOLIDAYS[h].label + ' <b>' + cnt[h] + '</b></button>'; });
  return out;
}
const renderChips = () => { const c = $('#chips'); if (c) c.innerHTML = chipsHtml(); };
function renderGrid() {
  const el = $('#grid'); if (!el) return;
  const ctx = currentCtx(), arr = visibleGifts();
  if (!S.gifts.length) {
    el.innerHTML = ctx === 'owner'
      ? '<div class="empty card"><div class="emo">🎁</div><h3>Список пока пуст</h3><p>Добавьте первый подарок — с фото, описанием и ссылкой на магазин. Друзья скажут спасибо.</p><button class="btn primary big" data-action="add-gift">' + icon('plus', 18) + ' Добавить подарок</button></div>'
      : '<div class="empty card"><div class="emo">🌱</div><h3>Список пока пуст</h3><p>Загляните чуть позже — именинник ещё собирает хотелки.</p></div>';
  } else if (!arr.length) {
    el.innerHTML = '<div class="empty card"><div class="emo">🔍</div><h3>Ничего не нашлось</h3><p>Попробуйте другой запрос или сбросьте фильтры.</p><button class="btn ghost" data-action="clear-filters">Сбросить фильтры</button></div>';
  } else el.innerHTML = arr.map((g, i) => giftCard(g, ctx, i)).join('');
  revealAll();
}
function countdownTarget() {
  const list = [], has = {};
  S.gifts.forEach(g => { has[g.holiday] = 1; });
  if (has.newyear) list.push({ t: nextDate(1, 1, false), label: '🎄 Новый год' });
  ['valentine','feb23','march8'].forEach(h => { if (has[h]) list.push({ t: nextDate(HOLIDAYS[h].m, HOLIDAYS[h].d, true), label: HOLIDAYS[h].emoji + ' ' + HOLIDAYS[h].label }); });
  if (S.profile && S.profile.birthday) { const p = S.profile.birthday.split('-'); list.push({ t: nextDate(+p[1], +p[2], true), label: '🎂 День рождения' }); }
  S.gifts.forEach(g => { if (g.holiday === 'custom' && g.customDate) { const t = new Date(g.customDate + 'T23:59:59').getTime(); if (t > Date.now()) list.push({ t, label:'📅 ' + fmtShort(t) }); } });
  list.sort((a, b) => a.t - b.t);
  return list[0] || null;
}
function tickCd() {
  const el = $('#cd-num'); if (!el) return;
  let ms = Number(el.dataset.t) - Date.now();
  if (ms <= 0) { el.textContent = 'сегодня! 🎉'; return; }
  const d = Math.floor(ms / DAY); ms -= d * DAY;
  const p2 = n => String(n).padStart(2, '0');
  el.textContent = d + 'д ' + p2(Math.floor(ms / 3600000)) + ':' + p2(Math.floor(ms % 3600000 / 60000)) + ':' + p2(Math.floor(ms % 60000 / 1000));
}
function renderStats() {
  const el = $('#stats'); if (!el) return;
  const total = S.gifts.length, res = S.gifts.filter(isReserved).length;
  const budget = S.gifts.reduce((s, g) => s + (g.price || 0), 0), cd = countdownTarget();
  el.innerHTML =
    '<div class="stat"><span class="n">' + total + '</span><span class="t">подарков<br>в списке</span></div>' +
    '<div class="stat"><span class="n" style="color:var(--ok)">' + (total - res) + '</span><span class="t">свободно<br>для брони</span></div>' +
    '<div class="stat"><span class="n" style="color:var(--warn)">' + res + '</span><span class="t">уже<br>занято</span></div>' +
    (currentCtx() === 'owner' && budget ? '<div class="stat"><span class="n">' + budget.toLocaleString('ru-RU') + ' ₽</span><span class="t">бюджет<br>мечты</span></div>' : '') +
    (cd ? '<div class="stat cd"><span class="t">' + cd.label + '<br>через</span><span class="n" id="cd-num" data-t="' + cd.t + '">…</span></div>' : '');
  tickCd();
}
const renderAll = () => { renderGrid(); renderChips(); renderStats(); };
function startCd() { clearInterval(cdTimer); cdTimer = setInterval(tickCd, 1000); onClean(() => clearInterval(cdTimer)); }
function toolbarHtml(owner) {
  let opts = '';
  Object.keys(SORTS).forEach(k => { if (owner || k !== 'manual') opts += '<option value="' + k + '"' + (S.sort === k ? ' selected' : '') + '>' + SORTS[k] + '</option>'; });
  return '<div class="toolbar reveal"><div class="tb-row">' +
    '<label class="search">' + icon('search', 17) + '<input data-input="search" placeholder="Поиск по списку…" value="' + esc(S.q) + '" aria-label="Поиск"></label>' +
    '<div class="sel"><select data-change="sort" aria-label="Сортировка">' + opts + '</select></div>' +
    (owner ? '<button class="btn primary" data-action="add-gift">' + icon('plus', 17) + '<span>Добавить</span></button>' : '') +
    '</div><div class="chips" id="chips">' + chipsHtml() + '</div></div>';
}
function accountHtml() {
  const u = window.Auth.user();
  if (!u) return '<button class="btn primary sm" data-action="sign-in">' + icon('user', 15) + '<span class="nm">Войти</span></button>';
  const nm = u.name || u.email || 'Гость';
  const admin = window.Admin && window.Admin.canAccess();
  return '<div class="acct-wrap"><button class="acct-btn" data-action="account" aria-label="Аккаунт">' +
    avaHtml({ name: nm, avatar: u.photo }, 'ava-chip') + '<span class="nm">' + esc(nm.split(' ')[0]) + '</span>' +
    (u.isGuest ? '<span class="gb">гость</span>' : '') + '</button>' +
    '<div class="acct-menu" id="acct-menu"' + (menuOpen ? '' : ' hidden') + '>' +
      '<div class="acct-top">' + userAva(u) + '<div class="who"><b>' + esc(nm) + '</b><span>' + esc(u.email || (u.isGuest ? 'Вход без регистрации' : '')) + '</span></div></div>' +
      '<a href="#/">' + icon('home', 17) + ' Мой список</a>' +
      '<a href="#/reservations">' + icon('mark', 17) + ' Мои брони</a>' +
      '<button data-action="settings">' + icon('sliders', 17) + ' Настройки</button>' +
      (u.isGuest && window.Auth.online() ? '<button data-action="link-google">' + icon('link', 17) + ' Привязать Google</button>' : '') +
      (admin ? '<div class="acct-sep"></div><a class="adm" href="#/admin">' + icon('shield', 17) + ' Панель владельца</a>' : '') +
      '<div class="acct-sep"></div><button class="out" data-action="sign-out">' + icon('out', 17) + ' Выйти</button>' +
    '</div></div>';
}
function renderNav() {
  const r = S.route.name, T = window.Theme, dark = T.mode() === 'dark';
  const garland = T.style() === 'newyear' ? '<div class="garland">' + new Array(17).join('<span class="bulb"></span>') + '</div>' : '';
  let styleOpts = '';
  Object.keys(T.STYLES).forEach(k => { styleOpts += '<option value="' + k + '"' + (T.stylePref() === k ? ' selected' : '') + '>' + T.STYLES[k].e + ' ' + T.STYLES[k].n + '</option>'; });
  $('#nav').innerHTML = '<div class="nav-in">' +
    '<a class="brand" href="#/"><span class="logo">' + icon('gift', 20) + '</span><span class="brand-t">' + esc(SITE) + '</span></a>' +
    '<nav class="nav-links">' +
      '<a href="#/" class="' + (r === 'home' ? 'on' : '') + '">Мой список</a>' +
      '<a href="#/reservations" class="' + (r === 'res' ? 'on' : '') + '">Мои брони</a>' +
      (CFG.showExample !== false ? '<a href="#/u/' + EX + '" class="' + (r === 'public' && S.route.pid === EX ? 'on' : '') + '">Пример</a>' : '') +
    '</nav><div class="nav-tools">' +
      '<button class="ibtn" data-action="sound" title="' + (SND.on ? 'Выключить звук' : 'Включить звук') + '">' + icon(SND.on ? 'vol' : 'volx', 18) + '</button>' +
      '<button class="ibtn mode-btn" data-action="theme-mode" title="' + (dark ? 'Сделать светлой' : 'Сделать тёмной') + '">' + icon(dark ? 'sun' : 'moon', 18) + '</button>' +
      '<div class="sel theme-sel"><select data-change="style" aria-label="Стиль оформления">' + styleOpts + '</select></div>' +
      accountHtml() +
    '</div></div>' + garland;
  $('#tabbar').innerHTML =
    '<a href="#/" class="' + (r === 'home' ? 'on' : '') + '">' + icon('home', 20) + 'Список</a>' +
    '<a href="#/u/' + EX + '" class="' + (r === 'public' && S.route.pid === EX ? 'on' : '') + '">' + icon('gift', 20) + 'Пример</a>' +
    '<a href="#/reservations" class="' + (r === 'res' ? 'on' : '') + '">' + icon('mark', 20) + 'Брони</a>' +
    '<button data-action="theme-mode">' + icon(dark ? 'sun' : 'moon', 20) + 'Тема</button>' +
    '<button data-action="settings">' + icon('sliders', 20) + 'Ещё</button>';
  $('#foot').innerHTML = '<b>' + esc(SITE) + '</b> · сделано с ❤️ для друзей и семьи · ' + new Date().getFullYear() +
    '<br><span style="font-size:12px">Ссылка вместо сотни сообщений «что тебе подарить?»</span>';
}
const IO = ('IntersectionObserver' in window)
  ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); IO.unobserve(e.target); } }), { threshold: 0.06 }) : null;
function revealAll() { $$('.reveal:not(.in)').forEach(el => { if (IO) IO.observe(el); else el.classList.add('in'); }); }
function skeleton() { $('#app').innerHTML = '<div class="sk" style="height:150px"></div><div class="grid">' + new Array(7).join('<div class="sk" style="height:330px"></div>') + '</div>'; }

/* ---------- экраны ---------- */
function onboardHtml() {
  const eg = L.gifts[EX] || {};
  const arr = Object.keys(eg).map(k => eg[k]).sort((a, b) => a.order - b.order);
  const mini = g => '<div class="hb"><b>' + esc(g.title) + '</b><div class="row"><span class="price">' + money(g.price) + '</span>' +
    (isReserved(g) ? '<span class="badge b-lock">' + icon('lock', 11) + ' Занято</span>' : '<span class="badge b-free">Свободно</span>') + '</div></div>';
  const hc = (g, cls) => g ? '<a class="hcard ' + cls + '" href="#/u/' + EX + '"><img src="' + esc(g.photo) + '" alt="">' + mini(g) + '</a>' : '';
  const steps = [
    ['1','gift','Собери список','Добавь подарки с фото, ценой и ссылкой на магазин.'],
    ['2','share','Кинь ссылку','Одна ссылка на профиль вместо сотни переписок «что тебе подарить?».'],
    ['3','lock','Друзья бронируют','Каждый занимает подарок одним кликом — до самого праздника.'],
    ['4','check','Никаких повторов','Занятые подарки видны всем. А кто дарит — секрет до вручения 🤫.']
  ];
  return '<section class="hero"><div class="reveal">' +
    '<span class="eyebrow">' + icon('spark', 15) + ' Списки подарков без повторов</span>' +
    '<h1>Пусть дарят то,<br>что <em>ты правда хочешь</em></h1>' +
    '<p class="sub">Собери список хотелок с фото и ссылками, кинь друзьям одну ссылку — они забронируют подарки, и никто не подарит одно и то же дважды.</p>' +
    '<div class="cta-row"><button class="btn primary big" data-action="create-profile">' + icon('gift', 19) + ' Создать мой список</button>' +
    (CFG.showExample !== false ? '<a class="btn ghost big" href="#/u/' + EX + '">Посмотреть пример ' + icon('cr', 16) + '</a>' : '') + '</div>' +
    '<div class="trust"><span>' + icon('check', 14) + ' Бесплатно</span><span>' + icon('check', 14) + ' Вход через Google или как гость</span><span>' + icon('check', 14) + ' Сюрприз сохраняется</span></div>' +
    '</div><div class="hero-stack reveal" style="--d:150ms">' + hc(arr[0], 'hc1') + hc(arr[1], 'hc2') + hc(arr[3], 'hc3') +
    '<div class="float-badge">🔒 Часы уже забрала Марина</div></div></section>' +
    '<section class="steps">' + steps.map((s, i) =>
      '<div class="card step reveal" style="--d:' + i * 90 + 'ms"><div class="num">' + s[0] + '</div><h3>' + icon(s[1], 17) + ' ' + s[2] + '</h3><p>' + s[3] + '</p></div>').join('') + '</section>';
}
function guestBanner() {
  if (!window.Auth.online() || !window.Auth.isGuest()) return '';
  return '<div class="gbanner reveal">' + icon('alert', 20) +
    '<span class="tx"><b>Вы вошли как гость.</b> Привяжите Google — список будет открываться с телефона и любого компьютера, ничего не потеряется.</span>' +
    '<button class="btn primary sm" data-action="link-google">' + icon('link', 14) + ' Привязать Google</button></div>';
}
async function renderHome() {
  const t = token;
  if (!window.Auth.uid()) { $('#app').innerHTML = onboardHtml(); revealAll(); return; }
  if (!S.myPid) { try { S.myPid = await db().findMyProfile(); } catch (e) { toast(friendly(e), { type:'err' }); } if (t !== token) return; }
  if (!S.myPid) {
    $('#app').innerHTML = onboardHtml() +
      '<div class="empty card reveal" style="margin-top:20px"><div class="emo">✨</div><h3>Остался один шаг</h3><p>Вы вошли. Создайте профиль — придумайте адрес ссылки, и список можно отправлять друзьям.</p><button class="btn primary big" data-action="create-profile">' + icon('plus', 18) + ' Создать профиль</button></div>';
    revealAll(); return;
  }
  let p = S.myProfile;
  if (!p) { try { p = await db(S.myPid).getProfile(S.myPid); } catch (e) { toast(friendly(e), { type:'err' }); } }
  if (t !== token) return;
  if (!p) { S.myPid = null; LS.del(window.Auth.online() ? 'myPid.live' : 'myPid'); return renderHome(); }
  S.profile = p; S.myProfile = p; S.sort = LS.get('sort.owner', 'manual'); renderNav();
  const url = shareUrl(S.myPid);
  const bday = p.birthday ? ' · 🎂 ' + fmtShort(nextDate(+p.birthday.split('-')[1], +p.birthday.split('-')[2], true)) : '';
  $('#app').innerHTML = guestBanner() +
    '<section class="card phead reveal"><div class="ava-ring">' + avaHtml(p) + '</div><div class="pinfo">' +
      '<h1>' + esc(p.name) + '</h1>' + (p.bio ? '<p class="pbio">' + esc(p.bio) + '</p>' : '') +
      '<p class="psince">' + icon('cal', 13) + ' В списках с ' + fmtDate(p.createdAt) + bday + '</p>' +
      '<div class="sharebox"><span class="url" title="' + esc(url) + '">' + esc(url) + '</span>' +
        '<button class="ibtn sm" data-action="copy-link" title="Скопировать">' + icon('copy', 14) + '</button>' +
        '<button class="ibtn sm" data-action="share-link" title="Поделиться">' + icon('share', 14) + '</button>' +
        '<a class="ibtn sm" href="#/u/' + esc(S.myPid) + '" title="Как видят друзья">' + icon('eye', 14) + '</a></div>' +
      '<p class="hint">Киньте эту ссылку друзьям — они увидят список и смогут бронировать подарки.</p>' +
    '</div><button class="btn ghost sm" data-action="edit-profile">' + icon('pen', 14) + ' Оформить профиль</button></section>' +
    '<div class="stats" id="stats"></div>' + toolbarHtml(true) + '<div class="grid" id="grid"></div>';
  const pid = S.myPid;
  onClean(db(pid).watchGifts(pid, arr => {
    if (t !== token) return;
    S.gifts = arr; renderAll();
    arr.forEach(g => {
      if (g.reservedBy && (g.reservedUntil || 0) <= Date.now())
        db(pid).updateGift(pid, g.id, { reservedBy:null, reservedByName:null, reservedAt:null, reservedUntil:null }).catch(() => {});
    });
  }));
  startCd(); revealAll();
}
async function renderPublic(pid) {
  const t = token; skeleton();
  let p = null;
  try { p = await db(pid).getProfile(pid); } catch (e) { toast(friendly(e), { type:'err' }); }
  if (t !== token) return;
  if (!p) {
    $('#app').innerHTML = '<div class="empty card"><div class="emo">😔</div><h3>Профиль не найден</h3><p>Проверьте ссылку — возможно, в ней опечатка. Или создайте свой список!</p><a class="btn primary" href="#/">' + icon('home', 16) + ' На главную</a></div>';
    revealAll(); return;
  }
  S.profile = p; S.sort = LS.get('sort.visitor', 'free');
  const own = p.ownerUid === myUid() && pid !== EX;
  const banner = pid === EX
    ? '<div class="banner demo reveal">' + icon('info', 17) + '<span>Это пример списка — можно спокойно тренироваться бронировать 🎯 На реальные списки это не влияет.</span></div>'
    : own ? '<div class="banner self reveal">' + icon('eye', 17) + '<span>Так ваш список видят друзья. Себя бронировать нельзя — откройте ссылку в инкогнито или отправьте другу.</span></div>' : '';
  $('#app').innerHTML = banner +
    '<section class="card pub-hero reveal"><div class="ava-ring" id="pub-ava">' + avaHtml(p) + '</div>' +
    '<h1 id="pub-name">' + esc(p.name) + '</h1><p class="pbio" id="pub-bio">' + esc(p.bio || '') + '</p>' +
    '<p class="pub-note">' + icon('lock', 13) + ' Бронируя подарок, вы занимаете его до праздника — другие увидят, что он занят. Автор списка видит статус, но не видит, кто дарит: сюрприз в безопасности 🤫</p>' +
    '<div class="pub-actions"><button class="btn ghost sm" data-action="copy-link" data-pid="' + esc(pid) + '">' + icon('copy', 14) + ' Скопировать ссылку</button>' +
    '<button class="btn ghost sm" data-action="share-link" data-pid="' + esc(pid) + '">' + icon('share', 14) + ' Поделиться</button></div></section>' +
    '<div class="stats" id="stats"></div>' + toolbarHtml(false) + '<div class="grid" id="grid"></div>';
  onClean(db(pid).watchGifts(pid, arr => { if (t !== token) return; S.gifts = arr; renderAll(); }));
  onClean(db(pid).watchProfile(pid, np => {
    if (t !== token || !np) return;
    S.profile = np;
    const n = $('#pub-name'), b = $('#pub-bio'), a = $('#pub-ava');
    if (n) n.textContent = np.name; if (b) b.textContent = np.bio || ''; if (a) a.innerHTML = avaHtml(np);
  }));
  startCd(); revealAll();
}
async function renderRes() {
  const t = token;
  if (!window.Auth.uid()) {
    $('#app').innerHTML = '<h1 class="page-title reveal">Мои брони</h1><p class="page-sub reveal">Здесь подарки, которые вы обещали подарить.</p>' +
      '<div class="empty card reveal"><div class="emo">🔖</div><h3>Нужен вход</h3><p>Войдите через Google или как гость — и увидите все свои брони в одном месте.</p><button class="btn primary big" data-action="sign-in">' + icon('user', 18) + ' Войти</button></div>';
    revealAll(); return;
  }
  skeleton();
  const all = LS.get('res', []) || [], keep = [], rows = [];
  for (let i = 0; i < all.length; i++) {
    const e = all[i];
    const im = e.mode === 'cloud' ? (window.Auth.online() ? Live : null) : Local;
    if (!im) { keep.push(e); continue; }
    const uid = im.uid();
    try {
      const g = await im.getGift(e.pid, e.gid), p = await im.getProfile(e.pid);
      if (t !== token) return;
      if (g && p && uid && g.reservedBy === uid) { g._pid = e.pid; rows.push({ g, p, pid: e.pid }); keep.push(e); }
    } catch (err) { keep.push(e); }
  }
  LS.set('res', keep); S.resData = rows;
  if (!rows.length) {
    $('#app').innerHTML = '<h1 class="page-title reveal">Мои брони</h1><p class="page-sub reveal">Здесь подарки, которые вы забронировали для друзей.</p>' +
      '<div class="empty card reveal"><div class="emo">🔖</div><h3>Пока пусто</h3><p>Откройте список друга или пример списка и нажмите «Забронировать» на подарке.</p><a class="btn primary" href="#/u/' + EX + '">' + icon('gift', 16) + ' Открыть пример списка</a></div>';
    revealAll(); return;
  }
  const byP = {}; rows.forEach(r => { (byP[r.pid] = byP[r.pid] || []).push(r); });
  const n = rows.length, word = n === 1 ? 'подарок' : (n < 5 ? 'подарка' : 'подарков');
  $('#app').innerHTML = '<h1 class="page-title reveal">Мои брони</h1><p class="page-sub reveal">Вы обещали подарить ' + n + ' ' + word + ' 🎁 Не забудьте купить!</p>' +
    Object.keys(byP).map((pid, i) => {
      const rs = byP[pid];
      return '<section class="res-sec reveal" style="--d:' + i * 80 + 'ms"><div class="res-head">' + avaHtml(rs[0].p) +
        '<b>' + esc(rs[0].p.name) + '</b><a href="#/u/' + esc(pid) + '">Открыть список →</a></div>' +
        '<div class="grid">' + rs.map((r, j) => giftCard(r.g, 'res', j)).join('') + '</div></section>';
    }).join('');
  revealAll();
}

/* ================= 10. МОДАЛКИ ================= */
const findGift = (id, pid) => S.gifts.filter(g => g.id === id)[0] ||
  (S.resData.filter(r => r.g.id === id && (!pid || r.g._pid === pid))[0] || {}).g || null;
function openDetail(g, pid) {
  const res = isReserved(g), mine = res && g.reservedBy === myUid();
  const p = pid === S.myPid ? S.myProfile : S.profile;
  const own = p && p.ownerUid === myUid() && pid !== EX;
  const h = HOLIDAYS[g.holiday] || HOLIDAYS.just;
  let act;
  if (own) {
    act = '<button class="btn ghost grow" data-action="edit-gift" data-id="' + g.id + '">' + icon('pen', 15) + ' Редактировать</button>' +
      (res ? '<button class="btn danger" data-action="reset-lock" data-id="' + g.id + '">' + icon('lock', 15) + ' Снять бронь</button>' : '') +
      '<button class="btn danger" data-action="del-gift" data-id="' + g.id + '">' + icon('trash', 15) + '</button>';
  } else if (res) {
    act = mine
      ? '<span class="badge b-mine" style="align-self:center">' + icon('check', 14) + ' Ваша бронь до ' + fmtShort(g.reservedUntil) + '</span><button class="btn ghost grow" data-action="release" data-id="' + g.id + '" data-pid="' + esc(pid) + '">Отменить бронь</button>'
      : '<span class="badge b-lock" style="padding:10px 16px">' + icon('lock', 15) + ' Уже забронировано — выберите другой подарок</span>';
  } else {
    act = '<button class="btn primary big grow" data-action="reserve" data-id="' + g.id + '" data-pid="' + esc(pid) + '">' + icon('gift', 18) + ' Забронировать</button>';
  }
  openModal('<div class="m-head"><h2>' + esc(g.title) + '</h2><button class="ibtn" data-action="close-modal">' + icon('x', 17) + '</button></div>' +
    '<div class="detail-ph">' + photoHtml(g) + '</div>' +
    '<div class="detail-meta"><span class="tag soft">' + h.emoji + ' ' + h.label + (g.holiday === 'custom' && g.customDate ? ' · ' + fmtShort(new Date(g.customDate + 'T12:00:00').getTime()) : '') + '</span>' +
    (g.dream ? '<span class="tag dream">💫 Мечта</span>' : '') + (g.price != null ? '<span class="tag soft">💰 ' + money(g.price) + '</span>' : '') + '</div>' +
    (g.description ? '<p class="detail-desc">' + esc(g.description) + '</p>' : '<p class="detail-desc" style="font-style:italic">Без описания.</p>') +
    (g.link ? '<a class="btn ghost" href="' + esc(g.link) + '" target="_blank" rel="noopener noreferrer">' + icon('ext', 15) + ' Открыть магазин</a>' : '') +
    (own && res ? '<p class="hint" style="margin-top:12px">' + icon('lock', 12) + ' Кто-то уже готовит этот подарок. Кто именно — секрет до праздника 🤫</p>' : '') +
    '<div class="m-foot">' + act + '</div>');
}
const dzHtml = photo => photo
  ? '<img src="' + esc(photo) + '" alt=""><button type="button" class="ibtn sm rm" data-action="photo-remove" title="Убрать фото">' + icon('x', 14) + '</button><span class="sz">Фото готово · ~' + Math.round(photo.length * 0.75 / 1024) + ' КБ</span>'
  : '<div class="inner">' + icon('ul', 26) + 'Нажмите или перетащите фото сюда<br><span style="font-weight:500;font-size:12px">jpg / png / webp — сожмём автоматически</span></div>';
function openGiftForm(g) {
  formPhoto = g ? (g.photo || null) : null;
  const today = new Date().toISOString().slice(0, 10), cur = g ? g.holiday : 'newyear';
  let hopts = '';
  HORDER.forEach(h => { hopts += '<option value="' + h + '"' + (cur === h ? ' selected' : '') + '>' + HOLIDAYS[h].emoji + ' ' + HOLIDAYS[h].label + '</option>'; });
  openModal('<div class="m-head"><h2>' + (g ? 'Редактировать подарок' : 'Новый подарок') + '</h2><button class="ibtn" data-action="close-modal">' + icon('x', 17) + '</button></div>' +
    '<form id="form-gift" data-id="' + (g ? g.id : '') + '" novalidate>' +
    '<div class="field"><div class="dz" id="dropzone" data-action="photo-pick">' + dzHtml(formPhoto) + '</div><input type="file" id="file-gift-photo" accept="image/*" hidden></div>' +
    '<div class="field"><label class="lbl" for="f-title">Название *</label><input class="inp" id="f-title" maxlength="80" placeholder="Например: наушники с шумоподавлением" value="' + esc(g ? g.title : '') + '" autofocus><p class="ferr" id="err-title">Напишите название — хотя бы пару букв</p></div>' +
    '<div class="field"><label class="lbl" for="f-desc">Описание</label><textarea class="inp" id="f-desc" maxlength="600" placeholder="Модель, цвет, размер, важные детали…">' + esc(g ? g.description : '') + '</textarea></div>' +
    '<div class="field"><label class="lbl" for="f-link">Ссылка на товар</label><input class="inp" id="f-link" placeholder="https://ozon.ru/…" value="' + esc(g ? g.link : '') + '"><p class="hint">Можно ссылку на поиск в магазине — другу будет проще выбрать.</p></div>' +
    '<div class="frow"><div class="field"><label class="lbl" for="f-price">Примерная цена, ₽</label><input class="inp" id="f-price" type="number" min="0" step="1" inputmode="numeric" placeholder="2500" value="' + (g && g.price != null ? g.price : '') + '"></div>' +
    '<div class="field"><label class="lbl" for="f-holiday">Праздник</label><div class="sel" style="display:flex"><select id="f-holiday" data-change="holiday">' + hopts + '</select></div></div></div>' +
    '<div class="field" id="row-date" style="display:' + (cur === 'custom' ? 'block' : 'none') + '"><label class="lbl" for="f-date">Дата повода</label><input class="inp" id="f-date" type="date" min="' + today + '" value="' + (g && g.customDate ? g.customDate : '') + '"><p class="hint">Бронь продержится до этой даты.</p></div>' +
    '<label class="sw-row"><span class="switch"><input type="checkbox" id="f-dream"' + (g && g.dream ? ' checked' : '') + '><i></i></span><span>💫 Это мечта<br><span class="hint">Такие подарки показываются друзьям выше в списке</span></span></label>' +
    '<div class="m-foot">' + (g ? '<button type="button" class="btn danger" data-action="del-gift" data-id="' + g.id + '">' + icon('trash', 15) + ' Удалить</button>' : '') +
    '<button type="submit" class="btn primary big grow" id="gift-save">' + icon('check', 17) + ' ' + (g ? 'Сохранить' : 'Добавить в список') + '</button></div></form>');
}
function refreshAvatarPreview() {
  const box = $('#ava-prev'); if (!box) return;
  const n = $('#f-name');
  box.innerHTML = avaHtml({ name: (n && n.value) || (S.myProfile && S.myProfile.name) || 'Я', avatar: formAvatar });
}
function openProfileForm() {
  const p = S.myProfile, create = !p, u = window.Auth.user() || {};
  formAvatar = p ? (p.avatar || null) : (u.photo || null);
  const nameVal = p ? p.name : (u.name || '');
  openModal('<div class="m-head"><h2>' + (create ? 'Создать профиль' : 'Оформить профиль') + '</h2><button class="ibtn" data-action="close-modal">' + icon('x', 17) + '</button></div>' +
    '<form id="form-profile" novalidate>' +
    '<div class="ava-edit"><div id="ava-prev">' + avaHtml({ name: nameVal || 'Я', avatar: formAvatar }) + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn ghost sm" data-action="avatar-pick">' + icon('ul', 14) + ' Загрузить аватар</button>' +
    '<button type="button" class="btn ghost sm" data-action="avatar-remove">Убрать</button></div><input type="file" id="file-avatar" accept="image/*" hidden></div>' +
    '<div class="field"><label class="lbl" for="f-name">Имя или ник *</label><input class="inp" id="f-name" maxlength="40" placeholder="Например: Маша Иванова" value="' + esc(nameVal) + '" data-input="name" autofocus><p class="ferr" id="err-name">Как вас звать? Хотя бы две буквы 🙂</p></div>' +
    (create
      ? '<div class="field"><label class="lbl" for="f-slug">Адрес ссылки</label><div class="slug-row"><span class="slug-pre">…#/u/</span><input class="inp" id="f-slug" maxlength="24" placeholder="masha" data-input="slug" value="' + esc(translit(nameVal)) + '"></div><p class="ferr" id="err-slug">3–24 символа: латиница, цифры, дефис. Адрес может быть занят.</p><p class="hint">Красивый адрес проще диктовать друзьям.</p></div>'
      : '<p class="hint" style="margin:-6px 0 14px">Адрес ссылки: <b>#/u/' + esc(p.id) + '</b> (не меняется, чтобы старые ссылки жили)</p>') +
    '<div class="field"><label class="lbl" for="f-bday">Дата рождения</label><input class="inp" id="f-bday" type="date" value="' + (p && p.birthday ? p.birthday : '') + '"><p class="hint">Необязательно. Если указана — бронь на подарки «🎂 День рождения» держится до него.</p></div>' +
    '<div class="field"><label class="lbl" for="f-bio">О себе / намёки друзьям</label><textarea class="inp" id="f-bio" maxlength="200" placeholder="Люблю кофе, книги и всё для походов. Носки — мимо 😄" data-input="bio">' + esc(p ? p.bio : '') + '</textarea><p class="hint"><span id="bio-cnt">' + (p && p.bio ? p.bio.length : 0) + '</span>/200</p></div>' +
    '<div class="m-foot"><button type="submit" class="btn primary big grow" id="profile-save">' + icon('check', 17) + ' ' + (create ? 'Создать профиль' : 'Сохранить') + '</button></div></form>');
}
function openReserve(g, pid) {
  const until = reserveUntil(g, S.profile), h = HOLIDAYS[g.holiday] || HOLIDAYS.just;
  const u = window.Auth.user() || {};
  const nm = LS.get('visitorName', '') || u.name || '';
  openModal('<div class="m-head"><h2>Забронировать подарок</h2><button class="ibtn" data-action="close-modal">' + icon('x', 17) + '</button></div>' +
    '<div class="res-summary">' + (g.photo ? '<img src="' + esc(g.photo) + '" alt="">' : '<div class="thumb" style="--pf1:' + h.c1 + ';--pf2:' + h.c2 + '">' + h.emoji + '</div>') +
    '<div><b>' + esc(g.title) + '</b><span class="p">' + (g.price != null ? money(g.price) + ' · ' : '') + h.emoji + ' ' + h.label + '</span></div></div>' +
    '<div class="lock-note">' + icon('lock', 16) + '<span>Бронь продержится <b>до ' + fmtShort(until) + '</b>, потом снимется сама. Автор списка увидит, что подарок занят, но <b>не увидит, кем</b> — сюрприз сохранится 🤫</span></div>' +
    '<form id="form-reserve" data-id="' + g.id + '" data-pid="' + esc(pid) + '" novalidate>' +
    '<div class="field"><label class="lbl" for="r-name">Ваше имя *</label><input class="inp" id="r-name" maxlength="40" placeholder="Например: тётя Люда" value="' + esc(nm) + '" autofocus><p class="ferr" id="err-rname">Представьтесь — хотя бы две буквы</p><p class="hint">Имя видно только вам в разделе «Мои брони».</p></div>' +
    '<div class="m-foot"><button type="button" class="btn ghost" data-action="close-modal">Отмена</button><button type="submit" class="btn primary big grow" id="reserve-btn">' + icon('gift', 18) + ' Забронировать 🎁</button></div></form>');
}
function openSettings() {
  const T = window.Theme, u = window.Auth.user(), admin = window.Admin && window.Admin.canAccess();
  let modes = '';
  Object.keys(T.MODES).forEach(k => { modes += '<button data-action="set-mode" data-v="' + k + '" class="' + (T.modePref() === k ? 'on' : '') + '">' + T.MODES[k].e + ' ' + T.MODES[k].n + '</button>'; });
  let tiles = '';
  Object.keys(T.STYLES).forEach(k => {
    const v = T.STYLES[k];
    tiles += '<button class="ttile' + (T.stylePref() === k ? ' on' : '') + '" data-action="set-style" data-v="' + k + '">' +
      '<span class="tn">' + v.e + ' ' + v.n + '</span><span class="dots">' + v.d.map(c => '<i style="background:' + c + '"></i>').join('') + '</span></button>';
  });
  openModal('<div class="m-head"><h2>Настройки</h2><button class="ibtn" data-action="close-modal">' + icon('x', 17) + '</button></div>' +
    '<div class="set-sec"><h4>' + icon('moon', 14) + ' Тема</h4><div class="seg">' + modes + '</div>' +
    '<p class="hint" style="margin-top:8px">«Авто» подстраивается под тему устройства.</p></div>' +
    '<div class="set-sec"><h4>' + icon('spark', 14) + ' Стиль праздника</h4><div class="style-tiles">' + tiles + '</div>' +
    '<p class="hint" style="margin-top:8px">Стиль работает и в светлой, и в тёмной теме. «Авто» наряжает сайт к ближайшему празднику: снег на Новый год, сердечки к 14 февраля, лепестки к 8 марта.</p>' +
    '<label class="sw-row" style="margin-top:6px"><span class="switch"><input type="checkbox" id="set-sound"' + (SND.on ? ' checked' : '') + ' data-change="sound"><i></i></span><span>Звуки интерфейса</span></label></div>' +
    '<div class="set-sec"><h4>' + icon('user', 14) + ' Аккаунт</h4>' +
      (u ? '<div class="fb-status' + (u.isGuest ? '' : ' live') + '"><span class="dot"></span>' + (u.isGuest ? 'Гость — вход без регистрации' : esc(u.email || u.name)) + '</div>' +
        '<div class="data-btns">' + (u.isGuest && window.Auth.online() ? '<button class="btn primary sm" data-action="link-google">' + icon('link', 14) + ' Привязать Google</button>' : '') +
        '<button class="btn ghost sm" data-action="sign-out">' + icon('out', 14) + ' Выйти</button></div>' +
        (u.isGuest ? '<p class="hint" style="margin-top:8px">Привяжите Google, чтобы список открывался с любого устройства.</p>' : '<p class="hint" style="margin-top:8px">Список привязан к аккаунту Google — заходите с телефона или другого компьютера, он на месте.</p>')
        : '<div class="data-btns"><button class="btn primary sm" data-action="sign-in">' + icon('user', 14) + ' Войти</button></div>') +
    '</div>' +
    '<div class="set-sec"><h4>' + icon('dl', 14) + ' Мои данные</h4><div class="data-btns">' +
      '<button class="btn ghost sm" data-action="data-export">' + icon('dl', 14) + ' Скачать резервную копию</button>' +
      '<button class="btn ghost sm" data-action="data-import">' + icon('ul', 14) + ' Загрузить из файла</button></div>' +
      '<input type="file" id="file-import" accept=".json,application/json" hidden>' +
      '<p class="hint" style="margin-top:8px">Копия содержит ваш профиль и все подарки — на случай, если захотите перенести список.</p></div>' +
    (admin ? '<div class="set-sec"><h4>' + icon('shield', 14) + ' Владелец</h4><a class="btn ghost sm" href="#/admin">' + icon('shield', 14) + ' Панель владельца</a></div>' : '') +
    '<p class="hint" style="text-align:center">' + esc(SITE) + ' · версия 3.0</p>');
}

/* ================= 11. ДЕЙСТВИЯ ================= */
const pidOf = el => (el && el.dataset.pid) || (S.route.name === 'public' ? S.route.pid : S.myPid);
async function refreshSession(reroute) {
  S.myPid = null; S.myProfile = null;
  if (window.Auth.uid()) {
    try { S.myPid = await db().findMyProfile(); if (S.myPid) S.myProfile = await db(S.myPid).getProfile(S.myPid); } catch (e) {}
  }
  renderNav();
  if (reroute) route();
}
function needAuth(text, next) {
  if (window.Auth.uid()) { next(); return; }
  window.Auth.openSheet({ text, onDone: async () => { await refreshSession(false); next(); } });
}
async function saveGift(form) {
  const id = form.dataset.id, pid = S.myPid; if (!pid) return;
  const title = $('#f-title').value.trim();
  if (title.length < 2) { $('#f-title').classList.add('err'); $('#err-title').classList.add('show'); $('#f-title').focus(); return; }
  const btn = $('#gift-save'); btn.classList.add('loading');
  const old = id ? findGift(id, pid) : null, before = old ? clone(old) : null;
  const patch = {
    title, description: $('#f-desc').value.trim(), link: safeLink($('#f-link').value),
    price: $('#f-price').value ? Math.max(0, Math.min(1e9, Math.round(Number($('#f-price').value)))) : null,
    holiday: $('#f-holiday').value,
    customDate: $('#f-holiday').value === 'custom' ? ($('#f-date').value || null) : null,
    dream: $('#f-dream').checked, photo: formPhoto
  };
  try {
    if (id) { Object.assign(old, patch); renderAll(); await db(pid).updateGift(pid, id, patch); toast('Подарок обновлён ✨'); SND.play('pop'); }
    else {
      const maxOrder = S.gifts.reduce((m, g) => Math.max(m, g.order == null ? 0 : g.order), -1);
      const g = giftDoc(Object.assign({}, patch, { id:'g-' + rid(10), order:maxOrder + 1, createdAt:Date.now() }));
      S.gifts.push(g); renderAll(); await db(pid).addGift(pid, g); toast('Подарок в списке! 🎁'); SND.play('pop');
    }
    closeModal();
  } catch (e) {
    if (before && old) Object.assign(old, before); else S.gifts = S.gifts.filter(g => g.title !== title);
    renderAll(); btn.classList.remove('loading'); toast(friendly(e), { type:'err' }); SND.play('err');
  }
}
async function deleteGift(id, pid) {
  let g = findGift(id, pid);
  if (!g) { try { g = await db(pid).getGift(pid, id); } catch (e) {} }
  if (!g) return;
  const copy = clone(g); delete copy._pid;
  closeModal(); S.gifts = S.gifts.filter(x => x.id !== id); renderAll(); SND.play('del');
  try {
    await db(pid).deleteGift(pid, id);
    toast('Подарок удалён', { type:'info', dur:6000, action:{ label:'Вернуть', fn: async () => {
      try { await db(pid).restoreGift(pid, copy); S.gifts.push(copy); renderAll(); SND.play('pop'); } catch (e) { toast(friendly(e), { type:'err' }); }
    } } });
  } catch (e) { S.gifts.push(copy); renderAll(); toast(friendly(e), { type:'err' }); }
}
async function doReserve(form) {
  const id = form.dataset.id, pid = form.dataset.pid, name = $('#r-name').value.trim();
  if (name.length < 2) { $('#r-name').classList.add('err'); $('#err-rname').classList.add('show'); return; }
  let g = findGift(id, pid);
  if (!g) { try { g = await db(pid).getGift(pid, id); } catch (e) {} }
  if (!g) { toast('Подарок не найден', { type:'err' }); return; }
  const btn = $('#reserve-btn'), r = btn.getBoundingClientRect();
  btn.classList.add('loading'); LS.set('visitorName', name);
  const until = reserveUntil(g, S.profile);
  try {
    await db(pid).reserve(pid, id, { by: myUid(), name, until });
    const list = LS.get('res', []) || [];
    if (!list.some(e => e.pid === pid && e.gid === id && e.mode === modeOf(pid))) list.push({ pid, gid:id, mode:modeOf(pid), at:Date.now() });
    LS.set('res', list);
    g.reservedBy = myUid(); g.reservedByName = name; g.reservedAt = Date.now(); g.reservedUntil = until;
    closeModal(); renderAll(); CF.burst(r.left + r.width / 2, r.top); SND.play('ok');
    toast('Забронировано до ' + fmtShort(until) + '! Не забудьте купить 😉');
  } catch (e) {
    btn.classList.remove('loading'); toast(friendly(e), { type:'err' }); SND.play('err');
    try { S.gifts = await db(pid).gifts(pid); renderAll(); } catch (e2) {}
  }
}
function doRelease(id, pid) {
  openConfirm({ title:'Отменить бронь?', text:'Подарок снова станет свободным, и его сможет забронировать кто-то другой.', ok:'Снять бронь', danger:true, onOk: async () => {
    try {
      await db(pid).release(pid, id, myUid());
      LS.set('res', (LS.get('res', []) || []).filter(e => !(e.pid === pid && e.gid === id)));
      const g = findGift(id, pid);
      if (g) { g.reservedBy = null; g.reservedByName = null; g.reservedAt = null; g.reservedUntil = null; }
      closeModal(); SND.play('del'); toast('Бронь снята — подарок снова свободен', { type:'info' });
      if (S.route.name === 'res') renderRes(); else renderAll();
    } catch (e) { toast(friendly(e), { type:'err' }); }
  } });
}
function doResetLock(id, pid) {
  openConfirm({ title:'Снять чужую бронь?', text:'Кто-то уже готовит этот подарок. Если снимете бронь, он может об этом не узнать — лучше уточните лично 😉', ok:'Всё равно снять', danger:true, onOk: async () => {
    try { await db(pid).updateGift(pid, id, { reservedBy:null, reservedByName:null, reservedAt:null, reservedUntil:null }); closeModal(); SND.play('del'); toast('Бронь снята', { type:'info' }); }
    catch (e) { toast(friendly(e), { type:'err' }); }
  } });
}
async function persistOrder(pid, ids) {
  try { await db(pid).reorder(pid, ids); }
  catch (e) { toast(friendly(e), { type:'err' }); try { S.gifts = await db(pid).gifts(pid); renderAll(); } catch (e2) {} }
}
const manualArr = () => S.gifts.slice().sort((a, b) => (a.order == null ? a.createdAt : a.order) - (b.order == null ? b.createdAt : b.order));
function moveGift(id, dir) {
  const arr = manualArr(), i = arr.findIndex(g => g.id === id), j = i + dir;
  if (i < 0 || j < 0 || j >= arr.length) return;
  const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  arr.forEach((g, k) => { g.order = k; });
  S.gifts = arr; renderGrid(); persistOrder(S.myPid, arr.map(g => g.id));
}
async function saveProfile() {
  const create = !S.myProfile, name = $('#f-name').value.trim();
  if (name.length < 2) { $('#f-name').classList.add('err'); $('#err-name').classList.add('show'); return; }
  const btn = $('#profile-save'); btn.classList.add('loading');
  const data = { name, bio: $('#f-bio').value.trim(), birthday: $('#f-bday').value || null, avatar: formAvatar, ownerUid: myUid() };
  try {
    if (create) {
      const typed = $('#f-slug').value.trim();
      let slug = (typed || translit(name) || 'list-' + rid(6)).toLowerCase();
      if (!/^[a-z0-9-_]{3,24}$/.test(slug)) {
        if (typed) { $('#f-slug').classList.add('err'); $('#err-slug').classList.add('show'); btn.classList.remove('loading'); return; }
        slug = 'list-' + rid(6);
      }
      await db().createProfile(slug, data);
      LS.set(window.Auth.online() ? 'myPid.live' : 'myPid', slug);
      S.myPid = slug; S.myProfile = Object.assign({ id: slug, createdAt: Date.now() }, data);
      closeModal(); SND.play('ok'); CF.burst(innerWidth / 2, innerHeight / 3);
      toast('Профиль создан! 🎉', { dur:7000, action:{ label:'Скопировать ссылку', fn: () => copyText(shareUrl(slug)) } });
      route();
    } else {
      await db(S.myPid).updateProfile(S.myPid, data);
      Object.assign(S.myProfile, data); closeModal(); SND.play('pop'); toast('Профиль обновлён ✨'); route();
    }
  } catch (e) {
    btn.classList.remove('loading');
    if (String(e.code || '').indexOf('slug') > -1 && $('#err-slug')) { $('#f-slug').classList.add('err'); $('#err-slug').classList.add('show'); }
    toast(friendly(e), { type:'err' }); SND.play('err');
  }
}
async function doExport() {
  const pid = S.myPid || LS.get('myPid', null);
  if (!pid) { toast('Пока нечего сохранять — создайте профиль', { type:'info' }); return; }
  try {
    const im = db(pid), p = await im.getProfile(pid), gs = await im.gifts(pid);
    const pack = { app:'hotelki', version:1, profiles:[p], gifts:{} }; pack.gifts[pid] = gs;
    download('hotelki-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(pack, null, 2));
    toast('Резервная копия скачана 📦');
  } catch (e) { toast(friendly(e), { type:'err' }); }
}
async function doImport(file) {
  try {
    const d = JSON.parse(await file.text());
    if (d.app !== 'hotelki' || !Array.isArray(d.profiles)) throw new Error('Это не файл Хотелок');
    let np = 0, ng = 0, firstPid = null;
    d.profiles.forEach(p => {
      if (!p || !p.id || p.id === EX || L.profiles[p.id]) return;
      p.ownerUid = Local.uid(); L.profiles[p.id] = p; np++; if (!firstPid) firstPid = p.id;
      ((d.gifts || {})[p.id] || []).forEach(g => {
        if (!g || !g.id) return;
        if (!L.gifts[p.id]) L.gifts[p.id] = {};
        L.gifts[p.id][g.id] = giftDoc(g); ng++;
      });
    });
    persist();
    if (!LS.get('myPid', null) && firstPid) LS.set('myPid', firstPid);
    closeModal(); SND.play('ok'); toast('Загружено: профилей ' + np + ', подарков ' + ng + ' 📥');
    await refreshSession(true);
  } catch (e) { toast(e.message || 'Не удалось прочитать файл', { type:'err' }); }
}
function doMigrate() {
  const pid = LS.get('myPid', null), p = pid ? L.profiles[pid] : null;
  if (!window.Auth.online() || !p) { toast('Нет локального списка для переноса', { type:'info' }); return; }
  openConfirm({ title:'Перенести в Firebase?', text:'Локальный профиль и подарки переедут в общую базу. Брони не переносятся — список станет свободным.', ok:'Перенести', onOk: async () => {
    try {
      let target = pid;
      const ex = await pRef(target).get(); if (ex.exists) target = pid + '-' + rid(3);
      await Live.createProfile(target, { name:p.name, bio:p.bio || '', birthday:p.birthday || null, avatar:p.avatar || null, ownerUid: window.Auth.uid() });
      const gs = await Local.gifts(pid);
      for (let i = 0; i < gs.length; i++) {
        const g = gs[i]; g.reservedBy = null; g.reservedByName = null; g.reservedAt = null; g.reservedUntil = null;
        await Live.addGift(target, giftDoc(g));
      }
      LS.set('myPid.live', target); S.myPid = target; S.myProfile = null;
      closeModal(); SND.play('ok'); CF.burst(innerWidth / 2, innerHeight / 3);
      toast('Перенесено ' + gs.length + ' подарков ✅'); route();
    } catch (e) { toast(friendly(e), { type:'err' }); }
  } });
}
function doExampleReset() {
  openConfirm({ title:'Сбросить пример списка?', text:'Пример вернётся к исходному виду. Ваш собственный список не пострадает.', ok:'Сбросить', danger:true, onOk: () => {
    const s = seedExample(); L.profiles[EX] = s.profile; L.gifts[EX] = s.gifts;
    LS.set('res', (LS.get('res', []) || []).filter(e => e.pid !== EX));
    persist(); closeModal(); toast('Пример сброшен 🔄'); route();
  } });
}
async function doShare(pid) {
  const url = shareUrl(pid);
  if (navigator.share) { try { await navigator.share({ title:'Мой список подарков — ' + SITE, text:'Выбери и забронируй подарок 🎁', url }); } catch (e) {} }
  else copyText(url);
}
async function doLinkGoogle() {
  try {
    const r = await window.Auth.linkGoogle();
    if (r === 'redirect') return;
    SND.play('ok'); CF.burst(innerWidth / 2, innerHeight / 3);
    toast(r === 'switched' ? 'Вы вошли в существующий аккаунт Google' : 'Google привязан — список теперь с вами везде 🎉', { dur:6000 });
    await refreshSession(true);
  } catch (e) { toast(window.Auth.friendly(e), { type:'err', dur:7000 }); }
}

/* ================= 12. СОБЫТИЯ / РОУТЕР / СТАРТ ================= */
const ACTIONS = {
  'sound': () => { SND.on = !SND.on; LS.set('sound', SND.on ? '1' : '0'); renderNav(); const s = $('#set-sound'); if (s) s.checked = SND.on; if (SND.on) SND.play('pop'); },
  'theme-mode': () => { window.Theme.toggleMode(); SND.play('pop'); },
  'set-mode': el => { window.Theme.setMode(el.dataset.v); SND.play('pop'); openSettings(); },
  'set-style': el => { window.Theme.setStyle(el.dataset.v); SND.play('pop'); openSettings(); },
  'settings': () => { menuOpen = false; openSettings(); },
  'account': () => { menuOpen = !menuOpen; const m = $('#acct-menu'); if (m) m.hidden = !menuOpen; },
  'sign-in': () => { menuOpen = false; window.Auth.openSheet({ onDone: () => refreshSession(true) }); },
  'sign-out': () => {
    menuOpen = false;
    openConfirm({ title:'Выйти из аккаунта?', text: window.Auth.isGuest() ? 'Вы входили как гость. Список останется в базе, но чтобы вернуться к нему с другого устройства, нужен Google. В этом браузере вы сможете войти снова как гость.' : 'Вы сможете войти снова в любой момент — список сохранится.', ok:'Выйти', danger:true, onOk: async () => {
      try { await window.Auth.signOut(); toast('Вы вышли', { type:'info' }); await refreshSession(true); } catch (e) { toast(friendly(e), { type:'err' }); }
    } });
  },
  'link-google': () => { menuOpen = false; doLinkGoogle(); },
  'close-modal': () => closeModal(),
  'close-confirm': () => closeConfirm(),
  'confirm-ok': async () => { const cb = confirmCb; closeConfirm(); if (cb) await cb(); },
  'reload': () => route(),
  'create-profile': () => needAuth('Войдите, чтобы создать свой список подарков. Google — чтобы список был с вами на всех устройствах, гость — чтобы просто попробовать.', () => openProfileForm()),
  'edit-profile': () => openProfileForm(),
  'add-gift': () => needAuth('Войдите, чтобы добавлять подарки в свой список.', () => { if (!S.myPid) openProfileForm(); else openGiftForm(null); }),
  'edit-gift': el => { const g = findGift(el.dataset.id, pidOf(el)); if (g) openGiftForm(g); },
  'del-gift': el => deleteGift(el.dataset.id, pidOf(el) || S.myPid),
  'detail': el => { const pid = pidOf(el) || S.myPid; const g = findGift(el.dataset.id, pid); if (g) openDetail(g, pid); },
  'reserve': el => {
    const pid = pidOf(el), id = el.dataset.id;
    needAuth('Чтобы забронировать подарок, представьтесь — имя увидит только сам даритель, автор списка узнает лишь то, что подарок занят.', async () => {
      let g = findGift(id, pid);
      if (!g) { try { g = await db(pid).getGift(pid, id); } catch (e) {} }
      if (g) openReserve(g, pid);
    });
  },
  'release': el => doRelease(el.dataset.id, pidOf(el)),
  'reset-lock': el => doResetLock(el.dataset.id, pidOf(el)),
  'res-forget': el => { LS.set('res', (LS.get('res', []) || []).filter(x => !(x.pid === el.dataset.pid && x.gid === el.dataset.id))); renderRes(); },
  'move': el => moveGift(el.dataset.id, Number(el.dataset.dir)),
  'chip': el => { S.filterH = el.dataset.h; renderChips(); renderGrid(); },
  'clear-filters': () => { S.q = ''; S.filterH = 'all'; const s = $('[data-input="search"]'); if (s) s.value = ''; renderChips(); renderGrid(); },
  'copy-link': el => copyText(shareUrl(pidOf(el))),
  'share-link': el => doShare(pidOf(el)),
  'photo-pick': () => { const f = $('#file-gift-photo'); if (f) f.click(); },
  'photo-remove': () => { formPhoto = null; const d = $('#dropzone'); if (d) d.innerHTML = dzHtml(null); },
  'avatar-pick': () => { const f = $('#file-avatar'); if (f) f.click(); },
  'avatar-remove': () => { formAvatar = null; refreshAvatarPreview(); },
  'copy-rules': () => copyText(RULES),
  'data-export': () => doExport(),
  'data-import': () => { const f = $('#file-import'); if (f) f.click(); },
  'data-migrate': () => doMigrate(),
  'demo-reset': () => doExampleReset(),
  'adm-example': () => { location.hash = '#/u/' + EX; },
  'adm-copy-uid': () => copyText((window.Auth.user() || {}).uid || ''),
  'adm-copy-cfg': () => copyText(window.Admin.configText()),
  'adm-download-cfg': () => download('config.js', window.Admin.configText(), 'text/javascript')
};

function bindEvents() {
  document.addEventListener('click', async e => {
    const a = e.target.closest ? e.target.closest('a[href]') : null;
    const el = e.target.closest ? e.target.closest('[data-action]') : null;
    if (menuOpen && !(e.target.closest && e.target.closest('.acct-wrap'))) { menuOpen = false; const m = $('#acct-menu'); if (m) m.hidden = true; }
    if (a && a !== el) { menuOpen = false; const m = $('#acct-menu'); if (m) m.hidden = true; return; }
    if (e.target.hasAttribute && e.target.hasAttribute('data-mback')) { closeModal(); return; }
    if (e.target.hasAttribute && e.target.hasAttribute('data-cback')) { closeConfirm(); return; }
    if (!el) return;
    const fn = ACTIONS[el.dataset.action]; if (!fn) return;
    e.preventDefault();
    try { await fn(el); } catch (err) { console.error(err); toast(friendly(err), { type:'err' }); }
  });
  const searchRun = debounce(() => renderGrid(), 140);
  document.addEventListener('input', e => {
    const t = e.target, k = t.dataset ? t.dataset.input : null;
    if (k === 'search') { S.q = t.value; searchRun(); }
    else if (k === 'bio') { const c = $('#bio-cnt'); if (c) c.textContent = t.value.length; }
    else if (k === 'slug') { t.value = t.value.toLowerCase().replace(/[^a-z0-9-_]/g, ''); t.dataset.touched = '1'; t.classList.remove('err'); const er = $('#err-slug'); if (er) er.classList.remove('show'); }
    else if (k === 'name') {
      t.classList.remove('err'); const er = $('#err-name'); if (er) er.classList.remove('show');
      const sl = $('#f-slug'); if (sl && !sl.dataset.touched && !S.myProfile) sl.value = translit(t.value);
      refreshAvatarPreview();
    }
    if (t.id === 'f-title') { t.classList.remove('err'); const er = $('#err-title'); if (er) er.classList.remove('show'); }
    if (t.id === 'r-name') { t.classList.remove('err'); const er = $('#err-rname'); if (er) er.classList.remove('show'); }
  });
  document.addEventListener('change', async e => {
    const t = e.target, k = t.dataset ? t.dataset.change : null;
    if (k === 'sort') { S.sort = t.value; LS.set(S.route.name === 'home' ? 'sort.owner' : 'sort.visitor', t.value); renderGrid(); }
    else if (k === 'style') { window.Theme.setStyle(t.value); SND.play('pop'); }
    else if (k === 'sound') { SND.on = t.checked; LS.set('sound', t.checked ? '1' : '0'); renderNav(); if (t.checked) SND.play('pop'); }
    else if (k === 'holiday') { const r = $('#row-date'); if (r) r.style.display = t.value === 'custom' ? 'block' : 'none'; }
    else if (t.id === 'file-gift-photo' && t.files[0]) {
      try { formPhoto = await fileToDataUrl(t.files[0], 1000, 640000); $('#dropzone').innerHTML = dzHtml(formPhoto); SND.play('pop'); } catch (err) { toast(err.message, { type:'err' }); }
      t.value = '';
    }
    else if (t.id === 'file-avatar' && t.files[0]) {
      try { formAvatar = await fileToDataUrl(t.files[0], 256, 180000); refreshAvatarPreview(); SND.play('pop'); } catch (err) { toast(err.message, { type:'err' }); }
      t.value = '';
    }
    else if (t.id === 'file-import' && t.files[0]) { doImport(t.files[0]); t.value = ''; }
  });
  document.addEventListener('submit', e => {
    const id = e.target.id;
    if (id === 'form-gift') { e.preventDefault(); saveGift(e.target); }
    else if (id === 'form-profile') { e.preventDefault(); saveProfile(); }
    else if (id === 'form-reserve') { e.preventDefault(); doReserve(e.target); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (menuOpen) { menuOpen = false; const m = $('#acct-menu'); if (m) m.hidden = true; return; }
      if ($('#confirm-root').children.length) closeConfirm(); else closeModal();
    }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('gift')) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener('dragstart', e => {
    const c = e.target.closest ? e.target.closest('.gift[draggable="true"]') : null;
    if (!c) return;
    dragId = c.dataset.id; c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
  });
  document.addEventListener('dragend', () => { dragId = null; $$('.gift').forEach(c => c.classList.remove('dragging', 'drop-hint')); });
  document.addEventListener('dragover', e => {
    const dz = e.target.closest ? e.target.closest('#dropzone') : null;
    if (dz) { e.preventDefault(); dz.classList.add('drag'); return; }
    const c = e.target.closest ? e.target.closest('.gift[draggable="true"]') : null;
    if (c && dragId && c.dataset.id !== dragId) { e.preventDefault(); $$('.gift').forEach(x => x.classList.remove('drop-hint')); c.classList.add('drop-hint'); }
  });
  document.addEventListener('dragleave', e => { const dz = e.target.closest ? e.target.closest('#dropzone') : null; if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('drag'); });
  document.addEventListener('drop', async e => {
    const dz = e.target.closest ? e.target.closest('#dropzone') : null;
    if (dz) {
      e.preventDefault(); dz.classList.remove('drag');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { try { formPhoto = await fileToDataUrl(f, 1000, 640000); $('#dropzone').innerHTML = dzHtml(formPhoto); SND.play('pop'); } catch (err) { toast(err.message, { type:'err' }); } }
      return;
    }
    const c = e.target.closest ? e.target.closest('.gift[draggable="true"]') : null;
    if (c && dragId && c.dataset.id !== dragId) {
      e.preventDefault();
      const arr = manualArr(), from = arr.findIndex(g => g.id === dragId), to = arr.findIndex(g => g.id === c.dataset.id);
      if (from > -1 && to > -1) {
        const mv = arr.splice(from, 1)[0]; arr.splice(to, 0, mv);
        arr.forEach((g, k) => { g.order = k; });
        S.gifts = arr; renderGrid(); persistOrder(S.myPid, arr.map(g => g.id));
      }
    }
    dragId = null; $$('.gift').forEach(x => x.classList.remove('dragging', 'drop-hint'));
  });
  window.addEventListener('dragover', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') > -1) e.preventDefault(); });
  window.addEventListener('drop', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') > -1 && !(e.target.closest && e.target.closest('#dropzone'))) e.preventDefault(); });
  window.addEventListener('hashchange', route);
  window.addEventListener('storage', e => { if (e.key === 'hotelki.db') { L = LS.get('db', L); notifyLocal(); if (S.route.name === 'res') renderRes(); } });
}

async function route() {
  cleanups.forEach(f => { try { f(); } catch (e) {} });
  cleanups = []; closeModal(true); closeConfirm(); menuOpen = false;
  const t = ++token, h = location.hash || '#/';
  const m = h.match(/^#\/u\/([a-zA-Z0-9_-]+)/);
  S.route = m ? { name:'public', pid:m[1] }
    : h.indexOf('#/reservations') === 0 ? { name:'res' }
    : h.indexOf('#/admin') === 0 ? { name:'admin' } : { name:'home' };
  S.q = ''; S.filterH = 'all'; S.gifts = []; S.profile = null;
  window.scrollTo(0, 0); renderNav();
  try {
    if (S.route.name === 'home') await renderHome();
    else if (S.route.name === 'public') await renderPublic(S.route.pid);
    else if (S.route.name === 'res') await renderRes();
    else {
      if (!window.Auth.uid()) {
        $('#app').innerHTML = '<div class="empty card"><div class="emo">🔐</div><h3>Только для владельца</h3><p>Войдите, чтобы открыть панель управления.</p><button class="btn primary big" data-action="sign-in">' + icon('user', 18) + ' Войти</button></div>';
        revealAll();
      } else if (window.Admin && window.Admin.canAccess()) await window.Admin.render($('#app'));
      else {
        $('#app').innerHTML = '<div class="empty card"><div class="emo">🚫</div><h3>Доступ закрыт</h3><p>Эта страница только для владельца сайта.</p><a class="btn primary" href="#/">' + icon('home', 16) + ' На главную</a></div>';
        revealAll();
      }
    }
  } catch (e) {
    if (t !== token) return;
    console.error(e);
    $('#app').innerHTML = '<div class="empty card"><div class="emo">🛠️</div><h3>Что-то пошло не так</h3><p>' + esc(friendly(e)) + '</p><button class="btn primary" data-action="reload">Попробовать снова</button></div>';
    revealAll();
  }
}

window.Hotelki = {
  ui: { openModal, closeModal, openConfirm, toast, icon, esc, avaHtml, money, fmtDate },
  state: S, db, myUid, isReserved, giftDoc, local: Local, live: Live, LS, rules: RULES,
  refresh: () => refreshSession(true), route, reveal: revealAll, exampleId: EX, site: SITE,
  registerActions: o => Object.assign(ACTIONS, o)
};

async function boot() {
  FX.init(); CF.init(); bindEvents();
  window.Theme.init();
  window.Theme.onChange(() => { FX.sync(); renderNav(); });
  FX.sync(); renderNav();
  await window.Auth.init();
  window.Auth.onChange(() => { refreshSession(true); });
  await refreshSession(false);
  route();
  const e = window.Auth.error();
  if (e && window.Auth.online()) toast(window.Auth.friendly(e), { type:'err', dur:8000 });
}
boot();
})();