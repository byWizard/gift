/* ============================================================
   admin.js — скрытая панель владельца:  #/admin
   ============================================================ */
(function () {
'use strict';
const H = () => window.Hotelki;
const A = () => window.Auth;

function isAdmin() {
  const c = window.HotelkiConfig || {}, u = A().user();
  if (!u) return false;
  const em = (c.adminEmails || []).map(x => String(x).toLowerCase());
  const ids = c.adminUids || [];
  if (!em.length && !ids.length) return true;           // режим первой настройки
  return (u.email && em.indexOf(u.email.toLowerCase()) > -1) || ids.indexOf(u.uid) > -1;
}
function setupMode() {
  const c = window.HotelkiConfig || {};
  return !(c.adminEmails || []).length && !(c.adminUids || []).length;
}
function configText() {
  const u = A().user() || {}, cfg = A().cfg();
  const c = window.HotelkiConfig || {};
  const emails = (c.adminEmails || []).slice();
  if (u.email && emails.indexOf(u.email) < 0) emails.push(u.email);
  const ids = (c.adminUids || []).slice();
  if (u.uid && ids.indexOf(u.uid) < 0) ids.push(u.uid);
  return 'window.HotelkiConfig = {\n' +
    "  siteName: '" + (c.siteName || 'Хотелки') + "',\n\n" +
    '  firebase: ' + (cfg ? JSON.stringify(cfg, null, 2).replace(/\n/g, '\n  ') : 'null') + ',\n\n' +
    '  adminEmails: ' + JSON.stringify(emails) + ',\n' +
    '  adminUids: ' + JSON.stringify(ids) + ',\n\n' +
    '  allowGuests: ' + (c.allowGuests !== false) + ',\n' +
    '  showExample: ' + (c.showExample !== false) + '\n};\n';
}

async function render(root) {
  const h = H(), ui = h.ui, u = A().user() || {}, online = A().online();
  const host = location.hostname;
  const needDomain = host && host !== 'localhost' && host !== '127.0.0.1' && host.indexOf('firebaseapp') < 0 && host.indexOf('web.app') < 0;
  let profiles = '—', gifts = '—';
  if (online) {
    try { const r = await A().fs().collection('profiles').get(); profiles = r.size; } catch (e) { profiles = 'нет доступа'; }
    if (h.state.myPid) { try { const g = await h.db(h.state.myPid).gifts(h.state.myPid); gifts = g.length; } catch (e) {} }
  } else {
    profiles = Object.keys(h.local._all ? h.local._all() : {}).length || '—';
  }
  const err = A().error();

  root.innerHTML =
    '<h1 class="page-title reveal">Панель владельца</h1>' +
    '<p class="page-sub reveal">Эту страницу видите только вы. Обычные посетители не видят ни настроек Firebase, ни служебной информации.</p>' +
    (setupMode() ? '<div class="banner demo reveal">' + ui.icon('alert', 17) + '<span><b>Режим первой настройки.</b> Пока списки админов пусты, панель открыта любому вошедшему. Скопируйте готовый <b>config.js</b> ниже (там уже вписаны ваши почта и UID) и замените им файл — после этого доступ будет только у вас.</span></div>' : '') +
    (err ? '<div class="banner demo reveal">' + ui.icon('alert', 17) + '<span>Ошибка подключения: ' + ui.esc(A().friendly(err)) + '</span></div>' : '') +
    '<div class="adm-grid">' +

      '<section class="card adm-card reveal"><h3>' + ui.icon('cloud', 18) + ' Подключение</h3>' +
        '<div class="adm-row"><span class="k">База данных</span><span class="v"><span class="adm-pill ' + (online ? 'ok' : 'no' ) + '">' + (online ? 'Firebase подключён' : 'Автономно (только этот браузер)') + '</span></span></div>' +
        '<div class="adm-row"><span class="k">Проект</span><span class="v">' + ui.esc(A().project() || '—') + '</span></div>' +
        '<div class="adm-row"><span class="k">Источник конфига</span><span class="v">' + ((window.HotelkiConfig || {}).firebase ? 'config.js' : (A().cfg() ? 'память браузера' : 'нет')) + '</span></div>' +
        '<div class="adm-row"><span class="k">Домен сайта</span><span class="v">' + ui.esc(host || 'локальный файл') + '</span></div>' +
        '<div class="adm-row"><span class="k">Профилей в базе</span><span class="v">' + profiles + '</span></div>' +
        '<div class="adm-row"><span class="k">Подарков в моём списке</span><span class="v">' + gifts + '</span></div>' +
        (needDomain ? '<p class="adm-note">Не забудьте добавить <b>' + ui.esc(host) + '</b> в Firebase → Authentication → Settings → <b>Authorized domains</b>, иначе вход не сработает.</p>' : '') +
        '<p class="adm-note">Провайдеры входа: Firebase → Authentication → Sign-in method → <bGoogle>Google</b> и <b>Anonymous</b> должны быть включены.</p>' +
      '</section>' +

      '<section class="card adm-card reveal" style="--d:80ms"><h3>' + ui.icon('eye', 18) + ' Ваш аккаунт</h3>' +
        '<div class="adm-row"><span class="k">Тип</span><span class="v">' + (u.isGuest ? 'Гость (анонимный)' : 'Google') + '</span></div>' +
        '<div class="adm-row"><span class="k">Имя</span><span class="v">' + ui.esc(u.name || '—') + '</span></div>' +
        '<div class="adm-row"><span class="k">Почта</span><span class="v">' + ui.esc(u.email || '—') + '</span></div>' +
        '<div class="adm-row"><span class="k">UID</span><span class="v" style="font-size:11.5px">' + ui.esc(u.uid || '—') + '</span></div>' +
        '<div class="data-btns" style="margin-top:12px"><button class="btn ghost sm" data-action="adm-copy-uid">' + ui.icon('copy', 14) + ' Скопировать UID</button>' +
        '<a class="btn ghost sm" href="https://console.firebase.google.com/" target="_blank" rel="noopener">' + ui.icon('ext', 14) + ' Консоль Firebase</a></div>' +
        (u.isGuest ? '<p class="adm-note">Совет: привяжите Google (меню аккаунта → «Привязать Google»), чтобы админка открывалась с любого устройства.</p>' : '') +
      '</section>' +

      '<section class="card adm-card reveal" style="--d:160ms;grid-column:1/-1"><h3>' + ui.icon('sliders', 18) + ' Готовый config.js</h3>' +
        '<p class="adm-note" style="margin:0 0 10px">Замените содержимое файла <b>config.js</b> этим текстом — Firebase и права админа будут зашиты в проект, а не в память браузера.</p>' +
        '<textarea class="inp adm-code" id="adm-cfg" readonly>' + ui.esc(configText()) + '</textarea>' +
        '<div class="data-btns" style="margin-top:10px"><button class="btn primary sm" data-action="adm-copy-cfg">' + ui.icon('copy', 14) + ' Скопировать config.js</button>' +
        '<button class="btn ghost sm" data-action="adm-download-cfg">' + ui.icon('dl', 14) + ' Скачать файл</button></div>' +
      '</section>' +

      '<section class="card adm-card reveal" style="--d:240ms;grid-column:1/-1"><h3>' + ui.icon('lock', 18) + ' Правила Firestore</h3>' +
        '<p class="adm-note" style="margin:0 0 10px">Firestore Database → вкладка <b>Rules</b> → вставить → <b>Publish</b>. Правила разрешают всем смотреть списки, менять свои подарки и бронировать чужие.</p>' +
        '<pre class="rules-pre">' + ui.esc(h.rules) + '</pre>' +
        '<div class="data-btns" style="margin-top:10px"><button class="btn ghost sm" data-action="copy-rules">' + ui.icon('copy', 14) + ' Скопировать правила</button></div>' +
      '</section>' +

      '<section class="card adm-card reveal" style="--d:320ms;grid-column:1/-1"><h3>' + ui.icon('dl', 18) + ' Данные и обслуживание</h3>' +
        '<div class="data-btns">' +
          '<button class="btn ghost sm" data-action="data-export">' + ui.icon('dl', 14) + ' Экспорт моего списка</button>' +
          '<button class="btn ghost sm" data-action="data-import">' + ui.icon('ul', 14) + ' Импорт JSON</button>' +
          (online && h.LS.get('myPid', null) ? '<button class="btn primary sm" data-action="data-migrate">' + ui.icon('cloud', 14) + ' Перенести локальный список в Firebase</button>' : '') +
          '<button class="btn ghost sm" data-action="adm-example">' + ui.icon('gift', 14) + ' Открыть пример списка</button>' +
          '<button class="btn danger sm" data-action="demo-reset">' + ui.icon('trash', 14) + ' Сбросить пример списка</button>' +
        '</div>' +
        '<input type="file" id="file-import" accept=".json,application/json" hidden>' +
        '<p class="adm-note">Ссылка на сайт: <b>' + ui.esc(location.href.split('#')[0]) + '</b> · ссылка на ваш список: <b>' + ui.esc(h.state.myPid ? (location.href.split('#')[0] + '#/u/' + h.state.myPid) : 'ещё не создан') + '</b></p>' +
      '</section>' +
    '</div>';
  h.reveal();
}

window.Admin = { canAccess: isAdmin, render: render, configText: configText, setupMode: setupMode };
})();