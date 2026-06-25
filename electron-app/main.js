const { app, BrowserWindow, ipcMain, dialog, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");
const { initDB, getDB } = require("./src/database");
const { SATClient } = require("./src/satClient");
const { parseFolder, generateExcel } = require("./src/xmlService");

let mainWindow;
let satClient = null;

function encryptPassword(plaintext) {
  if (!plaintext) return plaintext;
  if (safeStorage.isEncryptionAvailable()) {
    return "enc:" + safeStorage.encryptString(plaintext).toString("hex");
  }
  return plaintext;
}

function decryptPassword(stored) {
  if (!stored) return "";
  if (stored.startsWith("enc:")) {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(stored.slice(4), "hex"));
    }
    console.warn("safeStorage no disponible, usando password almacenado");
    return stored;
  }
  return stored;
}

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
  process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
  const { chromium } = require("playwright");
  try {
    chromium.executablePath();
    console.log("Chromium ya disponible");
    return;
  } catch (e) {
    console.error("Chromium no encontrado:", e.message);
  }
}

app.whenReady().then(() => {
  initDB();
  ensurePlaywrightBrowsers();
  createWindow();
});

app.on("window-all-closed", () => {
  if (satClient) satClient.close();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (satClient) satClient.close();
});

// ─── Client CRUD ────────────────────────────────────────────────────

ipcMain.handle("db:getAll", () => {
  const db = getDB();
  return db.prepare("SELECT * FROM clientes ORDER BY razon_social").all();
});

ipcMain.handle("db:get", (_, id) => {
  const db = getDB();
  const row = db.prepare("SELECT * FROM clientes WHERE id = ?").get(id);
  if (row) {
    row.password_llave = decryptPassword(row.password_llave);
  }
  return row;
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
    encryptPassword(data.password_llave),
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
    encryptPassword(data.password_llave),
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
  if (satClient) {
    await satClient.close();
    satClient = null;
  }

  const db = getDB();
  const c = db.prepare("SELECT * FROM clientes WHERE id = ?").get(clienteId);
  if (!c) return { ok: false, msg: "Cliente no encontrado" };

  satClient = new SATClient(c.ruta_cer, c.ruta_key, decryptPassword(c.password_llave), (msg) => {
    if (mainWindow) mainWindow.webContents.send("sat:log", msg);
  });

  const result = await satClient.login();
  return result;
});

ipcMain.handle("sat:navigateEmitidas", async () => {
  if (!satClient) return { ok: false, msg: "No hay sesión activa. Inicia sesión primero." };
  return await satClient.navigateToEmitidas();
});

ipcMain.handle("sat:navigateRecibidas", async () => {
  if (!satClient) return { ok: false, msg: "No hay sesión activa. Inicia sesión primero." };
  return await satClient.navigateToRecibidas();
});

ipcMain.handle("sat:downloadPeriodo", async (_, year, month, tipo, downloadPath) => {
  if (!satClient) return { ok: false, msg: "No hay sesión activa. Inicia sesión primero." };
  return await satClient.downloadPeriodo(year, month, tipo, downloadPath);
});

ipcMain.handle("sat:retrieveDownloads", async (_, downloadPath) => {
  if (!satClient) return { ok: false, msg: "No hay sesión activa." };
  return await satClient.retrieveDownloads(downloadPath);
});

ipcMain.handle("sat:close", async () => {
  if (satClient) {
    await satClient.close();
    satClient = null;
  }
  return { ok: true };
});

// ─── System ────────────────────────────────────────────────────

ipcMain.handle("sys:homeDir", () => {
  return require("os").homedir();
});

// ─── XML to Excel ────────────────────────────────────────────────────

ipcMain.handle("xml:convertFolder", async (_, folderPath, outputPath) => {
  try {
    const result = parseFolder(folderPath);
    if (result.valid.length === 0) {
      return { ok: false, msg: "No se encontraron XMLs válidos" };
    }
    let destPath = outputPath || path.join(folderPath, `facturas_${result.valid.length}_xmls.xlsx`);
    if (fs.existsSync(destPath) && fs.statSync(destPath).isDirectory()) {
      destPath = path.join(destPath, `facturas_${result.valid.length}_xmls.xlsx`);
    }
    await generateExcel(result.valid, destPath);
    return {
      ok: true,
      msg: `Excel generado: ${destPath}`,
      total: result.valid.length + result.invalid.length,
      valid: result.valid.length,
      invalid: result.invalid.length,
      outputPath: destPath,
    };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
});
