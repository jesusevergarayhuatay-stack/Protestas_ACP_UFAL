// =============================================
// MÓDULO: MODO OFFLINE con IndexedDB
// =============================================

const OFFLINE_DB_NAME = 'dp_offline_queue';
const OFFLINE_DB_VERSION = 1;
const OFFLINE_STORE = 'pending_writes';

let offlineDB = null;

// --- INICIALIZAR INDEXEDDB ---
function initOfflineDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(OFFLINE_STORE)) {
                db.createObjectStore(OFFLINE_STORE, { keyPath: 'id', autoIncrement: true });
            }
        };

        req.onsuccess = e => {
            offlineDB = e.target.result;
            resolve(offlineDB);
        };

        req.onerror = e => {
            console.warn('[Offline] Error al abrir IndexedDB:', e.target.error);
            reject(e.target.error);
        };
    });
}

// --- AGREGAR A LA COLA ---
function addToOfflineQueue(item) {
    if (!offlineDB) return;
    const tx = offlineDB.transaction(OFFLINE_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE);
    store.add({ ...item, queuedAt: Date.now() });
    updateOfflineBadge();
    console.log('[Offline] Operación encolada:', item.path);
}

// --- CONTAR PENDIENTES ---
function countPendingWrites() {
    return new Promise((resolve) => {
        if (!offlineDB) return resolve(0);
        const tx = offlineDB.transaction(OFFLINE_STORE, 'readonly');
        const store = tx.objectStore(OFFLINE_STORE);
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
    });
}

// --- SINCRONIZAR PENDIENTES CON FIREBASE ---
async function syncOfflineQueue() {
    if (!offlineDB || !_fbDb) return;

    const tx = offlineDB.transaction(OFFLINE_STORE, 'readwrite');
    const store = tx.objectStore(OFFLINE_STORE);
    const allReq = store.getAll();

    allReq.onsuccess = async () => {
        const items = allReq.result;
        if (!items.length) return;

        console.log(`[Offline] Sincronizando ${items.length} operaciones pendientes...`);
        showSyncToast(items.length);

        let synced = 0;
        for (const item of items) {
            try {
                if (item.action === 'set') {
                    await _fbDb.ref(item.path).set(item.data);
                } else if (item.action === 'push') {
                    await _fbDb.ref(item.path.replace('/__push', '')).push(item.data);
                } else if (item.action === 'update') {
                    await _fbDb.ref(item.path).update(item.data);
                }

                // Eliminar de la cola si fue exitoso
                const delTx = offlineDB.transaction(OFFLINE_STORE, 'readwrite');
                delTx.objectStore(OFFLINE_STORE).delete(item.id);
                synced++;
            } catch (e) {
                console.warn('[Offline] Fallo al sincronizar item:', item.id, e.message);
                break; // Si falla, detener (probablemente sin conexión aún)
            }
        }

        if (synced > 0) {
            updateOfflineBadge();
            showSyncSuccessToast(synced);
        }
    };
}

// --- DETECCIÓN DE CONEXIÓN ---
function setupConnectionListener() {
    // Firebase tiene su propio listener de conectividad
    if (_fbDb) {
        _fbDb.ref('.info/connected').on('value', snap => {
            const connected = snap.val();
            if (connected) {
                hideOfflineBanner();
                syncOfflineQueue(); // Intentar sincronizar al reconectar
            } else {
                showOfflineBanner();
            }
        });
    }

    // También usamos los eventos nativos del browser
    window.addEventListener('online', () => {
        hideOfflineBanner();
        syncOfflineQueue();
    });

    window.addEventListener('offline', () => {
        showOfflineBanner();
    });
}

// --- UI: BANNER Y BADGE OFFLINE ---
function showOfflineBanner() {
    let banner = document.getElementById('offline-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'offline-banner';
        banner.innerHTML = `
            <span>📡 Sin conexión — Los registros se guardarán localmente y sincronizarán al reconectar.</span>
        `;
        banner.style.cssText = `
            position: fixed; bottom: 0; left: 0; right: 0; z-index: 9999;
            background: #e67e22; color: white; text-align: center;
            padding: 10px 20px; font-weight: 700; font-size: 0.9rem;
            animation: slideUp 0.3s ease;
        `;
        document.body.appendChild(banner);
    }
    banner.style.display = 'block';
}

function hideOfflineBanner() {
    const banner = document.getElementById('offline-banner');
    if (banner) banner.style.display = 'none';
}

function showOfflineBadge() {
    updateOfflineBadge();
}

async function updateOfflineBadge() {
    const count = await countPendingWrites();
    let badge = document.getElementById('offline-badge');

    if (count > 0) {
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'offline-badge';
            badge.style.cssText = `
                position: fixed; bottom: 60px; right: 15px; z-index: 9998;
                background: #e67e22; color: white; border-radius: 20px;
                padding: 8px 14px; font-size: 0.8rem; font-weight: 700;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: pointer;
            `;
            badge.addEventListener('click', syncOfflineQueue);
            document.body.appendChild(badge);
        }
        badge.textContent = `⏳ ${count} pendiente${count > 1 ? 's' : ''} — Toca para sincronizar`;
        badge.style.display = 'block';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

function showSyncToast(count) {
    showToast(`🔄 Sincronizando ${count} registro${count > 1 ? 's' : ''} pendiente${count > 1 ? 's' : ''}...`, '#3498db');
}

function showSyncSuccessToast(count) {
    showToast(`✅ ${count} registro${count > 1 ? 's' : ''} sincronizado${count > 1 ? 's' : ''} correctamente.`, '#27ae60');
}

function showToast(message, color = '#2c3e50') {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed; top: 80px; right: 15px; z-index: 9999;
        background: ${color}; color: white; border-radius: 12px;
        padding: 12px 18px; font-size: 0.85rem; font-weight: 700;
        box-shadow: 0 4px 15px rgba(0,0,0,0.25); max-width: 300px;
        animation: slideDown 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// --- INICIALIZAR TODO ---
async function initOfflineModule() {
    await initOfflineDB();
    setupConnectionListener();
    updateOfflineBadge();
    console.log('[Offline] Módulo offline listo.');
}

// Llamar inmediatamente
initOfflineModule();
