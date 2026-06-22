const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { initDB, getDB } = require("./src/database");
const { SATClient } = require("./src/satClient");
const { parseFolder, generateExcel } = require("./src/xmlService");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
    title: "SAT XML Conversor",
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, "src", "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

function ensurePlaywrightBrowsers() {
  const { chromium } = require("playwright");
  try {
    chromium.executablePath();
    return;
  } catch {
    // not installed, continue to install
  }
  console.log("Instalando Chromium para Playwright...");
  const { execSync } = require("child_process");
  execSync("npx playwright install chromium", {
    stdio: "inherit",
    cwd: require("os").homedir(),
  });
}

app.whenReady().then(() => {
  initDB();
  ensurePlaywrightBrowsers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ─── Client CRUD ────────────────────────────────────────────────────

ipcMain.handle("db:getAll", () => {
  const db = getDB();
  return db.prepare("SELECT * FROM clientes ORDER BY razon_social").all();
});

ipcMain.handle("db:get", (_, id) => {
  const db = getDB();
  return db.prepare("SELECT * FROM clientes WHERE id = ?").get(id);
});

ipcMain.handle("db:add", (_, data) => {
  const db = getDB();
  const stmt = db.prepare(
    "INSERT INTO clientes (rfc, razon_social, ruta_cer, ruta_key, password_llave, ruta_descarga) VALUES (?, ?, ?, ?, ?, ?)"
  );
  stmt.run(
    data.rfc,
    data.razon_social,
    data.ruta_cer,
    data.ruta_key,
    data.password_llave,
    data.ruta_descarga || ""
  );
  return true;
});

ipcMain.handle("db:update", (_, id, data) => {
  const db = getDB();
  const stmt = db.prepare(
    "UPDATE clientes SET rfc=?, razon_social=?, ruta_cer=?, ruta_key=?, password_llave=?, ruta_descarga=? WHERE id=?"
  );
  stmt.run(
    data.rfc,
    data.razon_social,
    data.ruta_cer,
    data.ruta_key,
    data.password_llave,
    data.ruta_descarga || "",
    id
  );
  return true;
});

ipcMain.handle("db:delete", (_, id) => {
  const db = getDB();
  db.prepare("DELETE FROM clientes WHERE id = ?").run(id);
  return true;
});

// ─── File Dialogs ────────────────────────────────────────────────────

ipcMain.handle("dialog:openCer", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: "Certificado", extensions: ["cer"] }],
    properties: ["openFile"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:openKey", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: "Llave", extensions: ["key"] }],
    properties: ["openFile"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("dialog:selectFolderXML", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── SAT Download ────────────────────────────────────────────────────

ipcMain.handle("sat:login", async (_, clienteId) => {
  const db = getDB();
  const c = db.prepare("SELECT * FROM clientes WHERE id = ?").get(clienteId);
  if (!c) return { ok: false, msg: "Cliente no encontrado" };

  const client = new SATClient(c.ruta_cer, c.ruta_key, c.password_llave);
  const result = await client.login();
  return result;
});

ipcMain.handle("sat:downloadPeriodo", async (_, clienteId, year, month, tipo, downloadPath) => {
  const db = getDB();
  const c = db.prepare("SELECT * FROM clientes WHERE id = ?").get(clienteId);
  if (!c) return { ok: false, msg: "Cliente no encontrado" };

  const client = new SATClient(c.ruta_cer, c.ruta_key, c.password_llave);
  const result = await client.downloadPeriodo(year, month, tipo, downloadPath);
  return result;
});

// ─── System ────────────────────────────────────────────────────

ipcMain.handle("sys:homeDir", () => {
  return require("os").homedir();
});

// ─── XML to Excel ────────────────────────────────────────────────────

ipcMain.handle("xml:convertFolder", async (_, folderPath) => {
  try {
    const result = parseFolder(folderPath);
    if (result.valid.length === 0) {
      return { ok: false, msg: "No se encontraron XMLs válidos" };
    }
    const outputPath = path.join(folderPath, `facturas_${result.valid.length}_xmls.xlsx`);
    await generateExcel(result.valid, outputPath);
    return {
      ok: true,
      msg: `Excel generado: ${outputPath}`,
      total: result.valid.length + result.invalid.length,
      valid: result.valid.length,
      invalid: result.invalid.length,
      outputPath,
    };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
});
