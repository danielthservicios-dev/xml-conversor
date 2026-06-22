import customtkinter as ctk
from tkinter import filedialog, messagebox
import threading
import os
from app.core.xml_parser import parse_xml, parse_folder
from app.utils.helpers import ensure_dir, get_last_download_path


class ConvertTab:
    def __init__(self, parent):
        self.parent = parent
        self.input_folder = ""
        self.output_folder = ""
        self.build_ui()

    def build_ui(self):
        self.parent.grid_columnconfigure(0, weight=1)
        self.parent.grid_rowconfigure(8, weight=1)

        label = ctk.CTkLabel(
            self.parent,
            text="Convertir XML a Excel",
            font=ctk.CTkFont(size=20, weight="bold"),
        )
        label.grid(row=0, column=0, pady=(20, 10))

        self.btn_recent = ctk.CTkButton(
            self.parent,
            text="Cargar última carpeta de descarga",
            command=self.load_recent_folder,
            fg_color="gray",
        )
        self.btn_recent.grid(row=1, column=0, pady=2)

        self.btn_select_input = ctk.CTkButton(
            self.parent,
            text="Seleccionar carpeta con XMLs",
            command=self.select_input_folder,
        )
        self.btn_select_input.grid(row=2, column=0, pady=5)

        self.lbl_input = ctk.CTkLabel(self.parent, text="", wraplength=500)
        self.lbl_input.grid(row=3, column=0, pady=2)

        self.btn_select_output = ctk.CTkButton(
            self.parent,
            text="Seleccionar carpeta de destino (Excel)",
            command=self.select_output_folder,
        )
        self.btn_select_output.grid(row=4, column=0, pady=5)

        self.lbl_output = ctk.CTkLabel(self.parent, text="", wraplength=500)
        self.lbl_output.grid(row=5, column=0, pady=2)

        self.btn_convert = ctk.CTkButton(
            self.parent,
            text="Convertir a Excel",
            command=self.start_conversion,
            state="disabled",
        )
        self.btn_convert.grid(row=6, column=0, pady=10)

        self.progress = ctk.CTkProgressBar(self.parent, width=400)
        self.progress.grid(row=7, column=0, pady=5)
        self.progress.set(0)

        self.lbl_status = ctk.CTkLabel(self.parent, text="")
        self.lbl_status.grid(row=8, column=0, pady=5)

        self.txt_log = ctk.CTkTextbox(self.parent, height=150)
        self.txt_log.grid(row=9, column=0, pady=10, padx=20, sticky="nsew")
        self.txt_log.insert("end", "Listo para convertir...\n")
        self.txt_log.configure(state="disabled")

    def log(self, msg):
        self.txt_log.configure(state="normal")
        self.txt_log.insert("end", msg + "\n")
        self.txt_log.see("end")
        self.txt_log.configure(state="disabled")

    def load_recent_folder(self):
        path = get_last_download_path()
        if not path or not os.path.isdir(path):
            messagebox.showinfo(
                "Sin datos",
                "No hay una carpeta de descarga reciente. Usa 'Descargar XML' primero.",
            )
            return
        self.input_folder = path
        self.output_folder = path
        self.lbl_input.configure(text=f"Entrada: {path}")
        self.lbl_output.configure(text=f"Salida: {path} (misma carpeta)")
        self.btn_convert.configure(state="normal")
        self.log(f"Cargada carpeta de descarga: {path}")

    def select_input_folder(self):
        folder = filedialog.askdirectory(title="Seleccionar carpeta con XMLs")
        if folder:
            self.input_folder = folder
            self.lbl_input.configure(text=f"Entrada: {folder}")
            self.check_ready()

    def select_output_folder(self):
        folder = filedialog.askdirectory(title="Seleccionar carpeta de destino")
        if folder:
            self.output_folder = folder
            self.lbl_output.configure(text=f"Salida: {folder}")
            self.check_ready()

    def check_ready(self):
        if self.input_folder and self.output_folder:
            self.btn_convert.configure(state="normal")
        else:
            self.btn_convert.configure(state="disabled")

    def start_conversion(self):
        t = threading.Thread(target=self.run_conversion, daemon=True)
        t.start()

    def run_conversion(self):
        self.btn_convert.configure(state="disabled")
        self.progress.set(0)
        self.log("Iniciando conversión...")

        try:
            all_xmls = []
            for root, dirs, files in os.walk(self.input_folder):
                for f in files:
                    if f.lower().endswith(".xml"):
                        all_xmls.append(os.path.join(root, f))

            total = len(all_xmls)
            if total == 0:
                self.log("No se encontraron archivos XML en la carpeta.")
                self.lbl_status.configure(text="Sin archivos XML")
                self.btn_convert.configure(state="normal")
                return

            self.log(f"XMLs encontrados: {total}")
            self.progress.set(0.2)

            valid_rows = []
            failed = []
            for i, fpath in enumerate(all_xmls):
                row = parse_xml(fpath)
                if row.uuid:
                    valid_rows.append(row)
                else:
                    failed.append(os.path.basename(fpath))
                self.progress.set(0.2 + 0.3 * (i + 1) / total)

            valid_count = len(valid_rows)
            fail_count = len(failed)

            if fail_count > 0:
                self.log(f"No válidos: {fail_count} (XMLs sin UUID)")
                for fname in failed[:5]:
                    self.log(f"  - {fname}")

            if valid_count == 0:
                self.log("No se pudo extraer información de ningún XML.")
                self.lbl_status.configure(text="Error: XMLs no válidos")
                self.btn_convert.configure(state="normal")
                return

            self.log(f"Válidos: {valid_count} de {total}")
            self.progress.set(0.5)

            import pandas as pd

            data = [r.to_dict() for r in valid_rows]
            df = pd.DataFrame(data)

            num_cols = ["Subtotal", "IVA", "IEPS", "Total"]
            for col in num_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

            subtotal_sum = df["Subtotal"].sum() if "Subtotal" in df.columns else 0
            iva_sum = df["IVA"].sum() if "IVA" in df.columns else 0
            total_sum = df["Total"].sum() if "Total" in df.columns else 0

            filename = f"facturas_{valid_count}_xmls.xlsx"
            output_path = os.path.join(self.output_folder, filename)

            with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
                df.to_excel(writer, index=False, sheet_name="Facturas")
                ws = writer.sheets["Facturas"]
                for i, col in enumerate(df.columns, 1):
                    max_len = max(
                        df[col].astype(str).map(len).max() if len(df) > 0 else 0,
                        len(col),
                    )
                    ws.column_dimensions[
                        ws.cell(row=1, column=i).column_letter
                    ].width = min(max_len + 3, 50)

            self.progress.set(1.0)

            self.log(f"\n--- RESUMEN DE CONVERSIÓN ---")
            self.log(f"Excel: {output_path}")
            self.log(f"Facturas: {valid_count}")
            self.log(f"Subtotal: ${subtotal_sum:,.2f}")
            self.log(f"IVA: ${iva_sum:,.2f}")
            self.log(f"Total: ${total_sum:,.2f}")

            self.lbl_status.configure(
                text=f"Completado: {valid_count} facturas",
                text_color="green",
            )

        except Exception as e:
            self.log(f"Error: {str(e)}")
            self.lbl_status.configure(text=f"Error: {str(e)}", text_color="red")
        finally:
            self.btn_convert.configure(state="normal")
