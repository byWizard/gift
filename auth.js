/* ============================================================
   auth.js — вход через Google и как гость (Firebase Auth)
   ============================================================ */
(function () {
'use strict';
const SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
const LS = {
  get(k, d) { try { const v = localStorage.getItem('hotelki.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('hotelki.' + k, JSON.stringify(v)); } catch (e) {} }
};
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = false;
    s.onload = res; s.onerror = () => rej(new Error('Не загрузился Firebase SDK — проверьте интернет'));
    document.head.appendChild(s);
  });
}
function resolveCfg() {
  const c = window.HotelkiConfig || {};
  if (c.firebase && c.firebase.apiKey && c.firebase.projectId) return c.firebase;
  const old = LS.get('fbconfig', null);
  if (old && old.apiKey && old.projectId) return old;
  return null;
}
const mapUser = u => u ? { uid:u.uid, name:u.displayName || '', email:u.email || '', photo:u.photoURL || '', isGuest:!!u.isAnonymous } : null;

const Auth = {
  _fb: null, _auth: null, _user: null, _subs: [], _cfg: null, _err: null, _local: false,

  async init() {
    this._cfg = resolveCfg();
    if (!this._cfg) { this._local = true; this._user = this._localUser(); return; }
    try {
      if (!window.firebase || !window.firebase.auth) {
        await loadScript(SDK + 'firebase-app-compat.js');
        await loadScript(SDK + 'firebase-auth-compat.js');
        await loadScript(SDK + 'firebase-firestore-compat.js');
      }
      const app = window.firebase.initializeApp(this._cfg, 'hotelki-auth');
      const auth = app.auth();
      this._auth = auth;
      try { await auth.getRedirectResult(); } catch (e) { this._err = e; }
      await new Promise(res => { const un = auth.onAuthStateChanged(() => { un(); res(); }); });
      this._user = mapUser(auth.currentUser);
      this._fb = { app, fs: app.firestore(), project: this._cfg.projectId };
      auth.onAuthStateChanged(u => {
        const before = this._user ? this._user.uid : null;
        this._user = mapUser(u);
        const after = this._user ? this._user.uid : null;
        if (before !== after || (u && u.isAnonymous !== undefined)) this._subs.forEach(f => { try { f(this._user); } catch (e) {} });
      });
    } catch (e) { this._err = e; this._local = true; this._user = this._localUser(); }
  },

  _localUser() {
    let uid = LS.get('uid', null);
    if (!uid) { uid = 'u-' + Math.random().toString(36).slice(2, 12); LS.set('uid', uid); }
    return { uid, name: LS.get('localName', 'Гость'), email:'', photo:'', isGuest:true, local:true };
  },

  onChange(f) { this._subs.push(f); },
  user() { return this._user; },
  uid() { return this._user ? this._user.uid : null; },
  isGuest() { return !!this._user && this._user.isGuest; },
  online() { return !!this._fb; },
  local() { return this._local; },
  fb() { return this._fb; },
  fs() { return this._fb ? this._fb.fs : null; },
  project() { return this._fb ? this._fb.project : (this._cfg ? this._cfg.projectId : null); },
  cfg() { return this._cfg; },
  error() { return this._err; },

  _provider() {
    const p = new window.firebase.auth.GoogleAuthProvider();
    p.setCustomParameters({ prompt: 'select_account' });
    return p;
  },
  _silent(e) {
    const c = String(e && e.code || '');
    return c.indexOf('popup-closed-by-user') > -1 || c.indexOf('cancelled-popup-request') > -1;
  },
  async _popupOrRedirect(method) {
    const p = this._provider();
    try { return await this._auth[method](p); }
    catch (e) {
      const c = String(e && e.code || '');
      if (c.indexOf('popup-blocked') > -1 || c.indexOf('operation-not-supported') > -1 || c.indexOf('web-storage-unsupported') > -1) {
        await this._auth.signInWithRedirect(p); return null;
      }
      throw e;
    }
  },
  async google() {
    if (!this._auth) throw new Error('Вход через Google заработает, когда владелец подключит Firebase (см. #/admin)');
    return await this._popupOrRedirect('signInWithPopup');
  },
  async guest() {
    if (!this._auth) { this._user = this._localUser(); this._subs.forEach(f => f(this._user)); return; }
    if (this._auth.currentUser && this._auth.currentUser.isAnonymous) { this._user = mapUser(this._auth.currentUser); return; }
    await this._auth.signInAnonymously();
  },
  async linkGoogle() {
    if (!this._auth || !this._auth.currentUser) throw new Error('Сначала войдите');
    const p = this._provider();
    try { const r = await this._auth.currentUser.linkWithPopup(p); this._user = mapUser(r.user); this._subs.forEach(f => f(this._user)); return 'linked'; }
    catch (e) {
      const c = String(e && e.code || '');
      if (c.indexOf('popup-blocked') > -1 || c.indexOf('operation-not-supported') > -1) { await this._auth.currentUser.linkWithRedirect(p); return 'redirect'; }
      if (c.indexOf('credential-already-in-use') > -1 || c.indexOf('email-already-in-use') > -1) {
        if (e.credential) { await this._auth.signInWithCredential(e.credential); return 'switched'; }
        await this._auth.signInWithPopup(p); return 'switched';
      }
      throw e;
    }
  },
  async signOut() {
    if (this._auth) { await this._auth.signOut(); this._user = null; }
    else { this._user = null; }
    this._subs.forEach(f => { try { f(null); } catch (e) {} });
  },

  friendly(e) {
    const c = String(e && (e.code || e.message) || '');
    if (c.indexOf('operation-not-allowed') > -1) return 'Провайдер не включён: Firebase → Authentication → Sign-in method → включите Google и Anonymous';
    if (c.indexOf('unauthorized-domain') > -1) return 'Домен не разрешён: Firebase → Authentication → Settings → Authorized domains → добавьте ' + location.hostname;
    if (c.indexOf('popup-blocked') > -1) return 'Браузер заблокировал окно входа — разрешите всплывающие окна для этого сайта';
    if (c.indexOf('network') > -1) return 'Нет связи с интернетом';
    if (c.indexOf('account-exists-with-different-credential') > -1) return 'Эта почта уже используется другим способом входа';
    return (e && e.message) || 'Не удалось войти';
  },

  /* экран входа */
  openSheet(o) {
    o = o || {};
    const ui = window.Hotelki.ui, cfg = window.HotelkiConfig || {};
    const G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
    ui.openModal(
      '<div class="m-head" style="margin-bottom:6px"><span style="flex:1"></span><button class="ibtn" data-action="close-modal" aria-label="Закрыть">' + ui.icon('x', 17) + '</button></div>' +
      '<div class="auth-hero"><div class="auth-orb">' + ui.icon('gift', 34) + '</div>' +
      '<h2>' + ui.esc(o.title || 'Вход в Хотелки') + '</h2>' +
      '<p>' + ui.esc(o.text || 'Войдите, чтобы собрать свой список подарков и бронировать подарки для друзей.') + '</p></div>' +
      '<button class="auth-btn gg" id="auth-google">' + G + ' Продолжить с Google</button>' +
      (cfg.allowGuests !== false ? '<div class="auth-or">или</div><button class="auth-btn guest" id="auth-guest">' + ui.icon('eye', 19) + ' Войти как гость</button>' : '') +
      '<div class="auth-perks">' +
        '<div>' + ui.icon('check', 15) + '<span><b>Google</b> — список привязан к аккаунту: откроете с телефона или другого компьютера, он на месте.</span></div>' +
        '<div>' + ui.icon('check', 15) + '<span><b>Гость</b> — без регистрации и почты, всё работает сразу. Позже можно привязать Google в один клик.</span></div>' +
        '<div>' + ui.icon('lock', 15) + '<span>Автор списка не видит, кто забронировал подарок — сюрприз сохраняется.</span></div>' +
      '</div>' +
      '<div class="auth-err" id="auth-err"></div>' +
      '<p class="auth-fine">Мы не публикуем ничего от вашего имени и не рассылаем письма.</p>'
    );
    const err = m => { const b = document.getElementById('auth-err'); if (b) { b.textContent = m; b.classList.add('show'); } };
    const run = async (btn, fn) => {
      const b = document.getElementById(btn);
      if (b) b.classList.add('loading');
      try {
        await fn();
        ui.closeModal();
        if (o.onDone) await o.onDone();
      } catch (e) {
        if (b) b.classList.remove('loading');
        if (this._silent(e)) return;
        err(this.friendly(e));
      }
    };
    const g = document.getElementById('auth-google');
    if (g) g.onclick = () => run('auth-google', () => this.google());
    const gu = document.getElementById('auth-guest');
    if (gu) gu.onclick = () => run('auth-guest', () => this.guest());
  }
};
window.Auth = Auth;
})();