// =============================================
// MÓDULO: ACCIONES COLECTIVAS DE PROTESTA (ACP)
// =============================================

// --- Toggle sección vincular conflicto ---
function toggleConflictoAcp(mostrar) {
    const div = document.getElementById('acp-conflicto-buscar');
    if (div) div.style.display = mostrar ? 'block' : 'none';
    if (!mostrar) window._acpConflictoVinculado = null;
}
window.toggleConflictoAcp = toggleConflictoAcp;

// --- Estado del módulo ---
let acpRecords = [];
let acpEditMode = false;
let acpCurrentId = null;

// Listas dinámicas (ACP)
let acpUbicaciones = [];
let acpActores = []; // legacy
let acpActoresDemandantes = [];
let acpActoresDemandados = [];
let acpDocumentos = [];
let acpHeridas = [];
let acpDetenidas = [];
let acpFallecidas = [];
let acpDesaparecidas = [];

// Conflicto vinculado
window._acpConflictoVinculado = null;

// --- Catálogos ACP ---
const FUENTES_INFO_ACP = [
    "Monitoreo de medios",
    "Comisionado / Defensor",
    "Sociedad civil",
    "Entidad estatal",
    "Llamada telefónica",
    "Red social",
    "Informe interno",
    "Otro"
];

// --- INICIALIZACIÓN ---
function initAcpModule() {
    populateAcpSelects();
    setupAcpListeners();
    loadAcpFromFirebase();
}

function populateAcpSelects() {
    const selFuente = document.getElementById('acp-fuente-info');
    const selMedida = document.getElementById('acp-tipo-medida');
    const selDemanda = document.getElementById('acp-tipo-demanda');

    if (selFuente) selFuente.innerHTML = '<option value="" disabled selected>Seleccionar fuente...</option>' +
        FUENTES_INFO_ACP.map(f => `<option value="${f}">${f}</option>`).join('');
    if (selMedida) selMedida.innerHTML = '<option value="" disabled selected>Seleccionar tipo de medida...</option>' +
        TIPOS_MEDIDA.map(t => `<option value="${t}">${t}</option>`).join('');
    if (selDemanda) selDemanda.innerHTML = '<option value="" disabled selected>Seleccionar tipo de demanda...</option>' +
        TIPOS_DEMANDA.map(t => `<option value="${t}">${t}</option>`).join('');
}

function setupAcpListeners() {
    document.getElementById('nueva-acp-btn')?.addEventListener('click', openAcpForm);
    document.getElementById('cancelar-acp-btn')?.addEventListener('click', closeAcpForm);
    document.getElementById('guardar-acp-btn')?.addEventListener('click', saveAcp);

    // Dinámicos
    document.getElementById('agregar-ubicacion-acp-btn')?.addEventListener('click', () => addUbicacionRow('acp'));
    document.getElementById('agregar-demandante-acp-btn')?.addEventListener('click', () => addActorByRole('acp', 'Demandante'));
    document.getElementById('agregar-demandado-acp-btn')?.addEventListener('click', () => addActorByRole('acp', 'Demandado'));
    document.getElementById('agregar-herida-btn')?.addEventListener('click', () => addPersonaRow('heridas'));
    document.getElementById('agregar-detenida-btn')?.addEventListener('click', () => addPersonaRow('detenidas'));
    document.getElementById('agregar-fallecida-btn')?.addEventListener('click', () => addPersonaRow('fallecidas'));
    document.getElementById('agregar-desaparecida-btn')?.addEventListener('click', () => addPersonaRow('desaparecidas'));

    // Documentos
    const dropZone = document.getElementById('acp-dropzone');
    const fileInput = document.getElementById('acp-file-input');
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput?.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFilesAcp(e.dataTransfer.files); });
    }
    fileInput?.addEventListener('change', e => handleFilesAcp(e.target.files));

    // Vincular conflicto
    document.getElementById('buscar-conflicto-acp-btn')?.addEventListener('click', () => openConflictoSearch('acp'));
    document.getElementById('acp-desvincular-conflicto')?.addEventListener('click', () => unlinkConflicto('acp'));
}

// --- VISTAS ---
function openAcpForm(editData = null) {
    acpEditMode = !!editData;
    acpCurrentId = editData?.id || null;
    acpUbicaciones = [];
    acpActores = [];
    acpActoresDemandantes = [];
    acpActoresDemandados = [];
    acpDocumentos = [];
    acpHeridas = [];
    acpDetenidas = [];
    acpFallecidas = [];
    acpDesaparecidas = [];

    document.getElementById('acp-list-view')?.classList.add('d-none');
    document.getElementById('acp-form-view')?.classList.remove('d-none');
    document.getElementById('acp-form-title').textContent = editData ? 'Editar Acción Colectiva' : 'Registro de Nueva Acción Colectiva de Protesta';

    if (editData) {
        fillAcpForm(editData);
    } else {
        document.getElementById('acp-form-el')?.reset();
        renderUbicacionesList('acp', []);
        renderActoresDemandantesList('acp', []);
        renderActoresDemandadosList('acp', []);
        renderDocumentosList('acp', []);
        renderPersonasList('heridas', []);
        renderPersonasList('detenidas', []);
        renderPersonasList('fallecidas', []);
        renderPersonasList('desaparecidas', []);
        unlinkConflicto('acp');
    }

    // Inicializar tipo de fecha: fecha única seleccionada por defecto, max=hoy
    const radioUnicaInit = document.getElementById('acp-tipo-fecha-unica');
    if (radioUnicaInit && !editData) radioUnicaInit.checked = true;
    toggleAcpTipoFecha(editData?.tipoFecha || 'unica');

    document.getElementById('modulo-acciones')?.scrollTo(0, 0);
}

function closeAcpForm() {
    document.getElementById('acp-form-view')?.classList.add('d-none');
    document.getElementById('acp-list-view')?.classList.remove('d-none');
}

// --- FIREBASE CRUD ---
function loadAcpFromFirebase() {
    const ref = fbRef('acciones_colectivas');
    if (!ref) return;
    ref.orderByChild('timestamp').limitToLast(50).on('value', snap => {
        const data = snap.val() || {};
        acpRecords = Object.entries(data).map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderAcpList();
    });
}

function renderAcpList() {
    const list = document.getElementById('acp-records-list');
    if (!list) return;

    if (!acpRecords.length) {
        list.innerHTML = '<p class="empty-state">No hay acciones colectivas registradas.</p>';
        return;
    }

    list.innerHTML = acpRecords.map(a => {
        const fecha = a.fechaEvento || new Date(a.timestamp).toLocaleDateString('es-PE');
        const huboViolencia = a.huboViolencia === 'Sí';
        return `
        <div class="record-card" style="border-left: 4px solid ${huboViolencia ? '#e74c3c' : '#3498db'};">
            <div class="record-card-header">
                <div>
                    ${huboViolencia ? '<span class="record-tag" style="background:#e74c3c;">Con violencia</span>' : ''}
                    <h4 class="record-title">${a.nombreEvento || 'Sin nombre'}</h4>
                </div>
                <span class="record-date">${fecha}</span>
            </div>
            <p class="record-desc">${(a.descripcion || '').substring(0, 100)}${a.descripcion?.length > 100 ? '...' : ''}</p>
            <div class="record-meta">
                ${a.cantidadPersonas ? `<span>👥 ${a.cantidadPersonas} personas</span>` : ''}
                ${(a.heridas || []).length ? `<span class="badge-heridos">🤕 ${a.heridas.length} heridos</span>` : ''}
                ${(a.fallecidas || []).length ? `<span class="badge-fallecidos">⚫ ${a.fallecidas.length} fallecidos</span>` : ''}
                ${(a.detenidas || []).length ? `<span class="badge-detenidos">🔒 ${a.detenidas.length} detenidos</span>` : ''}
            </div>
            <div class="record-footer">
                <span>📍 ${(a.ubicaciones || []).map(u => u.departamento).join(', ') || 'Sin ubicación'}</span>
                <div class="record-actions">
                    <button class="btn-record-edit" onclick="editAcp('${a.id}')">✏️ Editar</button>
                    <button class="btn-record-delete" onclick="deleteAcp('${a.id}')">🗑️</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function saveAcp() {
    const btn = document.getElementById('guardar-acp-btn');
    const nombreEvento = document.getElementById('acp-nombre-evento')?.value.trim();
    const fechaEvento = document.getElementById('acp-fecha-evento')?.value;

    if (!nombreEvento) return alert('El nombre del evento es obligatorio.');
    if (!fechaEvento) return alert('La fecha del evento es obligatoria.');

    btn.disabled = true;
    btn.textContent = 'Guardando... ⏳';

    const docsWithUrls = await uploadAcpDocumentos();

    // Fecha: puede ser única o rango
    const tipoFecha = document.querySelector('input[name="acp-tipo-fecha"]:checked')?.value || 'unica';
    const fechaInicio = document.getElementById('acp-fecha-inicio')?.value || fechaEvento;
    const fechaFin = document.getElementById('acp-fecha-fin')?.value || '';

    const data = {
        nombreEvento,
        fechaEvento: tipoFecha === 'rango' ? fechaInicio : fechaEvento,
        fechaFin: tipoFecha === 'rango' ? fechaFin : '',
        tipoFecha,
        fuenteInfo: document.getElementById('acp-fuente-info')?.value || '',
        linkFuente: document.getElementById('acp-link-fuente')?.value || '',
        comisionado: document.getElementById('acp-comisionado')?.value || '',
        oficina: document.getElementById('acp-oficina')?.value || '',
        descripcion: document.getElementById('acp-descripcion')?.value || '',
        demandas: document.getElementById('acp-demandas')?.value || '',
        cantidadPersonas: parseInt(document.getElementById('acp-cantidad-personas')?.value) || 0,
        tipoMedida: document.getElementById('acp-tipo-medida')?.value || '',
        tipoDemanda: document.getElementById('acp-tipo-demanda')?.value || '',
        huboViolencia: document.getElementById('acp-hubo-violencia')?.value || '',
        conflictoVinculado: window._acpConflictoVinculado || null,
        ubicaciones: acpUbicaciones,
        actores: [...acpActoresDemandantes, ...acpActoresDemandados],
        actoresDemandantes: acpActoresDemandantes,
        actoresDemandados: acpActoresDemandados,
        heridas: acpHeridas,
        detenidas: acpDetenidas,
        fallecidas: acpFallecidas,
        desaparecidas: acpDesaparecidas,
        documentos: docsWithUrls,
        registradoPor: localStorage.getItem('dp_last_supervisor') || '',
        timestamp: acpCurrentId ? (acpRecords.find(r => r.id === acpCurrentId)?.timestamp || Date.now()) : Date.now(),
        fecha: new Date().toISOString().split('T')[0],
        updatedAt: Date.now()
    };

    try {
        if (acpCurrentId) {
            await fbRef('acciones_colectivas/' + acpCurrentId).set(data);
            syncAcpToSheets({ ...data, firebaseId: acpCurrentId });
        } else {
            const ref = fbRef('acciones_colectivas').push();
            await ref.set(data);
            syncAcpToSheets({ ...data, firebaseId: ref.key });
        }
        closeAcpForm();
    } catch (e) {
        addToOfflineQueue({ path: acpCurrentId ? 'acciones_colectivas/' + acpCurrentId : 'acciones_colectivas/__push', data, action: acpCurrentId ? 'set' : 'push' });
        showOfflineBadge();
        closeAcpForm();
        alert('Sin conexión. El registro se guardará cuando recuperes señal. ✅');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

function syncAcpToSheets(data) {
    if (typeof GOOGLE_SHEETS_URL === 'undefined' || !GOOGLE_SHEETS_URL) return;
    fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'acp', ...data })
    }).catch(e => console.warn('[Sheets sync acp]', e));
}

async function uploadAcpDocumentos() {
    const results = [];
    for (const doc of acpDocumentos) {
        if (doc.url) { results.push(doc); continue; }
        if (doc.file && _fbStorage) {
            try {
                // Comprimir solo imágenes; videos y docs se suben tal cual
                let fileToUpload = doc.file;
                if (doc.type?.startsWith('image/')) {
                    fileToUpload = await compressImage(doc.file);
                }
                const ref = _fbStorage.ref('acp_docs/' + Date.now() + '_' + doc.name);
                await ref.put(fileToUpload);
                const url = await ref.getDownloadURL();
                results.push({ name: doc.name, url, type: doc.type });
            } catch (e) {
                results.push({ name: doc.name, url: '', type: doc.type });
            }
        }
    }
    return results;
}

function editAcp(id) {
    const record = acpRecords.find(r => r.id === id);
    if (record) openAcpForm(record);
}

function deleteAcp(id) {
    if (!confirm('¿Eliminar esta acción colectiva?')) return;
    fbRef('acciones_colectivas/' + id)?.remove();
}

function fillAcpForm(data) {
    document.getElementById('acp-nombre-evento').value = data.nombreEvento || '';
    // Restaurar tipo de fecha y campos correspondientes
    const tipoFecha = data.tipoFecha || 'unica';
    const radioUnica = document.getElementById('acp-tipo-fecha-unica');
    const radioRango = document.getElementById('acp-tipo-fecha-rango');
    if (tipoFecha === 'rango' && radioRango) {
        radioRango.checked = true;
        toggleAcpTipoFecha('rango');
        const fi = document.getElementById('acp-fecha-inicio');
        const ff = document.getElementById('acp-fecha-fin');
        if (fi) fi.value = data.fechaEvento || '';
        if (ff) ff.value = data.fechaFin || '';
    } else {
        if (radioUnica) radioUnica.checked = true;
        toggleAcpTipoFecha('unica');
        document.getElementById('acp-fecha-evento').value = data.fechaEvento || '';
    }
    document.getElementById('acp-fuente-info').value = data.fuenteInfo || '';
    document.getElementById('acp-link-fuente').value = data.linkFuente || '';
    document.getElementById('acp-comisionado').value = data.comisionado || '';
    document.getElementById('acp-oficina').value = data.oficina || '';
    document.getElementById('acp-descripcion').value = data.descripcion || '';
    document.getElementById('acp-demandas').value = data.demandas || '';
    document.getElementById('acp-cantidad-personas').value = data.cantidadPersonas || 0;
    document.getElementById('acp-tipo-medida').value = data.tipoMedida || '';
    document.getElementById('acp-tipo-demanda').value = data.tipoDemanda || '';
    document.getElementById('acp-hubo-violencia').value = data.huboViolencia || '';

    acpUbicaciones = data.ubicaciones || [];
    acpActoresDemandantes = data.actoresDemandantes || (data.actores || []).filter(a => a.rol === 'Demandante');
    acpActoresDemandados = data.actoresDemandados || (data.actores || []).filter(a => a.rol === 'Demandado');
    acpActores = [...acpActoresDemandantes, ...acpActoresDemandados];
    acpHeridas = data.heridas || [];
    acpDetenidas = data.detenidas || [];
    acpFallecidas = data.fallecidas || [];
    acpDesaparecidas = data.desaparecidas || [];
    acpDocumentos = data.documentos || [];

    renderUbicacionesList('acp', acpUbicaciones);
    renderActoresDemandantesList('acp', acpActoresDemandantes);
    renderActoresDemandadosList('acp', acpActoresDemandados);
    renderPersonasList('heridas', acpHeridas);
    renderPersonasList('detenidas', acpDetenidas);
    renderPersonasList('fallecidas', acpFallecidas);
    renderPersonasList('desaparecidas', acpDesaparecidas);
    renderDocumentosList('acp', acpDocumentos);

    if (data.conflictoVinculado) {
        window._acpConflictoVinculado = data.conflictoVinculado;
        renderConflictoVinculado('acp', data.conflictoVinculado);
    }
}

// --- PERSONAS (Heridas / Detenidas / Fallecidas / Desaparecidas) ---
const GENEROS = ['Masculino', 'Femenino', 'No binario', 'No identificado'];
const CONDICIONES_HERIDA = ['Leve', 'Moderado', 'Grave', 'Crítico', 'No identificado'];
const CIRCUNSTANCIAS = ['Impacto de proyectil', 'Golpe físico', 'Gas lacrimógeno', 'Atropellamiento', 'Caída', 'Otra causa'];

function getListByType(type) {
    switch (type) {
        case 'heridas': return acpHeridas;
        case 'detenidas': return acpDetenidas;
        case 'fallecidas': return acpFallecidas;
        case 'desaparecidas': return acpDesaparecidas;
        default: return [];
    }
}

function addPersonaRow(type) {
    getListByType(type).push({ nombre: '', edad: '', genero: '', condicion: '', circunstancia: '', hospital: '' });
    renderPersonasList(type, getListByType(type));
}

function removePersona(type, idx) {
    getListByType(type).splice(idx, 1);
    renderPersonasList(type, getListByType(type));
}

function updatePersona(type, idx, field, value) {
    const list = getListByType(type);
    if (list[idx]) list[idx][field] = value;
}

function renderPersonasList(type, list) {
    const container = document.getElementById('acp-' + type + '-list');
    if (!container) return;

    const labels = {
        heridas: { title: 'Persona Herida', extra: true },
        detenidas: { title: 'Persona Detenida', extra: false },
        fallecidas: { title: 'Persona Fallecida', extra: false },
        desaparecidas: { title: 'Persona Desaparecida', extra: false }
    };
    const label = labels[type] || { title: 'Persona', extra: false };

    if (!list.length) {
        container.innerHTML = `<p class="empty-state-sm">No hay personas ${type} registradas.</p>`;
        return;
    }

    container.innerHTML = list.map((p, idx) => `
        <div class="dynamic-row">
            <div class="dynamic-row-header">
                <strong>${label.title} ${idx + 1}</strong>
                <button class="btn-delete-row" onclick="removePersona('${type}', ${idx})">🗑️</button>
            </div>
            <div class="persona-grid">
                <input type="text" class="form-input" placeholder="Nombre (opcional)" value="${p.nombre || ''}" oninput="updatePersona('${type}', ${idx}, 'nombre', this.value)">
                <input type="number" class="form-input" placeholder="Edad" min="0" max="120" value="${p.edad || ''}" oninput="updatePersona('${type}', ${idx}, 'edad', this.value)">
                <select class="form-input" onchange="updatePersona('${type}', ${idx}, 'genero', this.value)">
                    <option value="">Género</option>
                    ${GENEROS.map(g => `<option value="${g}" ${p.genero === g ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
                ${label.extra ? `
                <select class="form-input" onchange="updatePersona('${type}', ${idx}, 'condicion', this.value)">
                    <option value="">Condición</option>
                    ${CONDICIONES_HERIDA.map(c => `<option value="${c}" ${p.condicion === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <select class="form-input" onchange="updatePersona('${type}', ${idx}, 'circunstancia', this.value)">
                    <option value="">Circunstancia</option>
                    ${CIRCUNSTANCIAS.map(c => `<option value="${c}" ${p.circunstancia === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <input type="text" class="form-input" placeholder="Centro de salud / Hospital" value="${p.hospital || ''}" oninput="updatePersona('${type}', ${idx}, 'hospital', this.value)">` : `
                <input type="text" class="form-input" placeholder="Lugar / Institución" value="${p.circunstancia || ''}" oninput="updatePersona('${type}', ${idx}, 'circunstancia', this.value)">`}
            </div>
        </div>`).join('');
}

function handleFilesAcp(files) {
    Array.from(files).forEach(file => {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        if (isVideo && file.size > 200 * 1024 * 1024) {
            alert(`"${file.name}" supera los 200 MB. Selecciona un video más corto.`);
            return;
        }
        const previewUrl = (isImage || isVideo) ? URL.createObjectURL(file) : null;
        acpDocumentos.push({ name: file.name, type: file.type, file, url: '', previewUrl });
    });
    renderDocumentosList('acp', acpDocumentos);
}

// --- TIPO DE FECHA ACP (única / rango) ---
function toggleAcpTipoFecha(tipo) {
    const wrapUnica = document.getElementById('acp-fecha-unica-wrap');
    const wrapRango = document.getElementById('acp-fecha-rango-wrap');
    const today = new Date().toISOString().split('T')[0];
    if (tipo === 'rango') {
        if (wrapUnica) wrapUnica.style.display = 'none';
        if (wrapRango) wrapRango.style.display = 'block';
        const fi = document.getElementById('acp-fecha-inicio');
        const ff = document.getElementById('acp-fecha-fin');
        if (fi) fi.max = today;
        if (ff) ff.max = today;
    } else {
        if (wrapUnica) wrapUnica.style.display = 'block';
        if (wrapRango) wrapRango.style.display = 'none';
        const fe = document.getElementById('acp-fecha-evento');
        if (fe) fe.max = today;
    }
}
window.toggleAcpTipoFecha = toggleAcpTipoFecha;

// Exponer globales
window.editAcp = editAcp;
window.deleteAcp = deleteAcp;
window.addPersonaRow = addPersonaRow;
window.removePersona = removePersona;
window.updatePersona = updatePersona;
window.openAcpForm = openAcpForm;
window.initAcpModule = initAcpModule;
