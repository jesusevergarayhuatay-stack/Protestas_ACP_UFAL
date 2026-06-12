// =============================================
// MÓDULO: REGISTRO DE ALERTAS
// =============================================

// --- Estado del módulo ---
let alertasRecords = [];
let alertasEditMode = false; // true = editando registro existente
let alertasCurrentId = null;

// Listas dinámicas (estado en memoria)
let alertasUbicaciones = [];
let alertasActores = []; // legacy – se mantiene para compatibilidad
let alertasActoresDemandantes = [];
let alertasActoresDemandados = [];
let alertasDocumentos = [];

// --- Toggle sección vincular conflicto ---
function toggleConflictoAlerta(mostrar) {
    const div = document.getElementById('alerta-conflicto-buscar');
    if (div) div.style.display = mostrar ? 'block' : 'none';
    if (!mostrar) window._alertaConflictoVinculado = null;
}
window.toggleConflictoAlerta = toggleConflictoAlerta;

// --- Clasificaciones y catálogos ---
const CLASIFICACIONES_ALERTA = [
    "Situaciones que pueden derivar en acciones colectivas de protesta y/o conflictos sociales",
    "Anuncios de acciones colectivas de protesta",
    "Pronunciamientos, memoriales u otros documentos que dan a conocer demandas sociales"
];

const TIPOS_MEDIDA = [
    "Bloqueo de vías",
    "Paros",
    "Plantones",
    "Huelgas",
    "Toma de entidades, locales, campamentos",
    "Marcha",
    "Destrucción o daño de la propiedad pública y/o privada",
    "Enfrentamientos entre sectores de la sociedad y la PNP / sectores de la sociedad",
    "Otros"
];

const TIPOS_DEMANDA = [
    "Asuntos Constitucionales",
    "Administración Estatal",
    "Derechos Humanos",
    "Personas con Discapacidad",
    "Medio Ambiente",
    "Servicios Públicos",
    "Pueblos Indígenas",
    "Prevención de Conflictos Sociales y Gobernabilidad",
    "Niñez y Adolescencia",
    "Derechos de la Mujer",
    "Lucha contra la Corrupción, Transparencia y Eficiencia del Estado"
];

const FUENTES_INFO = [
    "Monitoreo de medios",
    "Comisionado / Defensor",
    "Sociedad civil",
    "Entidad estatal",
    "Llamada telefónica",
    "Red social",
    "Otro"
];

const UBIGEO_PERU = {
    "Amazonas": ["Chachapoyas", "Bagua", "Bongará", "Condorcanqui", "Luya", "Rodríguez de Mendoza", "Utcubamba"],
    "Áncash": ["Huaraz", "Aija", "Antonio Raymondi", "Asunción", "Bolognesi", "Carhuaz", "Casma", "Corongo", "Huari", "Huarmey", "Huaylas", "Ocros", "Pallasca", "Pomabamba", "Recuay", "Santa", "Sihuas", "Yungay"],
    "Apurímac": ["Abancay", "Andahuaylas", "Antabamba", "Aymaraes", "Cotabambas", "Chincheros", "Grau"],
    "Arequipa": ["Arequipa", "Camaná", "Caravelí", "Castilla", "Caylloma", "Condesuyos", "Islay", "La Unión"],
    "Ayacucho": ["Huamanga", "Cangallo", "Huanca Sancos", "Huanta", "La Mar", "Lucanas", "Parinacochas", "Páucar del Sara Sara", "Sucre", "Víctor Fajardo", "Vilcas Huamán"],
    "Cajamarca": ["Cajamarca", "Cajabamba", "Celendín", "Chota", "Contumazá", "Cutervo", "Hualgayoc", "Jaén", "San Ignacio", "San Marcos", "San Miguel", "San Pablo", "Santa Cruz"],
    "Callao": ["Callao", "Bellavista", "Carmen de La Legua", "La Perla", "La Punta", "Mi Perú", "Ventanilla"],
    "Cusco": ["Cusco", "Acomayo", "Anta", "Calca", "Canas", "Canchis", "Chumbivilcas", "Espinar", "La Convención", "Paruro", "Paucartambo", "Quispicanchi", "Urubamba"],
    "Huancavelica": ["Huancavelica", "Acobamba", "Angaraes", "Castrovirreyna", "Churcampa", "Huaytará", "Tayacaja"],
    "Huánuco": ["Huánuco", "Ambo", "Dos de Mayo", "Huacaybamba", "Huamalíes", "Leoncio Prado", "Marañón", "Pachitea", "Puerto Inca", "Lauricocha", "Yarowilca"],
    "Ica": ["Ica", "Chincha", "Nasca", "Palpa", "Pisco"],
    "Junín": ["Huancayo", "Chanchamayo", "Chupaca", "Concepción", "Jauja", "Junín", "Satipo", "Tarma", "Yauli"],
    "La Libertad": ["Trujillo", "Ascope", "Bolívar", "Chepén", "Julcán", "Otuzco", "Pacasmayo", "Pataz", "Sánchez Carrión", "Santiago de Chuco", "Gran Chimú", "Virú"],
    "Lambayeque": ["Chiclayo", "Ferreñafe", "Lambayeque"],
    "Lima": ["Lima", "Barranca", "Cajatambo", "Canta", "Cañete", "Huaral", "Huarochirí", "Huaura", "Oyón", "Yauyos"],
    "Lima Metropolitana": ["Lima Centro", "Lima Norte", "Lima Este", "Lima Sur"],
    "Loreto": ["Maynas", "Alto Amazonas", "Loreto", "Mariscal Ramón Castilla", "Requena", "Ucayali", "Datem del Marañón", "Putumayo"],
    "Madre de Dios": ["Tambopata", "Manu", "Tahuamanu"],
    "Moquegua": ["Mariscal Nieto", "General Sánchez Cerro", "Ilo"],
    "Pasco": ["Pasco", "Daniel Alcides Carrión", "Oxapampa"],
    "Piura": ["Piura", "Ayabaca", "Huancabamba", "Morropón", "Paita", "Sechura", "Sullana", "Talara"],
    "Puno": ["Puno", "Azángaro", "Carabaya", "Chucuito", "El Collao", "Huancané", "Lampa", "Melgar", "Moho", "San Antonio de Putina", "San Román", "Sandia", "Yunguyo"],
    "San Martín": ["Moyobamba", "Bellavista", "El Dorado", "Huallaga", "Lamas", "Mariscal Cáceres", "Picota", "Rioja", "San Martín", "Tocache"],
    "Tacna": ["Tacna", "Candarave", "Jorge Basadre", "Tarata"],
    "Tumbes": ["Tumbes", "Contralmirante Villar", "Zarumilla"],
    "Ucayali": ["Coronel Portillo", "Atalaya", "Padre Abad", "Purús"]
};

// --- INICIALIZACIÓN DEL MÓDULO ---
function initAlertasModule() {
    populateAlertasSelects();
    setupAlertasListeners();
    loadAlertasFromFirebase();
}

function populateAlertasSelects() {
    const selClasif = document.getElementById('alerta-clasificacion');
    const selFuente = document.getElementById('alerta-fuente-info');
    const selMedida = document.getElementById('alerta-tipo-medida');
    const selDemanda = document.getElementById('alerta-tipo-demanda');

    if (selClasif) selClasif.innerHTML = '<option value="" disabled selected>Seleccionar clasificación...</option>' +
        CLASIFICACIONES_ALERTA.map(c => `<option value="${c}">${c}</option>`).join('');
    if (selFuente) selFuente.innerHTML = '<option value="" disabled selected>Seleccionar fuente...</option>' +
        FUENTES_INFO.map(f => `<option value="${f}">${f}</option>`).join('');
    if (selMedida) selMedida.innerHTML = '<option value="" disabled selected>Seleccionar tipo de medida...</option>' +
        TIPOS_MEDIDA.map(t => `<option value="${t}">${t}</option>`).join('');
    if (selDemanda) selDemanda.innerHTML = '<option value="" disabled selected>Seleccionar tipo de demanda...</option>' +
        TIPOS_DEMANDA.map(t => `<option value="${t}">${t}</option>`).join('');
}

function setupAlertasListeners() {
    // Botón nueva alerta
    document.getElementById('nueva-alerta-btn')?.addEventListener('click', openAlertaForm);
    // Botón cancelar
    document.getElementById('cancelar-alerta-btn')?.addEventListener('click', closeAlertaForm);
    // Botón guardar
    document.getElementById('guardar-alerta-btn')?.addEventListener('click', saveAlerta);

    // Dinámicos: Ubicaciones
    document.getElementById('agregar-ubicacion-alerta-btn')?.addEventListener('click', () => addUbicacionRow('alerta'));
    // Dinámicos: Actores
    document.getElementById('agregar-demandante-alerta-btn')?.addEventListener('click', () => addActorByRole('alerta', 'Demandante'));
    document.getElementById('agregar-demandado-alerta-btn')?.addEventListener('click', () => addActorByRole('alerta', 'Demandado'));
    // Dinámicos: Documentos
    const dropZone = document.getElementById('alerta-dropzone');
    const fileInput = document.getElementById('alerta-file-input');
    if (dropZone) {
        dropZone.addEventListener('click', () => fileInput?.click());
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleFilesAlerta(e.dataTransfer.files); });
    }
    fileInput?.addEventListener('change', e => handleFilesAlerta(e.target.files));

    // Vincular conflicto
    document.getElementById('buscar-conflicto-alerta-btn')?.addEventListener('click', () => openConflictoSearch('alerta'));
    document.getElementById('desvincular-conflicto-alerta')?.addEventListener('click', () => unlinkConflicto('alerta'));
}

// --- VISTA LISTA / FORMULARIO ---
function openAlertaForm(editData = null) {
    alertasEditMode = !!editData;
    alertasCurrentId = editData?.id || null;
    alertasUbicaciones = [];
    alertasActores = [];
    alertasActoresDemandantes = [];
    alertasActoresDemandados = [];
    alertasDocumentos = [];

    document.getElementById('alertas-list-view')?.classList.add('d-none');
    document.getElementById('alertas-form-view')?.classList.remove('d-none');
    document.getElementById('alerta-form-title').textContent = editData ? 'Editar Alerta' : 'Registro de Nueva Alerta';

    // Fecha mínima = mañana (alertas preventivas deben ser a futuro)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    const fechaInput = document.getElementById('alerta-fecha-evento');
    if (fechaInput) fechaInput.min = tomorrowStr;

    if (editData) {
        fillAlertaForm(editData);
    } else {
        document.getElementById('alerta-form-el')?.reset();
        if (fechaInput) fechaInput.min = tomorrowStr;
        renderUbicacionesList('alerta', []);
        renderActoresDemandantesList('alerta', []);
        renderActoresDemandadosList('alerta', []);
        renderDocumentosList('alerta', []);
        unlinkConflicto('alerta');
    }

    // Scroll top
    document.getElementById('modulo-alertas')?.scrollTo(0, 0);
}

function closeAlertaForm() {
    document.getElementById('alertas-form-view')?.classList.add('d-none');
    document.getElementById('alertas-list-view')?.classList.remove('d-none');
}

// --- FIREBASE CRUD ---
function loadAlertasFromFirebase() {
    const ref = fbRef('alertas');
    if (!ref) return;
    ref.orderByChild('timestamp').limitToLast(50).on('value', snap => {
        const data = snap.val() || {};
        alertasRecords = Object.entries(data).map(([id, v]) => ({ id, ...v }))
            .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        renderAlertasList();
    });
}

function renderAlertasList() {
    const list = document.getElementById('alertas-records-list');
    if (!list) return;

    if (!alertasRecords.length) {
        list.innerHTML = '<p class="empty-state">No hay alertas registradas.</p>';
        return;
    }

    list.innerHTML = alertasRecords.map(a => {
        const fecha = a.fecha || new Date(a.timestamp).toLocaleDateString('es-PE');
        const clasifColor = { 'Conflicto social activo': '#e74c3c', 'Emergencia social': '#e74c3c', 'Conflicto social latente': '#e67e22', 'Alerta temprana': '#f39c12' };
        const color = clasifColor[a.clasificacion] || '#3498db';
        return `
        <div class="record-card" style="border-left: 4px solid ${color};">
            <div class="record-card-header">
                <div>
                    <span class="record-tag" style="background:${color};">${a.clasificacion || 'Sin clasificar'}</span>
                    <h4 class="record-title">${a.nombreEvento || 'Sin nombre'}</h4>
                </div>
                <span class="record-date">${fecha}</span>
            </div>
            <p class="record-desc">${(a.descripcion || '').substring(0, 100)}${a.descripcion?.length > 100 ? '...' : ''}</p>
            <div class="record-footer">
                <span>📍 ${(a.ubicaciones || []).map(u => u.departamento).join(', ') || 'Sin ubicación'}</span>
                <div class="record-actions">
                    <button class="btn-record-edit" onclick="editAlerta('${a.id}')">✏️ Editar</button>
                    <button class="btn-record-delete" onclick="deleteAlerta('${a.id}')">🗑️</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

async function saveAlerta() {
    const btn = document.getElementById('guardar-alerta-btn');
    const nombreEvento = document.getElementById('alerta-nombre-evento')?.value.trim();
    const clasificacion = document.getElementById('alerta-clasificacion')?.value;

    if (!nombreEvento) return alert('El nombre del evento es obligatorio.');
    if (!clasificacion) return alert('La clasificación de la alerta es obligatoria.');

    btn.disabled = true;
    btn.textContent = 'Guardando... ⏳';

    // Subir archivos a Firebase Storage
    const docsWithUrls = await uploadAlertaDocumentos();

    const data = {
        nombreEvento,
        clasificacion,
        fechaEvento: document.getElementById('alerta-fecha-evento')?.value || new Date().toISOString().split('T')[0],
        fuenteInfo: document.getElementById('alerta-fuente-info')?.value || '',
        linkFuente: document.getElementById('alerta-link-fuente')?.value || '',
        comisionado: document.getElementById('alerta-comisionado')?.value || '',
        oficina: document.getElementById('alerta-oficina')?.value || '',
        descripcion: document.getElementById('alerta-descripcion')?.value || '',
        demandas: document.getElementById('alerta-demandas')?.value || '',
        tipoMedida: document.getElementById('alerta-tipo-medida')?.value || '',
        tipoDemanda: document.getElementById('alerta-tipo-demanda')?.value || '',
        conflictoVinculado: window._alertaConflictoVinculado || null,
        ubicaciones: alertasUbicaciones,
        actores: [...alertasActoresDemandantes, ...alertasActoresDemandados],
        actoresDemandantes: alertasActoresDemandantes,
        actoresDemandados: alertasActoresDemandados,
        riesgoProbabilidad: document.getElementById('alerta-riesgo-prob')?.value || '',
        riesgoImpacto: document.getElementById('alerta-riesgo-impacto')?.value || '',
        nivelRiesgo: document.getElementById('alerta-nivel-riesgo')?.textContent || '',
        documentos: docsWithUrls,
        registradoPor: localStorage.getItem('dp_last_supervisor') || '',
        timestamp: alertasCurrentId ? (alertasRecords.find(r => r.id === alertasCurrentId)?.timestamp || Date.now()) : Date.now(),
        fecha: new Date().toISOString().split('T')[0],
        updatedAt: Date.now()
    };

    try {
        const ref = alertasCurrentId ? fbRef('alertas/' + alertasCurrentId) : fbRef('alertas').push();
        if (ref) {
            alertasCurrentId ? await ref.set(data) : await ref.set(data);
            // Sincronizar con Google Sheets (fire-and-forget)
            syncAlertaToSheets({ ...data, firebaseId: alertasCurrentId || ref.key });
            closeAlertaForm();
        }
    } catch (e) {
        // Offline fallback
        addToOfflineQueue({ path: alertasCurrentId ? 'alertas/' + alertasCurrentId : 'alertas/__push', data, action: alertasCurrentId ? 'set' : 'push' });
        showOfflineBadge();
        closeAlertaForm();
        alert('Sin conexión. El registro se guardará cuando recuperes señal. ✅');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Guardar';
    }
}

function syncAlertaToSheets(data) {
    if (typeof GOOGLE_SHEETS_URL === 'undefined' || !GOOGLE_SHEETS_URL) return;
    fetch(GOOGLE_SHEETS_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'alerta', ...data })
    }).catch(e => console.warn('[Sheets sync alerta]', e));
}

async function uploadAlertaDocumentos() {
    const results = [];
    for (const doc of alertasDocumentos) {
        if (doc.url) { results.push(doc); continue; } // ya subido
        if (doc.file && _fbStorage) {
            try {
                // Comprimir solo imágenes; videos y docs se suben tal cual
                let fileToUpload = doc.file;
                if (doc.type?.startsWith('image/')) {
                    fileToUpload = await compressImage(doc.file);
                }
                const ref = _fbStorage.ref('alertas_docs/' + Date.now() + '_' + doc.name);
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

function editAlerta(id) {
    const record = alertasRecords.find(r => r.id === id);
    if (record) openAlertaForm(record);
}

function deleteAlerta(id) {
    if (!confirm('¿Eliminar esta alerta?')) return;
    const ref = fbRef('alertas/' + id);
    if (ref) ref.remove();
}

function fillAlertaForm(data) {
    document.getElementById('alerta-nombre-evento').value = data.nombreEvento || '';
    document.getElementById('alerta-fecha-evento').value = data.fechaEvento || '';
    document.getElementById('alerta-clasificacion').value = data.clasificacion || '';
    document.getElementById('alerta-fuente-info').value = data.fuenteInfo || '';
    document.getElementById('alerta-link-fuente').value = data.linkFuente || '';
    document.getElementById('alerta-comisionado').value = data.comisionado || '';
    document.getElementById('alerta-oficina').value = data.oficina || '';
    document.getElementById('alerta-descripcion').value = data.descripcion || '';
    document.getElementById('alerta-demandas').value = data.demandas || '';
    document.getElementById('alerta-tipo-medida').value = data.tipoMedida || '';
    document.getElementById('alerta-tipo-demanda').value = data.tipoDemanda || '';
    document.getElementById('alerta-riesgo-prob').value = data.riesgoProbabilidad || '';
    document.getElementById('alerta-riesgo-impacto').value = data.riesgoImpacto || '';

    alertasUbicaciones = data.ubicaciones || [];
    alertasActoresDemandantes = data.actoresDemandantes || (data.actores || []).filter(a => a.rol === 'Demandante');
    alertasActoresDemandados = data.actoresDemandados || (data.actores || []).filter(a => a.rol === 'Demandado');
    alertasActores = [...alertasActoresDemandantes, ...alertasActoresDemandados];
    alertasDocumentos = data.documentos || [];

    renderUbicacionesList('alerta', alertasUbicaciones);
    renderActoresDemandantesList('alerta', alertasActoresDemandantes);
    renderActoresDemandadosList('alerta', alertasActoresDemandados);
    renderDocumentosList('alerta', alertasDocumentos);

    if (data.conflictoVinculado) {
        window._alertaConflictoVinculado = data.conflictoVinculado;
        renderConflictoVinculado('alerta', data.conflictoVinculado);
    }

    calcularNivelRiesgo('alerta');
}

// =============================================
// COMPONENTES DINÁMICOS COMPARTIDOS (Alerta/ACP)
// =============================================

// --- UBICACIONES ---
function addUbicacionRow(formPrefix) {
    const list = formPrefix === 'alerta' ? alertasUbicaciones : acpUbicaciones;
    list.push({ departamento: '', provincia: '', distrito: '', poblado: '' });
    renderUbicacionesList(formPrefix, list);
}

function renderUbicacionesList(formPrefix, list) {
    const container = document.getElementById(formPrefix + '-ubicaciones-list');
    if (!container) return;

    if (!list.length) {
        container.innerHTML = '<p class="empty-state-sm">No hay ubicaciones agregadas.</p>';
        return;
    }

    container.innerHTML = list.map((ub, idx) => {
        const deptOptions = Object.keys(UBIGEO_PERU).map(d => `<option value="${d}" ${ub.departamento === d ? 'selected' : ''}>${d}</option>`).join('');
        const provOptions = ub.departamento && UBIGEO_PERU[ub.departamento]
            ? UBIGEO_PERU[ub.departamento].map(p => `<option value="${p}" ${ub.provincia === p ? 'selected' : ''}>${p}</option>`).join('')
            : '';

        return `
        <div class="dynamic-row" id="${formPrefix}-ub-${idx}">
            <div class="dynamic-row-header">
                <strong>Ubicación ${idx + 1}</strong>
                <button class="btn-delete-row" onclick="removeUbicacion('${formPrefix}', ${idx})">🗑️</button>
            </div>
            <div class="ubicacion-grid">
                <select class="form-input" onchange="onDeptChange('${formPrefix}', ${idx}, this.value)">
                    <option value="">Departa...</option>${deptOptions}
                </select>
                <select class="form-input" id="${formPrefix}-prov-${idx}" onchange="onProvChange('${formPrefix}', ${idx}, this.value)">
                    <option value="">Provincia</option>${provOptions}
                </select>
                <input type="text" class="form-input" placeholder="Distrito" value="${ub.distrito || ''}" oninput="updateUbicacion('${formPrefix}', ${idx}, 'distrito', this.value)">
                <input type="text" class="form-input" placeholder="Poblado / Lugar" value="${ub.poblado || ''}" oninput="updateUbicacion('${formPrefix}', ${idx}, 'poblado', this.value)">
            </div>
        </div>`;
    }).join('');
}

function onDeptChange(formPrefix, idx, dept) {
    const list = formPrefix === 'alerta' ? alertasUbicaciones : acpUbicaciones;
    list[idx].departamento = dept;
    list[idx].provincia = '';
    renderUbicacionesList(formPrefix, list);
}

function onProvChange(formPrefix, idx, prov) {
    const list = formPrefix === 'alerta' ? alertasUbicaciones : acpUbicaciones;
    list[idx].provincia = prov;
}

function updateUbicacion(formPrefix, idx, field, value) {
    const list = formPrefix === 'alerta' ? alertasUbicaciones : acpUbicaciones;
    if (list[idx]) list[idx][field] = value;
}

function removeUbicacion(formPrefix, idx) {
    const list = formPrefix === 'alerta' ? alertasUbicaciones : acpUbicaciones;
    list.splice(idx, 1);
    renderUbicacionesList(formPrefix, list);
}

// --- ACTORES ---
const TIPOS_ACTOR = ["Sindicato", "Organización social", "Comunidad campesina", "Comunidad nativa", "Empresa privada", "Entidad estatal", "Partido político", "Organización religiosa", "Otro"];

function _getActorList(formPrefix, rol) {
    if (formPrefix === 'alerta') return rol === 'Demandante' ? alertasActoresDemandantes : alertasActoresDemandados;
    return rol === 'Demandante' ? acpActoresDemandantes : acpActoresDemandados;
}

function addActorByRole(formPrefix, rol) {
    _getActorList(formPrefix, rol).push({ nombre: '', tipo: '', rol });
    if (rol === 'Demandante') renderActoresDemandantesList(formPrefix, _getActorList(formPrefix, rol));
    else renderActoresDemandadosList(formPrefix, _getActorList(formPrefix, rol));
}

function _renderActoresByRol(formPrefix, rol, list, containerId, emptyMsg) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!list.length) {
        container.innerHTML = `<p class="empty-state-sm">${emptyMsg}</p>`;
        return;
    }
    container.innerHTML = list.map((actor, idx) => `
        <div class="dynamic-row">
            <div class="dynamic-row-header">
                <strong>Actor ${idx + 1}</strong>
                <button class="btn-delete-row" onclick="removeActorByRole('${formPrefix}', '${rol}', ${idx})">🗑️</button>
            </div>
            <div class="actor-grid">
                <input type="text" class="form-input" placeholder="Nombre del actor / organización" value="${actor.nombre || ''}" oninput="updateActorByRole('${formPrefix}', '${rol}', ${idx}, 'nombre', this.value)">
                <select class="form-input" onchange="updateActorByRole('${formPrefix}', '${rol}', ${idx}, 'tipo', this.value)">
                    <option value="">Tipo de actor</option>
                    ${TIPOS_ACTOR.map(t => `<option value="${t}" ${actor.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
        </div>`).join('');
}

function renderActoresDemandantesList(formPrefix, list) {
    _renderActoresByRol(formPrefix, 'Demandante', list, formPrefix + '-actores-demandantes-list', 'Agregue actores demandantes.');
}

function renderActoresDemandadosList(formPrefix, list) {
    _renderActoresByRol(formPrefix, 'Demandado', list, formPrefix + '-actores-demandados-list', 'Agregue actores demandados.');
}

function updateActorByRole(formPrefix, rol, idx, field, value) {
    const list = _getActorList(formPrefix, rol);
    if (list[idx]) list[idx][field] = value;
}

function removeActorByRole(formPrefix, rol, idx) {
    const list = _getActorList(formPrefix, rol);
    list.splice(idx, 1);
    if (rol === 'Demandante') renderActoresDemandantesList(formPrefix, list);
    else renderActoresDemandadosList(formPrefix, list);
}

// Legacy – para compatibilidad con cualquier referencia existente
function addActorRow(formPrefix) { addActorByRole(formPrefix, 'Demandante'); }
function renderActoresList(formPrefix) {
    renderActoresDemandantesList(formPrefix, _getActorList(formPrefix, 'Demandante'));
    renderActoresDemandadosList(formPrefix, _getActorList(formPrefix, 'Demandado'));
}

// --- DOCUMENTOS (Drag & Drop) ---
function handleFilesAlerta(files) {
    Array.from(files).forEach(file => {
        const isVideo = file.type.startsWith('video/');
        const isImage = file.type.startsWith('image/');
        if (isVideo && file.size > 200 * 1024 * 1024) {
            alert(`"${file.name}" supera los 200 MB. Selecciona un video más corto.`);
            return;
        }
        const previewUrl = (isImage || isVideo) ? URL.createObjectURL(file) : null;
        alertasDocumentos.push({ name: file.name, type: file.type, file, url: '', previewUrl });
    });
    renderDocumentosList('alerta', alertasDocumentos);
}

function renderDocumentosList(formPrefix, list) {
    const container = document.getElementById(formPrefix + '-docs-list');
    if (!container) return;
    container.innerHTML = list.map((doc, idx) => {
        const isImage = doc.type?.startsWith('image/');
        const isVideo = doc.type?.startsWith('video/');
        let previewHtml = '';
        if (isImage && doc.previewUrl) {
            previewHtml = `<img src="${doc.previewUrl}" style="width:56px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;">`;
        } else if (isVideo && doc.previewUrl) {
            previewHtml = `<video src="${doc.previewUrl}" style="width:56px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;" muted playsinline></video>`;
        } else {
            previewHtml = `<span class="doc-icon" style="font-size:1.5rem;flex-shrink:0;">${getDocIcon(doc.type)}</span>`;
        }
        const size = doc.file ? (doc.file.size > 1024*1024 ? (doc.file.size/1024/1024).toFixed(1)+' MB' : (doc.file.size/1024).toFixed(0)+' KB') : '';
        return `
        <div class="doc-item" style="align-items:center;">
            ${previewHtml}
            <span class="doc-name" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${doc.name}<br><small style="color:#999;">${size}</small></span>
            ${doc.url ? `<a href="${doc.url}" target="_blank" class="doc-link">Ver</a>` : '<span class="doc-pending">Pendiente</span>'}
            <button class="btn-delete-row" onclick="removeDoc('${formPrefix}', ${idx})">✕</button>
        </div>`;
    }).join('') || '';
}

function getDocIcon(type) {
    if (type?.includes('pdf')) return '📄';
    if (type?.includes('image')) return '🖼️';
    if (type?.includes('video')) return '🎥';
    if (type?.includes('word') || type?.includes('document')) return '📝';
    return '📎';
}

function removeDoc(formPrefix, idx) {
    const list = formPrefix === 'alerta' ? alertasDocumentos : acpDocumentos;
    list.splice(idx, 1);
    renderDocumentosList(formPrefix, list);
}

// --- ANÁLISIS DE RIESGO ---
// Escala 1–3 por dimensión; producto 1–9:
//   1–3 = Bajo | 4–6 = Intermedio | 7–9 = Alto
function calcularNivelRiesgo(formPrefix) {
    const p = parseInt(document.getElementById(formPrefix + '-riesgo-prob')?.value) || 0;
    const i = parseInt(document.getElementById(formPrefix + '-riesgo-impacto')?.value) || 0;
    const nivelEl = document.getElementById(formPrefix + '-nivel-riesgo');
    if (!nivelEl) return;

    const score = p * i;
    let nivel = '-', color = '#ccc';
    if (score > 0) {
        if (score <= 3) { nivel = 'Bajo'; color = '#27ae60'; }
        else if (score <= 6) { nivel = 'Intermedio'; color = '#f39c12'; }
        else { nivel = 'Alto'; color = '#e74c3c'; }
    }
    nivelEl.textContent = nivel;
    nivelEl.style.background = color;
    nivelEl.style.color = 'white';
    nivelEl.style.padding = '4px 12px';
    nivelEl.style.borderRadius = '20px';
    nivelEl.style.fontWeight = '700';
}

// --- VINCULAR CONFLICTO ---
let _alertaConflictoVinculado = null;

function openConflictoSearch(formPrefix) {
    // Búsqueda simple en Firebase
    const query = prompt('Buscar conflicto por nombre:');
    if (!query) return;
    const ref = fbRef('conflictos');
    if (!ref) return alert('Sin conexión a Firebase.');

    ref.orderByChild('nombre').startAt(query).endAt(query + '').limitToFirst(5).once('value', snap => {
        const data = snap.val();
        if (!data) { alert('No se encontraron conflictos con ese nombre.'); return; }

        const options = Object.entries(data);
        const nombres = options.map(([id, c], i) => `${i + 1}. ${c.nombre || id}`).join('\n');
        const sel = prompt('Selecciona el número:\n' + nombres);
        const idx = parseInt(sel) - 1;
        if (idx >= 0 && idx < options.length) {
            const [id, conflicto] = options[idx];
            if (formPrefix === 'alerta') window._alertaConflictoVinculado = { id, nombre: conflicto.nombre };
            else window._acpConflictoVinculado = { id, nombre: conflicto.nombre }
        }
    });
}

function renderConflictoVinculado(formPrefix, conflicto) {
    const container = document.getElementById(formPrefix + '-conflicto-container');
    if (!container) return;
    container.innerHTML = `
        <div class="conflicto-card">
            <span>🔗 ${conflicto.nombre}</span>
            <button class="btn-delete-row" onclick="unlinkConflicto('${formPrefix}')">✕</button>
        </div>`;
    document.getElementById(formPrefix + '-desvincular-conflicto')?.classList.remove('d-none');
}

function unlinkConflicto(formPrefix) {
    if (formPrefix === 'alerta') window._alertaConflictoVinculado = null;
    else window._acpConflictoVinculado = null;
    const container = document.getElementById(formPrefix + '-conflicto-container');
    if (container) container.innerHTML = `
        <div class="conflicto-placeholder">
            <span class="info-icon">ℹ️</span>
            <p>No hay conflicto vinculado. Use el botón "Buscar conflicto" para asociar uno.</p>
        </div>`;
}

// Exponer para onclick en HTML
window.editAlerta = editAlerta;
window.deleteAlerta = deleteAlerta;
window.addUbicacionRow = addUbicacionRow;
window.addActorRow = addActorRow;
window.addActorByRole = addActorByRole;
window.removeUbicacion = removeUbicacion;
window.removeActor = removeActor;
window.removeActorByRole = removeActorByRole;
window.updateUbicacion = updateUbicacion;
window.updateActorByRole = updateActorByRole;
window.onDeptChange = onDeptChange;
window.onProvChange = onProvChange;
window.removeDoc = removeDoc;
window.calcularNivelRiesgo = calcularNivelRiesgo;
window.openConflictoSearch = openConflictoSearch;
window.unlinkConflicto = unlinkConflicto;
window.openAlertaForm = openAlertaForm;
window.renderActoresDemandantesList = renderActoresDemandantesList;
window.renderActoresDemandadosList = renderActoresDemandadosList;
window.initAlertasModule = initAlertasModule;
