// ─── Tab Navigation ────────────────────────────────────────────

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  });
});

// ─── Helpers ────────────────────────────────────────────────────

let lastDownloadFolder = "";
let downloadFolderOverride = "";
let editingClientId = null;

function log(el, msg) {
  el.value += msg + "\n";
  el.scrollTop = el.scrollHeight;
}

function showErrorModal(message) {
  document.getElementById("error-modal-text").textContent = message;
  document.getElementById("error-modal").classList.remove("hidden");
  window.api.focusWindow();
}

document.getElementById("error-modal-close").addEventListener("click", () => {
  document.getElementById("error-modal").classList.add("hidden");
});

document.getElementById("error-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById("error-modal").classList.add("hidden");
  }
});

// Listen for log messages from main process (Playwright logs)
window.api.onSatLog((msg) => {
  const logEl = document.getElementById("dl-log");
  if (logEl && document.getElementById("tab-descargar").classList.contains("active")) {
    log(logEl, msg);
  }
});

// ─── CLIENTES TAB ───────────────────────────────────────────────

async function loadClientTable() {
  const tbody = document.getElementById("cli-tbody");
  tbody.innerHTML = "";
  const rows = await window.api.dbGetAll();
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.dataset.id = r.id;
    tr.innerHTML = `
      <td>${r.id}</td>
      <td>${r.rfc}</td>
      <td>${r.razon_social}</td>
      <td>${r.ruta_cer.split("/").pop() || r.ruta_cer.split("\\").pop()}</td>
      <td>${r.ruta_key.split("/").pop() || r.ruta_key.split("\\").pop()}</td>
    `;
    tr.addEventListener("click", () => selectClient(r.id));
    tbody.appendChild(tr);
  }
}

async function selectClient(id) {
  const c = await window.api.dbGet(id);
  if (!c) return;
  editingClientId = c.id;
  document.getElementById("cli-rfc").value = c.rfc;
  document.getElementById("cli-razon").value = c.razon_social;
  document.getElementById("cli-cer").value = c.ruta_cer;
  document.getElementById("cli-key").value = c.ruta_key;
  document.getElementById("cli-password").value = c.password_llave;
  document.getElementById("cli-descarga").value = c.ruta_descarga || "";
  document.getElementById("cli-btn-save").textContent = "Actualizar";
  document.getElementById("cli-btn-delete").disabled = false;

  document.querySelectorAll("#cli-tbody tr").forEach((tr) => tr.classList.remove("selected"));
  const row = document.querySelector(`#cli-tbody tr[data-id="${id}"]`);
  if (row) row.classList.add("selected");
}

function clearClientForm() {
  editingClientId = null;
  ["cli-rfc", "cli-razon", "cli-cer", "cli-key", "cli-password", "cli-descarga"].forEach(
    (id) => (document.getElementById(id).value = "")
  );
  document.getElementById("cli-btn-save").textContent = "Guardar";
  document.getElementById("cli-btn-delete").disabled = true;
  document.querySelectorAll("#cli-tbody tr").forEach((tr) => tr.classList.remove("selected"));
}

document.getElementById("cli-btn-cer").addEventListener("click", async () => {
  const path = await window.api.openCer();
  if (path) document.getElementById("cli-cer").value = path;
});

document.getElementById("cli-btn-key").addEventListener("click", async () => {
  const path = await window.api.openKey();
  if (path) document.getElementById("cli-key").value = path;
});

document.getElementById("cli-btn-descarga").addEventListener("click", async () => {
  const path = await window.api.selectFolder();
  if (path) document.getElementById("cli-descarga").value = path;
});

document.getElementById("cli-btn-save").addEventListener("click", async () => {
  const data = {
    rfc: document.getElementById("cli-rfc").value.trim(),
    razon_social: document.getElementById("cli-razon").value.trim(),
    ruta_cer: document.getElementById("cli-cer").value.trim(),
    ruta_key: document.getElementById("cli-key").value.trim(),
    password_llave: document.getElementById("cli-password").value.trim(),
    ruta_descarga: document.getElementById("cli-descarga").value.trim(),
  };

  if (!data.rfc || !data.razon_social || !data.ruta_cer || !data.ruta_key || !data.password_llave) {
    alert("Todos los campos obligatorios deben llenarse");
    return;
  }

  if (editingClientId) {
    await window.api.dbUpdate(editingClientId, data);
  } else {
    await window.api.dbAdd(data);
  }
  clearClientForm();
  loadClientTable();
  loadClientCombo();
});

document.getElementById("cli-btn-clear").addEventListener("click", clearClientForm);

document.getElementById("cli-btn-delete").addEventListener("click", async () => {
  if (!editingClientId || !confirm("¿Eliminar este cliente?")) return;
  await window.api.dbDelete(editingClientId);
  clearClientForm();
  loadClientTable();
  loadClientCombo();
});

// ─── DOWNLOAD TAB ───────────────────────────────────────────────

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function populateMonthSelects() {
  const now = new Date();
  const y = now.getFullYear();
  const selects = ["dl-desde-mes", "dl-hasta-mes", "dl-mes"];
  for (const id of selects) {
    const sel = document.getElementById(id);
    sel.innerHTML = MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
    if (id === "dl-desde-mes") sel.value = "1";
    else sel.value = String(now.getMonth() + 1);
  }

  const anioSelects = ["dl-desde-anio", "dl-hasta-anio", "dl-anio"];
  for (const id of anioSelects) {
    const sel = document.getElementById(id);
    sel.innerHTML = "";
    for (let i = y - 3; i <= y; i++) {
      sel.innerHTML += `<option value="${i}">${i}</option>`;
    }
    sel.value = String(y);
  }
}

async function loadClientCombo() {
  const sel = document.getElementById("dl-cliente");
  sel.innerHTML = '<option value="">Seleccionar...</option>';
  const rows = await window.api.dbGetAll();
  for (const r of rows) {
    sel.innerHTML += `<option value="${r.id}">${r.id} - ${r.rfc} - ${r.razon_social}</option>`;
  }
}

let selectedClient = null;

document.getElementById("dl-cliente").addEventListener("change", async (e) => {
  const id = e.target.value;
  if (!id) {
    selectedClient = null;
    document.getElementById("dl-rfc").textContent = "";
    document.getElementById("dl-cer").textContent = "";
    document.getElementById("dl-key").textContent = "";
    document.getElementById("dl-password").textContent = "";
    document.getElementById("dl-btn-start").disabled = true;
    document.getElementById("dl-btn-convert").disabled = true;
    document.getElementById("dl-btn-retrieve").disabled = true;
    return;
  }
  selectedClient = await window.api.dbGet(Number(id));
  if (selectedClient) {
    document.getElementById("dl-rfc").textContent = selectedClient.rfc;
    document.getElementById("dl-cer").textContent = selectedClient.ruta_cer.split("/").pop() || selectedClient.ruta_cer.split("\\").pop();
    document.getElementById("dl-key").textContent = selectedClient.ruta_key.split("/").pop() || selectedClient.ruta_key.split("\\").pop();
    document.getElementById("dl-password").textContent = "•".repeat(selectedClient.password_llave.length);
    document.getElementById("dl-btn-start").disabled = false;
    document.getElementById("dl-btn-convert").disabled = false;
    document.getElementById("dl-btn-retrieve").disabled = false;
  }
});

document.getElementById("dl-btn-refresh").addEventListener("click", loadClientCombo);

document.querySelectorAll('input[name="modo"]').forEach(radio => {
  radio.addEventListener("change", () => {
    const isPeriodo = document.querySelector('input[name="modo"]:checked').value === "periodo";
    document.getElementById("periodo-range").classList.toggle("hidden", !isPeriodo);
    document.getElementById("periodo-mes").classList.toggle("hidden", isPeriodo);
  });
});

let isDownloading = false;

async function runDownload(convertAfter = false) {
  if (!selectedClient || isDownloading) return;
  isDownloading = true;
  const logEl = document.getElementById("dl-log");
  const statusEl = document.getElementById("dl-status");
  const btnStart = document.getElementById("dl-btn-start");
  const btnConvert = document.getElementById("dl-btn-convert");
  const progressBar = document.getElementById("dl-progress");
  const progressText = document.getElementById("dl-progress-text");

  btnStart.disabled = true;
  btnConvert.disabled = true;
  logEl.value = "";
  statusEl.textContent = "Iniciando...";
  statusEl.className = "";

  let desdeM, desdeA, hastaM, hastaA;
  const modo = document.querySelector('input[name="modo"]:checked').value;
  if (modo === "mes") {
    desdeM = Number(document.getElementById("dl-mes").value);
    desdeA = Number(document.getElementById("dl-anio").value);
    hastaM = desdeM;
    hastaA = desdeA;
  } else {
    desdeM = Number(document.getElementById("dl-desde-mes").value);
    desdeA = Number(document.getElementById("dl-desde-anio").value);
    hastaM = Number(document.getElementById("dl-hasta-mes").value);
    hastaA = Number(document.getElementById("dl-hasta-anio").value);
  }
  const tipo = document.querySelector('input[name="tipo"]:checked').value;

  const homeDir = await window.api.getHomeDir();
  const basePath = downloadFolderOverride || selectedClient.ruta_descarga || `${homeDir}/Downloads/SAT_XMLs`;
  const clientPath = `${basePath}/${selectedClient.rfc}`;

  log(logEl, `Iniciando descarga para ${selectedClient.rfc}...`);

  // Phase 1: Login
  log(logEl, "Fase 1/4: Iniciando sesión en el SAT...");
  const loginResult = await window.api.satLogin(selectedClient.id);
  if (!loginResult.ok) {
    log(logEl, `Error de autenticación: ${loginResult.msg}`);
    statusEl.textContent = "Error de autenticación";
    statusEl.className = "status-error";
    await window.api.notify("SAT XML Conversor", `Error de autenticación: ${loginResult.msg}`);
    showErrorModal(`Error de autenticación:\n${loginResult.msg}`);
    await window.api.satClose();
    btnStart.disabled = false;
    btnConvert.disabled = false;
    return;
  }
  log(logEl, "Login exitoso");

  try {
    // Phase 2: Count total periods
    const tipos = tipo === "ambas" ? ["emitidas", "recibidas"] : [tipo];
  let successCount = 0;
  let failCount = 0;
  let totalPeriods = 0;

  for (const t of tipos) {
    let y = desdeA, m = desdeM;
    while (y < hastaA || (y === hastaA && m <= hastaM)) {
      totalPeriods++;
      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  // Reset for actual download
  let completedPeriods = 0;
  progressBar.max = totalPeriods;
  progressBar.value = 0;
  progressText.textContent = `0/${totalPeriods}`;

  // Phase 3: Navigate and download each tipo
  for (const t of tipos) {
    log(logEl, `\nFase 3/4: Navegando a facturas ${t}...`);
    let navResult;
    if (t === "emitidas") {
      navResult = await window.api.satNavigateEmitidas();
    } else {
      navResult = await window.api.satNavigateRecibidas();
    }
    if (!navResult.ok) {
      log(logEl, `Error al navegar: ${navResult.msg}`);
      await window.api.notify("SAT XML Conversor", `Error al navegar en el SAT: ${navResult.msg}`);
      showErrorModal(`Error al navegar en el SAT:\n${navResult.msg}`);
      failCount++;
      continue;
    }

    let y = desdeA, m = desdeM;
    while (y < hastaA || (y === hastaA && m <= hastaM)) {
      const periodPath = `${clientPath}/${t}/${y}-${String(m).padStart(2, "0")}`;
      log(logEl, `\n--- ${MESES[m - 1]} ${y} (${t}) ---`);

      const result = await window.api.satDownloadPeriodo(y, m, t, periodPath);
      if (result.ok) {
        successCount++;
        log(logEl, `OK: ${result.msg}`);
        if (result.failed > 0) {
          await window.api.notify("SAT XML Conversor", `${MESES[m - 1]} ${y}: ${result.failed} de ${result.total} fallaron`);
        }
      } else {
        failCount++;
        log(logEl, `ERROR: ${result.msg}`);
        await window.api.notify("SAT XML Conversor", `Error en ${MESES[m - 1]} ${y}: ${result.msg}`);
        showErrorModal(`Error descargando ${MESES[m - 1]} ${y}:\n${result.msg}`);
      }

      completedPeriods++;
      progressBar.value = completedPeriods;
      progressText.textContent = `${completedPeriods}/${totalPeriods}`;

      m++;
      if (m > 12) { m = 1; y++; }
    }
  }

  log(logEl, `\n--- Resumen ---`);
  log(logEl, `Periodos solicitados: ${totalPeriods}`);
  log(logEl, `Exitosos: ${successCount}, Fallidos: ${failCount}`);
  log(logEl, `Carpeta: ${clientPath}`);
  lastDownloadFolder = clientPath;

  statusEl.textContent = "Descarga completada";
  statusEl.className = "status-ok";

  if (convertAfter) {
    log(logEl, "\nConvirtiendo XML a Excel...");
    const outputPath = `${clientPath}/facturas_${selectedClient.rfc}.xlsx`;
    const cvResult = await window.api.convertFolder(clientPath, outputPath);
    if (cvResult.ok) {
      log(logEl, cvResult.msg);
      log(logEl, `Válidos: ${cvResult.valid}, Inválidos: ${cvResult.invalid}`);
    } else {
      log(logEl, `Error conversión: ${cvResult.msg}`);
    }
  }

  } catch (e) {
    log(logEl, `Error inesperado: ${e.message}`);
    statusEl.textContent = "Error";
    statusEl.className = "status-error";
    await window.api.notify("SAT XML Conversor", `Error inesperado: ${e.message}`);
    showErrorModal(`Error inesperado:\n${e.message}`);
  } finally {
    await window.api.satClose();
    await window.api.notify("SAT XML Conversor", `Descarga completada para ${selectedClient.rfc}`);
    btnStart.disabled = false;
    btnConvert.disabled = false;
    isDownloading = false;
  }
}

async function retrieveDownloads() {
  if (!selectedClient) return;
  const logEl = document.getElementById("dl-log");
  const statusEl = document.getElementById("dl-status");
  const homeDir = await window.api.getHomeDir();
  const basePath = downloadFolderOverride || selectedClient.ruta_descarga || `${homeDir}/Downloads/SAT_XMLs`;
  const clientPath = `${basePath}/${selectedClient.rfc}`;

  statusEl.textContent = "Recuperando descargas...";
  log(logEl, "\nRecuperando descargas pendientes del SAT...");
  const result = await window.api.satRetrieveDownloads(clientPath);
  if (result.ok) {
    log(logEl, `Descargados: ${result.downloaded}, Fallos: ${result.failed}`);
    statusEl.textContent = `Recuperados: ${result.downloaded}`;
    statusEl.className = "status-ok";
  } else {
    log(logEl, result.msg);
    statusEl.textContent = "Sin descargas disponibles";
  }
}

async function clearDownloadForm() {
  if (!isDownloading) {
    await window.api.satClose();
  }
  location.reload();
}

document.getElementById("dl-btn-start").addEventListener("click", () => runDownload(false));
document.getElementById("dl-btn-convert").addEventListener("click", () => runDownload(true));
document.getElementById("dl-btn-retrieve").addEventListener("click", retrieveDownloads);
document.getElementById("dl-btn-clear").addEventListener("click", clearDownloadForm);
document.getElementById("dl-btn-folder").addEventListener("click", async () => {
  const path = await window.api.selectFolder();
  if (path) {
    downloadFolderOverride = path;
    document.getElementById("dl-folder").value = path;
  }
});

// ─── CONVERT TAB ───────────────────────────────────────────────

document.getElementById("cv-btn-input").addEventListener("click", async () => {
  const path = await window.api.selectFolderXML();
  if (path) {
    document.getElementById("cv-input").value = path;
    checkConvertReady();
  }
});

document.getElementById("cv-btn-output").addEventListener("click", async () => {
  const path = await window.api.selectFolder();
  if (path) {
    document.getElementById("cv-output").value = path;
    checkConvertReady();
  }
});

document.getElementById("cv-btn-recent").addEventListener("click", () => {
  if (lastDownloadFolder) {
    document.getElementById("cv-input").value = lastDownloadFolder;
    document.getElementById("cv-output").value = lastDownloadFolder;
    checkConvertReady();
  } else {
    alert("No hay una carpeta de descarga reciente. Usa la pestaña Descargar XML primero.");
  }
});

function checkConvertReady() {
  const input = document.getElementById("cv-input").value;
  const output = document.getElementById("cv-output").value;
  document.getElementById("cv-btn-convert").disabled = !input || !output;
}

document.getElementById("cv-btn-convert").addEventListener("click", async () => {
  const btn = document.getElementById("cv-btn-convert");
  const logEl = document.getElementById("cv-log");
  const statusEl = document.getElementById("cv-status");
  const progress = document.getElementById("cv-progress");

  btn.disabled = true;
  logEl.value = "";
  statusEl.textContent = "Convirtiendo...";
  progress.style.width = "0%";

  const inputPath = document.getElementById("cv-input").value;

  log(logEl, `Escaneando XMLs en: ${inputPath}`);
  progress.style.width = "20%";

  const outputPath = document.getElementById("cv-output").value;
  const mode = document.querySelector('input[name="cv-mode"]:checked').value;
  const fn = mode === "pagos" ? window.api.convertFolderPagos : window.api.convertFolder;
  const result = await fn(inputPath, outputPath);

  if (result.ok) {
    progress.style.width = "100%";
    log(logEl, result.msg);
    log(logEl, `Total archivos: ${result.total}`);
    log(logEl, `Válidos: ${result.valid}`);
    log(logEl, `Inválidos: ${result.invalid}`);
    statusEl.textContent = `Completado: ${result.valid} facturas`;
    statusEl.className = "status-ok";
  } else {
    log(logEl, `Error: ${result.msg}`);
    statusEl.textContent = "Error";
    statusEl.className = "status-error";
  }

  btn.disabled = false;
});

// ─── Init ───────────────────────────────────────────────────────

populateMonthSelects();
loadClientTable();
loadClientCombo();
