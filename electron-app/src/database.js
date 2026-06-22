const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { app } = require("electron");

let db;

function getDBPath() {
  const userDataPath = app ? app.getPath("userData") : path.join(__dirname, "..", "data");
  return path.join(userDataPath, "clientes.db");
}

function initDB() {
  const dbPath = getDBPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfc TEXT NOT NULL,
      razon_social TEXT NOT NULL,
      ruta_cer TEXT NOT NULL,
      ruta_key TEXT NOT NULL,
      password_llave TEXT NOT NULL,
      ruta_descarga TEXT DEFAULT '',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add column if missing (migration)
  const columns = db.prepare("PRAGMA table_info(clientes)").all();
  if (!columns.find((c) => c.name === "ruta_descarga")) {
    db.exec("ALTER TABLE clientes ADD COLUMN ruta_descarga TEXT DEFAULT ''");
  }

  return db;
}

function getDB() {
  if (!db) throw new Error("Database not initialized");
  return db;
}

module.exports = { initDB, getDB };
