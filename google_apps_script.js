// =========================================================================================
// GOOGLE APPS SCRIPT v5.0 - HYBRID REAL-TIME + ALERTAS + ACP
// =========================================================================================

// ── CABECERAS DE HOJAS ────────────────────────────────────────────────────────────────────
var HEADERS_ALERTAS = [
    "Código", "Fecha Registro", "Fecha Evento", "Nombre del Evento",
    "Clasificación", "Nivel de Riesgo", "Probabilidad", "Impacto",
    "Tipo de Medida", "Tipo de Demanda", "Demandas", "Descripción",
    "Fuente de Información", "Link Fuente",
    "Comisionado", "Oficina",
    "Ubicaciones", "Actores", "Conflicto Vinculado",
    "Documentos (URLs)", "Registrado Por", "ID Firebase"
];

var HEADERS_ACP = [
    "Código", "Fecha Registro", "Fecha Evento", "Nombre del Evento",
    "Tipo de Medida", "Tipo de Demanda", "Demandas", "Descripción",
    "Fuente de Información", "Link Fuente",
    "Comisionado", "Oficina",
    "Ubicaciones", "Actores", "¿Hubo Violencia?",
    "Cantidad Personas", "Cantidad Terceros",
    "N° Heridos", "N° Detenidos", "N° Fallecidos", "N° Desaparecidos",
    "Heridos - Detalle", "Detenidos - Detalle", "Fallecidos - Detalle", "Desaparecidos - Detalle",
    "Conflicto Vinculado", "Documentos (URLs)", "Registrado Por", "ID Firebase"
];

// 1. DO GET: PARA EL TABLERO Y APP (LECTURA DE TRES HOJAS)
function doGet(e) {
    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();

        // Leer Registros
        var sheetRegistros = ss.getSheetByName("Registros") || ss.getSheets()[0];
        var dataRegistros = sheetRegistros.getDataRange().getValues();

        // Leer Incidencias
        var sheetIncidencias = ss.getSheetByName("Incidencias");
        var dataIncidencias = [];
        if (sheetIncidencias) {
            dataIncidencias = sheetIncidencias.getDataRange().getValues();
        }

        // Leer Configuración (Listas Dinámicas)
        var sheetConfig = ss.getSheetByName("Configuracion");
        var configData = { 
            lugares: [], protestas: [], 
            comisarias: [], centros_salud: [],
            videovigilancia: [],
            contactos: [] 
        };

        if (sheetConfig) {
            var lastRow = sheetConfig.getLastRow();
            var lastCol = sheetConfig.getLastColumn();
            if (lastRow > 1) {
                var range = sheetConfig.getRange(2, 1, lastRow - 1, Math.max(2, lastCol)).getValues();

                // Filtrar vacíos
                configData.lugares = range.map(r => r[0]).filter(x => x);
                configData.protestas = range.map(r => r[1]).filter(x => x);
                if (lastCol >= 3) configData.comisarias = range.map(r => r[2]).filter(x => x);
                if (lastCol >= 4) configData.centros_salud = range.map(r => r[3]).filter(x => x);
                if (lastCol >= 5) configData.videovigilancia = range.map(r => r[4]).filter(x => x);
                
                // Contactos: Columnas F(6), G(7), H(8), I(9) -> índices 5, 6, 7, 8
                if (lastCol >= 7) { // Mínimo nombre y número
                    for (var i = 0; i < range.length; i++) {
                        var nombre = range[i][5];
                        var numero = range[i][6];
                        var cargo = range[i][7] || "";
                        var oficina = range[i][8] || "";
                        if (nombre && numero) {
                            configData.contactos.push({
                                nombre: nombre,
                                numero: numero,
                                cargo: cargo,
                                oficina: oficina
                            });
                        }
                    }
                }
            }
        }

        var response = {
            registros: dataRegistros,
            incidencias: dataIncidencias,
            config: configData
        };

        return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);
    } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({ error: e.toString() }))
            .setMimeType(ContentService.MimeType.JSON);
    }
}

// 2. DO POST: PARA LA APP (ESCRITURA EN TIEMPO REAL Y CONFIG)
function doPost(e) {
    var lock = LockService.getScriptLock();
    lock.tryLock(30000);

    try {
        var ss = SpreadsheetApp.getActiveSpreadsheet();
        var data = JSON.parse(e.postData.contents);
        var action = data.action || 'full_upload';

        var sheetRegistros = ss.getSheetByName("Registros") || ss.getSheets()[0];
        var sheetIncidencias = getOrCreateSheet(ss, "Incidencias");
        var sheetConfig = getOrCreateConfigSheet(ss); // Auto-crear si no existe

        // Indices clave para buscar y actualizar filas
        var headers = sheetRegistros.getRange(1, 1, 1, sheetRegistros.getLastColumn()).getValues()[0];
        var headerMap = {};
        for (var i = 0; i < headers.length; i++) {
            headerMap[headers[i].toString().toLowerCase().trim()] = i + 1;
        }

        function getColIndex(namesArray) {
            for (var name of namesArray) {
                var key = name.toLowerCase();
                if (headerMap[key]) return headerMap[key];
            }
            return -1;
        }

        var idxSession = getColIndex(["SessionID", "ID", "ID Supervision"]);
        var idxFin = getColIndex(["Fin", "Hora Fin"]);
        var idxDuracion = getColIndex(["Duracion", "Duración", "Duración (h)", "Duracion (h)"]);
        var idxObs = getColIndex(["Observaciones", "Obs"]);

        // --- ACCIÓN: AGREGAR ITEM A LISTA (NUEVO) ---
        if (action === 'add_list_item') {
            var val = data.value;
            if (val) {
                var colIndex = 1;
                if (data.type === 'lugar') colIndex = 1;
                else if (data.type === 'protesta') colIndex = 2;
                else if (data.type === 'comisaria') colIndex = 3;
                else if (data.type === 'salud') colIndex = 4;
                else if (data.type === 'video') colIndex = 5;

                var lastRowItem = getLastRowInColumn(sheetConfig, colIndex);
                sheetConfig.getRange(lastRowItem + 1, colIndex).setValue(val);
            }
        }

        // --- ACCIÓN: INICIO (O FULL UPLOAD VIEJO) ---
        else if (action === 'start' || action === 'full_upload') {
            var mainFileUrl = "";
            if (data.mediaData) {
                mainFileUrl = saveToDrive(data.mediaData, data.mediaType, data.archivo);
            }

            // Creamos la fila inicial
            var newRow = [
                data.fecha,
                data.tipo_registro,
                data.turno,
                data.oficina,
                data.supervisor,
                data.nombre_protesta,
                data.categoria,
                data.punto,
                data.inicio,
                data.fin || "",
                data.lat_inicio,
                data.lng_inicio,
                data.lat_fin || "",
                data.lng_fin || "",
                data.duracion || "",
                data.fin_de_semana,
                mainFileUrl,
                data.observaciones,
                data.sessionId
            ];

            sheetRegistros.appendRow(newRow);
        }

        // --- ACCIÓN: NUEVA INCIDENCIA (TIEMPO REAL) ---
        else if (action === 'incident') {
            if (data.new_incident) {
                var inc = data.new_incident;
                var incUrl = "";
                if (inc.mediaData) incUrl = saveToDrive(inc.mediaData, inc.mediaType, inc.fileName);

                sheetIncidencias.appendRow([
                    data.sessionId,
                    data.fecha,
                    data.supervisor,
                    data.oficina,
                    inc.time,
                    inc.description,
                    incUrl,
                    "", // H: Foto (Vacia, el link va en G)
                    inc.lat || "", // I: Latitud
                    inc.lng || "", // J: Longitud
                    inc.tipoRegistro || "Incidencia", // K: Tipo
                    inc.clasificacion || "",          // L: Clasificacion
                    inc.cantidad || ""                // M: Cantidad
                ]);
            }
        }

        // --- ACCIÓN: FINALIZAR (SÓLO ACTUALIZA LA FILA) ---
        else if (action === 'finish') {
            if (idxSession > 0) {
                var rowIndex = findRowBySessionId(sheetRegistros, idxSession, data.sessionId);
                if (rowIndex > 0) {
                    if (idxFin > 0) sheetRegistros.getRange(rowIndex, idxFin).setValue(data.fin);
                    if (idxDuracion > 0) sheetRegistros.getRange(rowIndex, idxDuracion).setValue(data.duracion);
                    if (idxObs > 0 && data.observaciones) sheetRegistros.getRange(rowIndex, idxObs).setValue(data.observaciones);
                }
            }
        }

        // --- ACCIÓN: GUARDAR ALERTA DEFENSORIAL ---
        else if (action === 'alerta') {
            var sheetAlertas = getOrCreateSheetWithHeaders(ss, "Alertas", HEADERS_ALERTAS);
            var d = data;
            var year = new Date().getFullYear();

            // Buscar si ya existe el registro (actualización)
            var existingRow = d.firebaseId ? findRowByFirebaseId(sheetAlertas, 22, d.firebaseId) : -1;

            // Formatear arrays
            var ubicStr = (d.ubicaciones || [])
                .map(function(u) { return [u.departamento, u.provincia, u.distrito, u.poblado].filter(Boolean).join(', '); })
                .filter(Boolean).join(' | ');
            var actoresStr = (d.actores || [])
                .map(function(a) { return [a.nombre, a.tipo, a.rol].filter(Boolean).join(' - '); })
                .filter(Boolean).join(' | ');
            var docsStr = (d.documentos || [])
                .map(function(x) { return x.url || ''; })
                .filter(Boolean).join(' | ');
            var conflicto = d.conflictoVinculado
                ? (d.conflictoVinculado.nombre || d.conflictoVinculado.id || JSON.stringify(d.conflictoVinculado))
                : '';

            // Código secuencial
            var lastRow = sheetAlertas.getLastRow();
            var seqNum = existingRow > 0 ? '' : String(Math.max(lastRow, 1)).padStart(3, '0');
            var codigo = existingRow > 0
                ? sheetAlertas.getRange(existingRow, 1).getValue()
                : 'AlerT-' + seqNum + '-' + year;

            var row = [
                codigo,
                d.fecha || new Date().toISOString().split('T')[0],
                d.fechaEvento || '',
                d.nombreEvento || '',
                d.clasificacion || '',
                d.nivelRiesgo || '',
                d.riesgoProbabilidad || '',
                d.riesgoImpacto || '',
                d.tipoMedida || '',
                d.tipoDemanda || '',
                d.demandas || '',
                d.descripcion || '',
                d.fuenteInfo || '',
                d.linkFuente || '',
                d.comisionado || '',
                d.oficina || '',
                ubicStr,
                actoresStr,
                conflicto,
                docsStr,
                d.registradoPor || '',
                d.firebaseId || ''
            ];

            if (existingRow > 0) {
                sheetAlertas.getRange(existingRow, 1, 1, row.length).setValues([row]);
            } else {
                sheetAlertas.appendRow(row);
                // Colorear fila según riesgo
                colorearFilaRiesgo(sheetAlertas, sheetAlertas.getLastRow(), d.nivelRiesgo || '');
            }
        }

        // --- ACCIÓN: GUARDAR ACP ---
        else if (action === 'acp') {
            var sheetACP = getOrCreateSheetWithHeaders(ss, "ACP", HEADERS_ACP);
            var d = data;
            var year = new Date().getFullYear();

            var existingRow = d.firebaseId ? findRowByFirebaseId(sheetACP, 29, d.firebaseId) : -1;

            var ubicStr = (d.ubicaciones || [])
                .map(function(u) { return [u.departamento, u.provincia, u.distrito, u.poblado].filter(Boolean).join(', '); })
                .filter(Boolean).join(' | ');
            var actoresStr = (d.actores || [])
                .map(function(a) { return [a.nombre, a.tipo, a.rol].filter(Boolean).join(' - '); })
                .filter(Boolean).join(' | ');

            function detallePersonas(arr) {
                return (arr || []).map(function(p) {
                    return [p.nombre, p.edad ? p.edad + ' años' : '', p.genero, p.condicion, p.hospital].filter(Boolean).join(', ');
                }).filter(Boolean).join(' | ');
            }

            var docsStr = (d.documentos || []).map(function(x) { return x.url || ''; }).filter(Boolean).join(' | ');
            var conflicto = d.conflictoVinculado
                ? (d.conflictoVinculado.nombre || d.conflictoVinculado.id || JSON.stringify(d.conflictoVinculado))
                : '';

            var lastRow = sheetACP.getLastRow();
            var seqNum = existingRow > 0 ? '' : String(Math.max(lastRow, 1)).padStart(3, '0');
            var codigo = existingRow > 0
                ? sheetACP.getRange(existingRow, 1).getValue()
                : 'ACP-' + seqNum + '-' + year;

            var row = [
                codigo,
                d.fecha || new Date().toISOString().split('T')[0],
                d.fechaEvento || '',
                d.nombreEvento || '',
                d.tipoMedida || '',
                d.tipoDemanda || '',
                d.demandas || '',
                d.descripcion || '',
                d.fuenteInfo || '',
                d.linkFuente || '',
                d.comisionado || '',
                d.oficina || '',
                ubicStr,
                actoresStr,
                d.huboViolencia || '',
                d.cantidadPersonas || 0,
                d.cantidadTerceros || 0,
                (d.heridas || []).length,
                (d.detenidas || []).length,
                (d.fallecidas || []).length,
                (d.desaparecidas || []).length,
                detallePersonas(d.heridas),
                detallePersonas(d.detenidas),
                detallePersonas(d.fallecidas),
                detallePersonas(d.desaparecidas),
                conflicto,
                docsStr,
                d.registradoPor || '',
                d.firebaseId || ''
            ];

            if (existingRow > 0) {
                sheetACP.getRange(existingRow, 1, 1, row.length).setValues([row]);
            } else {
                sheetACP.appendRow(row);
                // Colorear si hubo violencia
                if ((d.huboViolencia || '').toLowerCase() === 'sí') {
                    sheetACP.getRange(sheetACP.getLastRow(), 1, 1, row.length)
                        .setBackground('#fce4e4');
                }
            }
        }

        // --- ACCIÓN: GENERAR REPORTE DOC ---
        else if (action === 'generate_report') {
            var templateId = data.templateId;
            var folderId = data.folderId;
            var fecha = data.fecha;
            var tableData = data.tableData;

            var folder = DriveApp.getFolderById(folderId);
            var template = DriveApp.getFileById(templateId);
            var newDocFile = template.makeCopy("Reporte de Monitoreo - " + fecha, folder);
            var newDocId = newDocFile.getId();
            var doc = DocumentApp.openById(newDocId);
            var body = doc.getBody();

            body.replaceText("{{fecha_protesta}}", fecha);

            var tables = body.getTables();
            var targetTable = null;
            var targetRowIndex = -1;

            for (var i = 0; i < tables.length; i++) {
                var table = tables[i];
                for (var r = 0; r < table.getNumRows(); r++) {
                    var row = table.getRow(r);
                    if (row.getText().indexOf("{{tabla_ubicacion}}") !== -1) {
                        targetTable = table;
                        targetRowIndex = r;
                        break;
                    }
                }
                if (targetTable) break;
            }

            if (targetTable && targetRowIndex !== -1) {
                var templateRow = targetTable.getRow(targetRowIndex);
                for (var d = 0; d < tableData.length; d++) {
                    var item = tableData[d];
                    var newRow = targetTable.insertTableRow(targetRowIndex + 1 + d, templateRow.copy());
                    newRow.replaceText("{{tabla_ubicacion}}", item.ubicacion || "");
                    newRow.replaceText("{{tabla_medida}}", item.medida || "");
                    newRow.replaceText("{{tabla_actores}}", item.actores || "");
                }
                targetTable.removeRow(targetRowIndex);
            }

            doc.saveAndClose();
            return ContentService.createTextOutput(JSON.stringify({ success: true, url: newDocFile.getUrl() }))
                .setMimeType(ContentService.MimeType.JSON);
        }

        return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);

    } catch (e) {
        return ContentService.createTextOutput("Error: " + e.toString()).setMimeType(ContentService.MimeType.TEXT);
    } finally {
        lock.releaseLock();
    }
}

// --- HELPERS ---
function findRowBySessionId(sheet, colIndex, sessionId) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    var ids = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] == sessionId) {
            return i + 2;
        }
    }
    return -1;
}

function getOrCreateSheet(ss, name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(["ID Supervision", "Fecha", "Supervisor", "Oficina", "Hora Incidencia", "Descripción", "Foto Evidencia", "", "Latitud", "Longitud", "Tipo Registro", "Clasificación", "Cantidad"]);
    }
    return sheet;
}

function getOrCreateConfigSheet(ss) {
    var sheet = ss.getSheetByName("Configuracion");
    if (!sheet) {
        sheet = ss.insertSheet("Configuracion");
        sheet.appendRow(["Espacios Movilización", "Nombres Protestas", "Dependencias Policiales", "Establecimientos Salud", "Videovigilancia", "Nombre Contacto", "Número WhatsApp", "Cargo", "Oficina"]); // Headers
        // Datos por defecto para que no salga vacío la primera vez
        sheet.appendRow(["Plaza San Martín", "Marcha Nacional", "Comisaría Alfonso Ugarte", "Hospital Loayza", "Centro de Monitoreo", "Dr. Ejemplo", "51999888777", "Adjunto", "Lima"]);
        sheet.appendRow(["Plaza Dos de Mayo", "Protesta Genérica"]);
    }
    return sheet;
}

function getLastRowInColumn(sheet, col) {
    var lastRow = sheet.getLastRow();
    if (lastRow === 0) return 0;
    var range = sheet.getRange(1, col, lastRow, 1).getValues();
    for (var i = range.length - 1; i >= 0; i--) {
        if (range[i][0] !== "") {
            return i + 1;
        }
    }
    return 0;
}

// Crear hoja con cabeceras si no existe
function getOrCreateSheetWithHeaders(ss, name, headers) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
        sheet = ss.insertSheet(name);
        sheet.appendRow(headers);
        // Formatear fila de cabecera
        var headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setBackground('#0d47a1');
        headerRange.setFontColor('#ffffff');
        headerRange.setFontWeight('bold');
        headerRange.setWrap(true);
        sheet.setFrozenRows(1);
        sheet.setColumnWidths(1, headers.length, 150);
    }
    return sheet;
}

// Buscar fila por ID de Firebase en la última columna
function findRowByFirebaseId(sheet, totalCols, firebaseId) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;
    var ids = sheet.getRange(2, totalCols, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] == firebaseId) return i + 2;
    }
    return -1;
}

// Colorear fila según nivel de riesgo
function colorearFilaRiesgo(sheet, rowIndex, nivelRiesgo) {
    var nivel = (nivelRiesgo || '').toLowerCase();
    var color = '#ffffff';
    if (nivel.includes('muy alto')) color = '#fce4e4';
    else if (nivel.includes('alto')) color = '#fef3e2';
    else if (nivel.includes('medio') || nivel.includes('intermedio')) color = '#fffde7';
    else if (nivel.includes('bajo')) color = '#e8f5e9';
    if (color !== '#ffffff') {
        sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).setBackground(color);
    }
}

function saveToDrive(base64Data, mimeType, fileName) {
    try {
        if (!base64Data) return "";
        var decoded = Utilities.base64Decode(base64Data);
        var blob = Utilities.newBlob(decoded, mimeType, fileName);
        var folders = DriveApp.getFoldersByName("EVIDENCIA");
        var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("EVIDENCIA");
        var file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        return file.getUrl();
    } catch (err) {
        return "Error: " + err.toString();
    }
}
