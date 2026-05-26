// Firebase Compat SDK v9 — funciona desde file:// y GitHub Pages
// Los scripts se cargan via <script> en el HTML, no como módulos ES

const firebaseConfig = {
    apiKey: "AIzaSyD-D50A7IhJOTb2xBwvCuoshvucziggOR4",
    authDomain: "monitoreo-defensoria.firebaseapp.com",
    databaseURL: "https://monitoreo-defensoria-default-rtdb.firebaseio.com",
    projectId: "monitoreo-defensoria",
    storageBucket: "monitoreo-defensoria.firebasestorage.app",
    messagingSenderId: "633665962819",
    appId: "1:633665962819:web:6ef68284612f45625425f6"
};

firebase.initializeApp(firebaseConfig);

// Exponer servicios como globales accesibles desde todos los módulos
const _db      = firebase.database();
const _storage = (typeof firebase.storage === 'function') ? firebase.storage() : null;

// Helper global: referencia a path de Firebase Realtime Database
// Disponible para app.js, dashboard.js, alertas.js, acciones.js, offline.js
const _fbDb = _db;
function fbRef(path) { return _db ? _db.ref(path) : null; }
