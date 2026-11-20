/* ============================================================
   theme.js — стиль праздника × светлая/тёмная тема
   ============================================================ */
(function () {
'use strict';
const KEY = 'hotelki.theme2';
const MODES = { auto:{ n:'Авто', e:'🌗' }, light:{ n:'Светлая', e:'☀️' }, dark:{ n:'Тёмная', e:'🌙' } };
const STYLES = {
  auto:     { n:'Авто',       e:'✨', d:['var(--acc)','var(--acc2)','var(--bg)'] },
  business: { n:'Деловой',    e:'💼', d:['#0e7a5c','#bf8712','#1b2431'] },
  newyear:  { n:'Новогодний', e:'🎄', d:['#e5484d','#f2c14e','#1f6b4a'] },
  love:     { n:'Романтика',  e:'💘', d:['#ff4d84','#c084fc','#f6d9e2'] },
  spring:   { n:'Весенний',   e:'🌷', d:['#ff6b8a','#6fcf7f','#e5ebd5'] }
};
const subs = [];
let pref = { mode:'dark', style:'auto' };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.mode && s.style) pref = s; } catch (e) {}

const mqLight = window.matchMedia ? matchMedia('(prefers-color-scheme: light)') : null;
function styleByDate() {
  const n = new Date(), m = n.getMonth() + 1, d = n.getDate();
  if (m === 12 || (m === 1 && d <= 14)) return 'newyear';
  if (m === 2 && d >= 7 && d <= 15) return 'love';
  if (m === 3 && d <= 9) return 'spring';
  return 'business';
}
const resolveStyle = p => p === 'auto' ? styleByDate() : p;
const resolveMode = p => p === 'auto' ? (mqLight && mqLight.matches ? 'light' : 'dark') : p;

function apply() {
  const st = resolveStyle(pref.style), md = resolveMode(pref.mode);
  const html = document.documentElement;
  html.removeAttribute('data-theme');
  html.dataset.style = st;
  html.dataset.mode = md;
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
  setTimeout(() => {
    try { meta.content = getComputedStyle(html).getPropertyValue('--bg').trim() || '#0f151d'; } catch (e) {}
    subs.forEach(f => { try { f(st, md); } catch (e) {} });
  }, 0);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch (e) {} }

window.Theme = {
  MODES, STYLES,
  init() {
    apply();
    if (mqLight) {
      const h = () => { if (pref.mode === 'auto') apply(); };
      if (mqLight.addEventListener) mqLight.addEventListener('change', h); else if (mqLight.addListener) mqLight.addListener(h);
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && pref.style === 'auto') apply(); });
  },
  onChange(f) { subs.push(f); },
  modePref: () => pref.mode,
  stylePref: () => pref.style,
  mode: () => resolveMode(pref.mode),
  style: () => resolveStyle(pref.style),
  setMode(m) { if (!MODES[m]) return; pref.mode = m; save(); apply(); },
  setStyle(s) { if (!STYLES[s]) return; pref.style = s; save(); apply(); },
  toggleMode() { this.setMode(this.mode() === 'dark' ? 'light' : 'dark'); },
  fx() {
    const cs = getComputedStyle(document.documentElement);
    return {
      a: (cs.getPropertyValue('--fx-a') || '#ffffff').trim(),
      b: (cs.getPropertyValue('--fx-b') || '#ffffff').trim(),
      op: parseFloat(cs.getPropertyValue('--fx-op')) || 0.6
    };
  }
};
})();