import customtkinter as ctk
from tkinter import filedialog, messagebox, ttk
from app.core.db import (
    add_cliente,
    update_cliente,
    delete_cliente,
    get_cliente,
    get_all_clientes,
)


class ClientsTab:
    def __init__(self, parent):
        self.parent = parent
        self.editing_id = None
        self.build_ui()
        self.refresh_list()

    def build_ui(self):
        self.parent.grid_columnconfigure(0, weight=1)
        self.parent.grid_rowconfigure(3, weight=1)

        title = ctk.CTkLabel(
            self.parent,
            text="Gestión de Clientes",
            font=ctk.CTkFont(size=20, weight="bold"),
        )
        title.grid(row=0, column=0, pady=(15, 10))

        form_frame = ctk.CTkFrame(self.parent)
        form_frame.grid(row=1, column=0, padx=15, pady=5, sticky="ew")
        form_frame.grid_columnconfigure(1, weight=1)

        fields = [
            ("RFC:", "rfc"),
            ("Razón Social:", "razon_social"),
            ("Certificado .cer:", "ruta_cer"),
            ("Llave .key:", "ruta_key"),
            ("Password de la llave:", "password_llave"),
            ("Carpeta descarga (opcional):", "ruta_descarga"),
        ]

        self.entries = {}
        row_idx = 0
        for label_text, key in fields:
            lbl = ctk.CTkLabel(form_frame, text=label_text, anchor="w")
            lbl.grid(row=row_idx, column=0, padx=(10, 5), pady=4, sticky="w")

            if key in ("ruta_cer", "ruta_key", "ruta_descarga"):
                frame = ctk.CTkFrame(form_frame, fg_color="transparent")
                frame.grid(row=row_idx, column=1, padx=5, pady=4, sticky="ew")
                frame.grid_columnconfigure(0, weight=1)

                entry = ctk.CTkEntry(frame)
                entry.grid(row=0, column=0, sticky="ew")

                btn_text = ".cer" if "cer" in key else ".key" if "key" in key else "Carpeta"
                btn = ctk.CTkButton(
                    frame,
                    text=btn_text,
                    width=60,
                    command=lambda k=key: self.browse(k),
                )
                btn.grid(row=0, column=1, padx=(5, 0))

                self.entries[key] = entry
            else:
                entry = ctk.CTkEntry(form_frame)
                entry.grid(row=row_idx, column=1, padx=5, pady=4, sticky="ew")
                if key == "password_llave":
                    entry.configure(show="*")
                self.entries[key] = entry
            row_idx += 1

        btn_frame = ctk.CTkFrame(form_frame, fg_color="transparent")
        btn_frame.grid(row=row_idx, column=0, columnspan=2, pady=(8, 5))

        self.btn_save = ctk.CTkButton(
            btn_frame, text="Guardar", command=self.save_cliente
        )
        self.btn_save.pack(side="left", padx=5)

        self.btn_clear = ctk.CTkButton(
            btn_frame, text="Limpiar", command=self.clear_form
        )
        self.btn_clear.pack(side="left", padx=5)

        self.btn_delete = ctk.CTkButton(
            btn_frame, text="Eliminar", command=self.delete_cliente,
            state="disabled"
        )
        self.btn_delete.pack(side="left", padx=5)

        table_frame = ctk.CTkFrame(self.parent)
        table_frame.grid(row=2, rowspan=2, column=0, padx=15, pady=(10, 15), sticky="nsew")
        table_frame.grid_rowconfigure(1, weight=1)
        table_frame.grid_columnconfigure(0, weight=1)

        table_label = ctk.CTkLabel(
            table_frame, text="Clientes registrados",
            font=ctk.CTkFont(size=14, weight="bold")
        )
        table_label.grid(row=0, column=0, pady=(5, 5))

        columns = ("id", "rfc", "razon_social", "ruta_cer", "ruta_key")
        self.tree = ttk.Treeview(
            table_frame, columns=columns, show="headings",
            selectmode="browse", height=12
        )
        self.tree.heading("id", text="ID")
        self.tree.heading("rfc", text="RFC")
        self.tree.heading("razon_social", text="Razón Social")
        self.tree.heading("ruta_cer", text="Certificado")
        self.tree.heading("ruta_key", text="Llave")

        self.tree.column("id", width=40, anchor="center")
        self.tree.column("rfc", width=130)
        self.tree.column("razon_social", width=220)
        self.tree.column("ruta_cer", width=200)
        self.tree.column("ruta_key", width=200)

        scrollbar = ttk.Scrollbar(
            table_frame, orient="vertical", command=self.tree.yview
        )
        self.tree.configure(yscrollcommand=scrollbar.set)

        self.tree.grid(row=1, column=0, sticky="nsew")
        scrollbar.grid(row=1, column=1, sticky="ns")

        self.tree.bind("<<TreeviewSelect>>", self.on_select)

    def browse(self, key):
        if key == "ruta_descarga":
            folder = filedialog.askdirectory(title="Seleccionar carpeta de descarga")
            if folder:
                self.entries[key].delete(0, "end")
                self.entries[key].insert(0, folder)
        else:
            filetypes = (
                [("Archivos CER", "*.cer")] if "cer" in key
                else [("Archivos KEY", "*.key")]
            )
            path = filedialog.askopenfilename(
                title=f"Seleccionar archivo {key}",
                filetypes=filetypes,
            )
            if path:
                self.entries[key].delete(0, "end")
                self.entries[key].insert(0, path)

    def get_form_data(self):
        return {
            "rfc": self.entries["rfc"].get().strip(),
            "razon_social": self.entries["razon_social"].get().strip(),
            "ruta_cer": self.entries["ruta_cer"].get().strip(),
            "ruta_key": self.entries["ruta_key"].get().strip(),
            "password_llave": self.entries["password_llave"].get().strip(),
            "ruta_descarga": self.entries["ruta_descarga"].get().strip(),
        }

    def validate_form(self, data):
        if not data["rfc"]:
            messagebox.showwarning("Validación", "RFC es obligatorio")
            return False
        if not data["razon_social"]:
            messagebox.showwarning("Validación", "Razón Social es obligatoria")
            return False
        if not data["ruta_cer"]:
            messagebox.showwarning("Validación", "El archivo .cer es obligatorio")
            return False
        if not data["ruta_key"]:
            messagebox.showwarning("Validación", "El archivo .key es obligatorio")
            return False
        if not data["password_llave"]:
            messagebox.showwarning("Validación", "El password de la llave es obligatorio")
            return False
        if not os.path.exists(data["ruta_cer"]):
            messagebox.showwarning("Validación", "El archivo .cer no existe en la ruta indicada")
            return False
        if not os.path.exists(data["ruta_key"]):
            messagebox.showwarning("Validación", "El archivo .key no existe en la ruta indicada")
            return False
        return True

    def save_cliente(self):
        data = self.get_form_data()
        if not self.validate_form(data):
            return

        if self.editing_id:
            update_cliente(
                self.editing_id,
                data["rfc"],
                data["razon_social"],
                data["ruta_cer"],
                data["ruta_key"],
                data["password_llave"],
                data["ruta_descarga"],
            )
            messagebox.showinfo("Éxito", "Cliente actualizado correctamente")
        else:
            add_cliente(
                data["rfc"],
                data["razon_social"],
                data["ruta_cer"],
                data["ruta_key"],
                data["password_llave"],
                data["ruta_descarga"],
            )
            messagebox.showinfo("Éxito", "Cliente agregado correctamente")

        self.clear_form()
        self.refresh_list()

    def delete_cliente(self):
        if not self.editing_id:
            return
        if messagebox.askyesno("Confirmar", "¿Eliminar este cliente?"):
            delete_cliente(self.editing_id)
            self.clear_form()
            self.refresh_list()

    def clear_form(self):
        self.editing_id = None
        self.btn_save.configure(text="Guardar")
        self.btn_delete.configure(state="disabled")
        for entry in self.entries.values():
            entry.delete(0, "end")

    def on_select(self, event):
        selected = self.tree.selection()
        if not selected:
            return
        item = self.tree.item(selected[0])
        values = item["values"]
        if not values:
            return

        cliente_id = values[0]
        row = get_cliente(cliente_id)
        if not row:
            return

        self.editing_id = row["id"]
        self.btn_save.configure(text="Actualizar")
        self.btn_delete.configure(state="normal")

        self.entries["rfc"].delete(0, "end")
        self.entries["rfc"].insert(0, row["rfc"])
        self.entries["razon_social"].delete(0, "end")
        self.entries["razon_social"].insert(0, row["razon_social"])
        self.entries["ruta_cer"].delete(0, "end")
        self.entries["ruta_cer"].insert(0, row["ruta_cer"])
        self.entries["ruta_key"].delete(0, "end")
        self.entries["ruta_key"].insert(0, row["ruta_key"])
        self.entries["password_llave"].delete(0, "end")
        self.entries["password_llave"].insert(0, row["password_llave"])
        self.entries["ruta_descarga"].delete(0, "end")
        self.entries["ruta_descarga"].insert(0, row["ruta_descarga"] or "")

    def refresh_list(self):
        for item in self.tree.get_children():
            self.tree.delete(item)
        for cliente in get_all_clientes():
            self.tree.insert(
                "", "end",
                values=(
                    cliente["id"],
                    cliente["rfc"],
                    cliente["razon_social"],
                    cliente["ruta_cer"],
                    cliente["ruta_key"],
                ),
            )


import os
