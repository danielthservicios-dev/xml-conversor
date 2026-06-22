import sqlite3
import os
from typing import Optional

DB_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    "data",
    "clientes.db",
)


def get_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
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
    """)
    conn.commit()

    cursor.execute("PRAGMA table_info(clientes)")
    columns = [row[1] for row in cursor.fetchall()]
    if "ruta_descarga" not in columns:
        cursor.execute(
            "ALTER TABLE clientes ADD COLUMN ruta_descarga TEXT DEFAULT ''"
        )
        conn.commit()

    conn.close()


def add_cliente(rfc, razon_social, ruta_cer, ruta_key, password_llave,
                ruta_descarga=""):
    conn = get_connection()
    conn.execute("""
        INSERT INTO clientes (rfc, razon_social, ruta_cer, ruta_key, password_llave, ruta_descarga)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (rfc, razon_social, ruta_cer, ruta_key, password_llave, ruta_descarga))
    conn.commit()
    conn.close()


def update_cliente(id, rfc, razon_social, ruta_cer, ruta_key, password_llave,
                   ruta_descarga=""):
    conn = get_connection()
    conn.execute("""
        UPDATE clientes
        SET rfc=?, razon_social=?, ruta_cer=?, ruta_key=?, password_llave=?, ruta_descarga=?
        WHERE id=?
    """, (rfc, razon_social, ruta_cer, ruta_key, password_llave, ruta_descarga, id))
    conn.commit()
    conn.close()


def delete_cliente(id):
    conn = get_connection()
    conn.execute("DELETE FROM clientes WHERE id=?", (id,))
    conn.commit()
    conn.close()


def get_cliente(id) -> Optional[sqlite3.Row]:
    conn = get_connection()
    row = conn.execute("SELECT * FROM clientes WHERE id=?", (id,)).fetchone()
    conn.close()
    return row


def get_all_clientes():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM clientes ORDER BY razon_social").fetchall()
    conn.close()
    return rows
