/* ============================================================
   config.js — ЛИЧНЫЕ НАСТРОЙКИ ВЛАДЕЛЬЦА САЙТА
   Обычные посетители этот экран нигде не видят.
   Админ-панель: открой  https://твой-сайт/#/admin
   ============================================================ */
window.HotelkiConfig = {

  siteName: 'Хотелки',

  /* 1) СЮДА вставь свой firebaseConfig из консоли Firebase.
        Пока тут null — сайт возьмёт конфиг, который ты уже
        сохранял раньше через настройки (из памяти браузера).
        Скопировать готовый блок можно в админке: #/admin */
  firebase: // For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA-lPkZ2e76B_oI4RM3tnMMSZBRhl2jpAc",
  authDomain: "gift-bec9e.firebaseapp.com",
  projectId: "gift-bec9e",
  storageBucket: "gift-bec9e.firebasestorage.app",
  messagingSenderId: "1083036317725",
  appId: "1:1083036317725:web:edc53eab4524bc7d87aef4",
  measurementId: "G-VC7V1J1PWX"
};

  /* 2) СЮДА свой Google-почтовый ящик — станешь админом.
        Пока список пуст, админка открыта любому вошедшему
        (режим первой настройки). Как только впишешь — только тебе. */
  adminEmails: [ponomarevazxz@gmail.com],
  adminUids: [],

  /* 3) Разрешить вход «как гость» без регистрации */
  allowGuests: true,

  /* 4) Показывать на главной пример списка (тренировочный) */
  showExample: true
};