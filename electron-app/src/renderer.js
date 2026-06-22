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
let editingClientId = null;

function log(el, msg) {
  el.value += msg + "\n";
  el.scrollTop = el.scrollHeight;
}

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
});

document.getElementById("cli-btn-clear").addEventListener("click", clearClientForm);

document.getElementById("cli-btn-delete").addEventListener("click", async () => {
  if (!editingClientId || !confirm("¿Eliminar este cliente?")) return;
  await window.api.dbDelete(editingClientId);
  clearClientForm();
  loadClientTable();
});

// ─── DOWNLOAD TAB ───────────────────────────────────────────────

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function populateMonthSelects() {
  const now = new Date();
  const y = now.getFullYear();
  const selects = ["dl-desde-mes", "dl-hasta-mes"];
  for (const id of selects) {
    const sel = document.getElementById(id);
    sel.innerHTML = MESES.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
    sel.value = id === "dl-desde-mes" ? "1" : String(now.getMonth() + 1);
  }

  const anioSelects = ["dl-desde-anio", "dl-hasta-anio"];
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
    document.getElementById("dl-btn-start").disabled = true;
    document.getElementById("dl-btn-convert").disabled = true;
    return;
  }
  selectedClient = await window.api.dbGet(Number(id));
  if (selectedClient) {
    document.getElementById("dl-rfc").textContent = selectedClient.rfc;
    document.getElementById("dl-cer").textContent = selectedClient.ruta_cer.split("/").pop() || selectedClient.ruta_cer.split("\\").pop();
    document.getElementById("dl-btn-start").disabled = false;
    document.getElementById("dl-btn-convert").disabled = false;
  }
});

document.getElementById("dl-btn-refresh").addEventListener("click", loadClientCombo);

async function runDownload(convertAfter = false) {
  if (!selectedClient) return;
  const logEl = document.getElementById("dl-log");
  const statusEl = document.getElementById("dl-status");
  const btnStart = document.getElementById("dl-btn-start");
  const btnConvert = document.getElementById("dl-btn-convert");

  btnStart.disabled = true;
  btnConvert.disabled = true;
  logEl.value = "";
  statusEl.textContent = "Iniciando...";
  statusEl.className = "";

  const desdeM = Number(document.getElementById("dl-desde-mes").value);
  const desdeA = Number(document.getElementById("dl-desde-anio").value);
  const hastaM = Number(document.getElementById("dl-hasta-mes").value);
  const hastaA = Number(document.getElementById("dl-hasta-anio").value);
  const tipo = document.querySelector('input[name="tipo"]:checked').value;

  const homeDir = await window.api.getHomeDir();
  const basePath = selectedClient.ruta_descarga || `${homeDir}/Downloads/SAT_XMLs`;
  const clientPath = `${basePath}/${selectedClient.rfc}`;

  log(logEl, `Iniciando descarga para ${selectedClient.rfc}...`);

  const loginResult = await window.api.satLogin(selectedClient.id);
  if (!loginResult.ok) {
    log(logEl, `Error de autenticación: ${loginResult.msg}`);
    statusEl.textContent = "Error de autenticación";
    statusEl.className = "status-error";
    btnStart.disabled = false;
    btnConvert.disabled = false;
    return;
  }
  log(logEl, "Login exitoso");

  const tipos = tipo === "ambas" ? ["emitidas", "recibidas"] : [tipo];
  let successCount = 0;
  let failCount = 0;

  for (const t of tipos) {
    log(logEl, `\n--- Facturas ${t} ---`);
    let y = desdeA,
      m = desdeM;
    while (y < hastaA || (y === hastaA && m <= hastaM)) {
      const periodPath = `${clientPath}/${t}/${y}-${String(m).padStart(2, "0")}`;
      const result = await window.api.satDownloadPeriodo(
        selectedClient.id,
        y,
        m,
        t,
        periodPath
      );
      if (result.ok) {
        successCount++;
        log(logEl, `  ${MESES[m - 1]} ${y}: OK`);
      } else {
        failCount++;
        log(logEl, `  ${MESES[m - 1]} ${y}: ERROR - ${result.msg}`);
      }
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  }

  log(logEl, `\n--- Resumen ---`);
  log(logEl, `Exitosos: ${successCount}, Fallidos: ${failCount}`);
  log(logEl, `Carpeta: ${clientPath}`);
  lastDownloadFolder = clientPath;

  statusEl.textContent = "Descarga completada";
  statusEl.className = "status-ok";

  if (convertAfter) {
    log(logEl, "\nConvirtiendo XML a Excel...");
    const cvResult = await window.api.convertFolder(clientPath);
    if (cvResult.ok) {
      log(logEl, cvResult.msg);
      log(logEl, `Válidos: ${cvResult.valid}, Inválidos: ${cvResult.invalid}`);
    } else {
      log(logEl, `Error conversión: ${cvResult.msg}`);
    }
  }

  btnStart.disabled = false;
  btnConvert.disabled = false;
}

document.getElementById("dl-btn-start").addEventListener("click", () => runDownload(false));
document.getElementById("dl-btn-convert").addEventListener("click", () => runDownload(true));

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

  const result = await window.api.convertFolder(inputPath);

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
