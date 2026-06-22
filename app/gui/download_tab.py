import customtkinter as ctk
from tkinter import messagebox
import threading
import os
import subprocess
import platform
from datetime import datetime
from app.core.db import get_all_clientes
from app.core.sat_client import SATClient


class DownloadTab:
    def __init__(self, parent):
        self.parent = parent
        self.selected_cliente = None
        self.build_ui()
        self.refresh_clientes()

    def build_ui(self):
        self.parent.grid_columnconfigure(0, weight=1)
        self.parent.grid_rowconfigure(8, weight=1)

        title = ctk.CTkLabel(
            self.parent,
            text="Descarga de XML desde el SAT",
            font=ctk.CTkFont(size=20, weight="bold"),
        )
        title.grid(row=0, column=0, pady=(15, 10))

        frame = ctk.CTkFrame(self.parent)
        frame.grid(row=1, column=0, padx=15, pady=5, sticky="ew")
        frame.grid_columnconfigure(1, weight=1)

        row = 0
        ctk.CTkLabel(frame, text="Cliente:").grid(
            row=row, column=0, padx=(10, 5), pady=5, sticky="w"
        )
        self.cliente_combo = ctk.CTkOptionMenu(
            frame, values=["Seleccionar..."], command=self.on_cliente_change
        )
        self.cliente_combo.grid(row=row, column=1, padx=5, pady=5, sticky="ew")
        self.btn_refresh = ctk.CTkButton(
            frame, text="↻", width=30, command=self.refresh_clientes
        )
        self.btn_refresh.grid(row=row, column=2, padx=(5, 10), pady=5)
        row += 1

        ctk.CTkLabel(frame, text="Certificado:").grid(
            row=row, column=0, padx=(10, 5), pady=2, sticky="w"
        )
        self.lbl_cer = ctk.CTkLabel(frame, text="", anchor="w")
        self.lbl_cer.grid(row=row, column=1, columnspan=2, padx=5, pady=2, sticky="ew")
        row += 1

        ctk.CTkLabel(frame, text="RFC:").grid(
            row=row, column=0, padx=(10, 5), pady=2, sticky="w"
        )
        self.lbl_rfc = ctk.CTkLabel(frame, text="", anchor="w")
        self.lbl_rfc.grid(row=row, column=1, columnspan=2, padx=5, pady=2, sticky="ew")
        row += 1

        sep = ctk.CTkFrame(frame, height=1, fg_color="gray")
        sep.grid(row=row, column=0, columnspan=3, sticky="ew", pady=8, padx=10)
        row += 1

        ctk.CTkLabel(frame, text="Tipo:").grid(
            row=row, column=0, padx=(10, 5), pady=5, sticky="w"
        )
        self.tipo_var = ctk.StringVar(value="emitidas")
        tipo_frame = ctk.CTkFrame(frame, fg_color="transparent")
        tipo_frame.grid(row=row, column=1, padx=5, pady=5, sticky="w")
        ctk.CTkRadioButton(
            tipo_frame, text="Emitidas", variable=self.tipo_var, value="emitidas"
        ).pack(side="left", padx=5)
        ctk.CTkRadioButton(
            tipo_frame, text="Recibidas", variable=self.tipo_var, value="recibidas"
        ).pack(side="left", padx=5)
        ctk.CTkRadioButton(
            tipo_frame, text="Ambas", variable=self.tipo_var, value="ambas"
        ).pack(side="left", padx=5)
        row += 1

        periodo_frame = ctk.CTkFrame(frame, fg_color="transparent")
        periodo_frame.grid(row=row, column=0, columnspan=3, pady=5, sticky="ew")

        ctk.CTkLabel(periodo_frame, text="Desde:").grid(
            row=0, column=0, padx=(10, 5), sticky="w"
        )
        self.desde_frame = ctk.CTkFrame(periodo_frame, fg_color="transparent")
        self.desde_frame.grid(row=0, column=1, padx=5, sticky="w")
        self.desde_mes = ctk.CTkOptionMenu(
            self.desde_frame, values=self._meses(), width=110
        )
        self.desde_mes.pack(side="left", padx=2)
        self.desde_anio = ctk.CTkOptionMenu(
            self.desde_frame, values=self._anios(), width=80
        )
        self.desde_anio.pack(side="left", padx=2)

        ctk.CTkLabel(periodo_frame, text="Hasta:").grid(
            row=0, column=2, padx=(15, 5), sticky="w"
        )
        self.hasta_frame = ctk.CTkFrame(periodo_frame, fg_color="transparent")
        self.hasta_frame.grid(row=0, column=3, padx=5, sticky="w")
        self.hasta_mes = ctk.CTkOptionMenu(
            self.hasta_frame, values=self._meses(), width=110
        )
        self.hasta_mes.pack(side="left", padx=2)
        self.hasta_anio = ctk.CTkOptionMenu(
            self.hasta_frame, values=self._anios(), width=80
        )
        self.hasta_anio.pack(side="left", padx=2)

        now = datetime.now()
        current_mes = self._meses()[now.month - 1]
        current_anio = str(now.year)
        self.desde_mes.set("Enero")
        self.desde_anio.set(current_anio)
        self.hasta_mes.set(current_mes)
        self.hasta_anio.set(current_anio)

        progress_frame = ctk.CTkFrame(self.parent, fg_color="transparent")
        progress_frame.grid(row=2, column=0, padx=15, pady=(5, 0), sticky="ew")
        progress_frame.grid_columnconfigure(1, weight=1)

        self.lbl_progress = ctk.CTkLabel(progress_frame, text="Progreso:")
        self.lbl_progress.grid(row=0, column=0, padx=(0, 10), sticky="w")

        self.progress_bar = ctk.CTkProgressBar(progress_frame, width=300)
        self.progress_bar.grid(row=0, column=1, padx=5, sticky="ew")
        self.progress_bar.set(0)

        self.lbl_progress_text = ctk.CTkLabel(progress_frame, text="0%")
        self.lbl_progress_text.grid(row=0, column=2, padx=(10, 0), sticky="w")

        btn_frame = ctk.CTkFrame(self.parent, fg_color="transparent")
        btn_frame.grid(row=3, column=0, pady=(5, 5))

        self.btn_download = ctk.CTkButton(
            btn_frame,
            text="Iniciar Descarga SAT",
            command=self.start_download,
            state="disabled",
        )
        self.btn_download.pack(side="left", padx=5)

        self.btn_convert = ctk.CTkButton(
            btn_frame,
            text="Descargar y Convertir a Excel",
            command=self.start_download_and_convert,
            state="disabled",
        )
        self.btn_convert.pack(side="left", padx=5)

        self.btn_open = ctk.CTkButton(
            btn_frame,
            text="Abrir carpeta",
            command=self.open_folder,
            state="disabled",
        )
        self.btn_open.pack(side="left", padx=5)

        self.lbl_status = ctk.CTkLabel(btn_frame, text="")
        self.lbl_status.pack(side="left", padx=10)

        self.txt_log = ctk.CTkTextbox(self.parent, height=220)
        self.txt_log.grid(row=4, column=0, padx=15, pady=5, sticky="nsew")
        self.txt_log.insert("end", "Selecciona un cliente y periodo para iniciar la descarga.\n")
        self.txt_log.configure(state="disabled")

    def _meses(self):
        return [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
        ]

    def _anios(self):
        now = datetime.now()
        return [str(y) for y in range(now.year - 3, now.year + 1)]

    def log(self, msg):
        self.txt_log.configure(state="normal")
        self.txt_log.insert("end", msg + "\n")
        self.txt_log.see("end")
        self.txt_log.configure(state="disabled")

    def refresh_clientes(self):
        clientes = get_all_clientes()
        self._clientes_list = clientes
        values = ["Seleccionar..."] + [
            f"{c['id']} - {c['rfc']} - {c['razon_social']}" for c in clientes
        ]
        self.cliente_combo.configure(values=values)
        self.cliente_combo.set("Seleccionar...")
        self.selected_cliente = None
        self.btn_download.configure(state="disabled")
        self.btn_convert.configure(state="disabled")
        self.lbl_cer.configure(text="")
        self.lbl_rfc.configure(text="")

    def on_cliente_change(self, choice):
        if choice == "Seleccionar..." or not hasattr(self, "_clientes_list"):
            self.selected_cliente = None
            self.btn_download.configure(state="disabled")
            self.btn_convert.configure(state="disabled")
            self.lbl_cer.configure(text="")
            self.lbl_rfc.configure(text="")
            return

        try:
            cliente_id = int(choice.split(" - ")[0])
            for c in self._clientes_list:
                if c["id"] == cliente_id:
                    self.selected_cliente = c
                    break
            if self.selected_cliente:
                self.lbl_cer.configure(
                    text=os.path.basename(self.selected_cliente["ruta_cer"])
                )
                self.lbl_rfc.configure(text=self.selected_cliente["rfc"])
                self.btn_download.configure(state="normal")
                self.btn_convert.configure(state="normal")
        except (ValueError, IndexError):
            pass

    def start_download(self):
        self._run_download_task(convert_after=False)

    def start_download_and_convert(self):
        self._run_download_task(convert_after=True)

    def _run_download_task(self, convert_after=False):
        if not self.selected_cliente:
            messagebox.showwarning("Seleccionar cliente", "Selecciona un cliente primero")
            return

        t = threading.Thread(
            target=self._run_download,
            args=(convert_after,),
            daemon=True,
        )
        t.start()

    def open_folder(self):
        if hasattr(self, "_last_folder") and self._last_folder:
            path = self._last_folder
            if platform.system() == "Darwin":
                subprocess.Popen(["open", path])
            elif platform.system() == "Windows":
                os.startfile(path)
            else:
                subprocess.Popen(["xdg-open", path])

    def _run_download(self, convert_after=False):
        cliente = self.selected_cliente
        self.btn_download.configure(state="disabled")
        self.btn_convert.configure(state="disabled")
        self.btn_open.configure(state="disabled")
        self._last_folder = None
        self.lbl_status.configure(text="Descargando...", text_color="")

        meses_num = {
            "Enero": 1, "Febrero": 2, "Marzo": 3, "Abril": 4,
            "Mayo": 5, "Junio": 6, "Julio": 7, "Agosto": 8,
            "Septiembre": 9, "Octubre": 10, "Noviembre": 11, "Diciembre": 12,
        }
        desde_m = meses_num[self.desde_mes.get()]
        desde_a = int(self.desde_anio.get())
        hasta_m = meses_num[self.hasta_mes.get()]
        hasta_a = int(self.hasta_anio.get())

        base_path = cliente["ruta_descarga"] or os.path.expanduser("~/Downloads/SAT_XMLs")
        base_path = os.path.join(base_path, cliente["rfc"])

        tipos = ["emitidas"]
        tipo_selected = self.tipo_var.get()
        if tipo_selected == "recibidas":
            tipos = ["recibidas"]
        elif tipo_selected == "ambas":
            tipos = ["emitidas", "recibidas"]

        total_meses = 0
        for tipo in tipos:
            y, m = desde_a, desde_m
            while (y < hasta_a) or (y == hasta_a and m <= hasta_m):
                total_meses += 1
                m += 1
                if m > 12:
                    m = 1
                    y += 1

        self.progress_bar.set(0)
        completed = 0
        results = []

        sat = SATClient(
            ruta_cer=cliente["ruta_cer"],
            ruta_key=cliente["ruta_key"],
            password=cliente["password_llave"],
            headless=False,
            log_fn=self.log,
        )

        try:
            if not sat.login():
                self.log("Error: No se pudo iniciar sesión en el SAT")
                self.lbl_status.configure(text="Error de autenticación", text_color="red")
                return

            for tipo in tipos:
                self.log(f"\n{'='*40}")
                self.log(f"Facturas {tipo}")
                self.log(f"{'='*40}")

                if tipo == "emitidas":
                    ok = sat.navigate_to_emitidas()
                else:
                    ok = sat.navigate_to_recibidas()

                if not ok:
                    self.log(f"No se pudo navegar a facturas {tipo}")
                    continue

                year, month = desde_a, desde_m
                while (year < hasta_a) or (year == hasta_a and month <= hasta_m):
                    period_path = os.path.join(
                        base_path, tipo, f"{year}-{month:02d}"
                    )

                    r = sat.download_periodo(
                        year, month, tipo,
                        download_path=period_path,
                    )
                    results.append({**r, "tipo": tipo, "year": year, "month": month})

                    completed += 1
                    pct = completed / total_meses if total_meses > 0 else 0
                    self.progress_bar.set(pct)
                    self.lbl_progress_text.configure(
                        text=f"{completed}/{total_meses} ({int(pct * 100)}%)"
                    )

                    month += 1
                    if month > 12:
                        month = 1
                        year += 1

            ok_count = sum(1 for r in results if r["ok"])
            fail_count = sum(1 for r in results if not r["ok"])

            self.log(f"\n{'='*40}")
            self.log("RESUMEN DE DESCARGA")
            self.log(f"{'='*40}")
            self.log(f"Total periodos: {len(results)}")
            self.log(f"Exitosos: {ok_count}")
            self.log(f"Fallidos: {fail_count}")
            if fail_count > 0:
                for r in results:
                    if not r["ok"]:
                        self.log(f"  - {r['tipo']} {r['year']}-{r['month']:02d}: {r['msg']}")

            self.log(f"\nCarpeta: {base_path}")
            self._last_folder = base_path

            self.progress_bar.set(1)
            self.lbl_progress_text.configure(text="100%")
            self.lbl_status.configure(text="Descarga completada", text_color="green")
            self.btn_open.configure(state="normal")

            if convert_after:
                self.log("\nIniciando conversión a Excel...")
                self._run_conversion(base_path)

        except Exception as e:
            self.log(f"Error inesperado: {str(e)}")
            self.lbl_status.configure(text=f"Error: {str(e)}", text_color="red")
        finally:
            sat.close()
            self.btn_download.configure(state="normal")
            self.btn_convert.configure(state="normal")

    def _run_conversion(self, folder_path):
        try:
            from app.core.xml_parser import parse_xml
            import pandas as pd

            all_xmls = []
            for root, dirs, files in os.walk(folder_path):
                for f in files:
                    if f.lower().endswith(".xml"):
                        all_xmls.append(os.path.join(root, f))

            total_xmls = len(all_xmls)
            self.log(f"XMLs encontrados: {total_xmls}")

            if total_xmls == 0:
                self.log("No se encontraron XMLs para convertir.")
                return

            valid_rows = []
            failed_files = []
            for fpath in all_xmls:
                row = parse_xml(fpath)
                if row.uuid:
                    valid_rows.append(row)
                else:
                    failed_files.append(os.path.basename(fpath))

            valid_count = len(valid_rows)
            fail_count = len(failed_files)

            self.log(f"Válidos: {valid_count}, Fallidos: {fail_count}")

            if fail_count > 0:
                self.log("Archivos no válidos (primeros 5):")
                for fname in failed_files[:5]:
                    self.log(f"  - {fname}")

            if valid_count == 0:
                self.log("No se pudieron parsear XMLs válidos.")
                return

            data = [r.to_dict() for r in valid_rows]
            df = pd.DataFrame(data)

            num_cols = ["Subtotal", "IVA", "IEPS", "Total"]
            for col in num_cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

            subtotal_sum = df["Subtotal"].sum() if "Subtotal" in df.columns else 0
            iva_sum = df["IVA"].sum() if "IVA" in df.columns else 0
            total_sum = df["Total"].sum() if "Total" in df.columns else 0

            excel_path = os.path.join(folder_path, f"facturas_{valid_count}_xmls.xlsx")
            with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
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

            self.log(f"\n--- RESUMEN DE CONVERSIÓN ---")
            self.log(f"Excel: {excel_path}")
            self.log(f"Facturas: {valid_count}")
            self.log(f"Subtotal: ${subtotal_sum:,.2f}")
            self.log(f"IVA: ${iva_sum:,.2f}")
            self.log(f"Total: ${total_sum:,.2f}")

            from app.utils.helpers import save_last_download_path
            save_last_download_path(folder_path)

        except Exception as e:
            self.log(f"Error en conversión: {str(e)}")
