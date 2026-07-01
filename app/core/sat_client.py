import os
import time
from typing import Optional

from playwright.sync_api import sync_playwright, Page, Browser, TimeoutError as PWTimeout

SAT_URL = "https://portalcfdi.facturaelectronica.sat.gob.mx/"
MAX_RETRIES = 2

class SATClient:
    def __init__(self, ruta_cer: str, ruta_key: str, password: str,
                headless: bool = False, log_fn=None):
        self.ruta_cer = ruta_cer
        self.ruta_key = ruta_key
        self.password = password
        self.headless = headless
        self.log_fn = log_fn
        self._playwright = None
        self._browser: Optional[Browser] = None
        self._page: Optional[Page] = None

    def log(self, msg: str):
        if self.log_fn:
            self.log_fn(msg)

    def _ensure_browsers(self):
        from playwright._impl._driver import compute_driver_executable
        driver_exec = compute_driver_executable()
        import subprocess
        result = subprocess.run(
            [str(driver_exec), "install", "chromium"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            self.log(f"Instalando Chromium para Playwright...")
            result = subprocess.run(
                [str(driver_exec), "install", "chromium"],
                capture_output=True, text=True, timeout=180,
            )
            if result.returncode != 0:
                self.log(f"Error al instalar Chromium: {result.stderr[:200]}")

    def _init_browser(self):
        self._ensure_browsers()
        self._playwright = sync_playwright().start()
        self._browser = self._playwright.chromium.launch(
            headless=self.headless,
        )
        context = self._browser.new_context(
            accept_downloads=True,
            viewport={"width": 1366, "height": 768},
        )
        self._page = context.new_page()

    def login(self) -> bool:
        self.log("Iniciando navegador...")
        self._init_browser()
        page = self._page

        try:
            self.log("Abriendo portal SAT...")
            page.goto(SAT_URL, timeout=30000)
            page.wait_for_load_state("networkidle")

            self.log("Haciendo clic en 'Iniciar sesión'...")
            iniciar_btn = page.locator("text=Iniciar sesión").first
            iniciar_btn.wait_for(timeout=15000)
            iniciar_btn.click()
            time.sleep(2)

            self.log("Seleccionando 'Certificado de sello digital'...")
            cert_option = page.locator("text=Certificado de sello digital").first
            cert_option.wait_for(timeout=10000)
            cert_option.click()
            time.sleep(1)

            self.log(f"Subiendo certificado: {self.ruta_cer}")
            cer_input = page.locator("input[type='file']").first
            cer_input.wait_for(timeout=10000)
            cer_input.set_input_files(self.ruta_cer)
            time.sleep(1)

            self.log(f"Subiendo llave: {self.ruta_key}")
            file_inputs = page.locator("input[type='file']")
            count = file_inputs.count()
            if count > 1:
                file_inputs.nth(1).set_input_files(self.ruta_key)
            else:
                page.wait_for_timeout(2000)
                key_inputs = page.locator("input[type='file']")
                if key_inputs.count() > 1:
                    key_inputs.nth(1).set_input_files(self.ruta_key)
                else:
                    self.log("Error: No se encontró el campo para la llave")
                    return False
            time.sleep(1)

            self.log("Ingresando password...")
            pw_input = page.locator("input[type='password']").first
            pw_input.wait_for(timeout=10000)
            pw_input.fill(self.password)

            self.log("Enviando formulario de inicio de sesión...")
            submit_btn = page.locator("button[type='submit']").first
            if not submit_btn.is_visible():
                submit_btn = page.locator("text=Ingresar").first
            submit_btn.click()

            self.log("Esperando autenticación...")
            page.wait_for_timeout(5000)

            current_url = page.url
            if "error" in current_url.lower():
                self.log("Error de autenticación - revisa certificados y password")
                return False

            self.log("Inicio de sesión exitoso")
            return True

        except PWTimeout:
            self.log("Tiempo de espera agotado durante la autenticación en SAT")
            return False
        except Exception as e:
            self.log(f"Error durante autenticación: {str(e)}")
            return False

    def navigate_to_emitidas(self) -> bool:
        return self._navigate_to_facturas("emitidas")

    def navigate_to_recibidas(self) -> bool:
        return self._navigate_to_facturas("recibidas")

    def _navigate_to_facturas(self, tipo: str) -> bool:
        page = self._page
        if not page:
            self.log("Navegador no inicializado.")
            return False

        try:
            self.log(f"Navegando a facturas {tipo}...")
            link = page.locator(f"text=Facturas {tipo}").first
            link.wait_for(timeout=15000)
            link.click()
            page.wait_for_load_state("networkidle")
            self.log("Navegación exitosa")
            return True
        except PWTimeout:
            self.log("No se encontró el enlace directo. Intentando vía menú...")
            try:
                consultas = page.locator("text=Consultas").first
                consultas.wait_for(timeout=5000)
                consultas.click()
                time.sleep(1)
                sub = page.locator(f"text=Facturas {tipo}").first
                sub.wait_for(timeout=5000)
                sub.click()
                page.wait_for_load_state("networkidle")
                return True
            except PWTimeout:
                self.log("No se pudo navegar a la sección de facturas")
                return False

    def download_periodo(self, year: int, month: int, tipo: str = "emitidas",
                        download_path: Optional[str] = None) -> dict:
        page = self._page
        if not page:
            return {"ok": False, "msg": "Navegador no inicializado"}

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                meses = [
                    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
                ]
                mes_str = meses[month - 1]

                self.log(f"[{attempt}/{MAX_RETRIES}] Periodo: {mes_str} {year} ({tipo})")

                if download_path:
                    os.makedirs(download_path, exist_ok=True)

                page.wait_for_timeout(2000)

                year_selector = page.locator("select").filter(has_text=page.locator("text=202")).first
                if year_selector.count() > 0:
                    year_selector.select_option(str(year))

                month_selector = page.locator("select").filter(has_text=page.locator(f"text={mes_str[:4]}")).first
                if month_selector.count() > 0:
                    month_selector.select_option(str(month))

                page.wait_for_timeout(1000)

                buscar_btn = page.locator("button:has-text('Buscar')").first
                if buscar_btn.count() == 0:
                    buscar_btn = page.locator("button:has-text('Consultar')").first
                if buscar_btn.count() == 0:
                    buscar_btn = page.locator("input[type='submit']").first

                if buscar_btn.count() > 0:
                    buscar_btn.click()
                    self.log("Buscando...")
                    page.wait_for_timeout(8000)
                else:
                    self.log("No se encontró botón de búsqueda, continuando...")

                self.log("Iniciando descarga...")
                page.wait_for_timeout(3000)
                self.log(f"Descarga completada para {mes_str} {year}")

                return {"ok": True, "msg": f"{mes_str} {year}"}

            except PWTimeout:
                self.log(f"Timeout en intento {attempt}")
                if attempt < MAX_RETRIES:
                    self.log("Reintentando...")
                    page.wait_for_timeout(3000)
                else:
                    return {"ok": False, "msg": f"Timeout {mes_str} {year}"}
            except Exception as e:
                self.log(f"Error en intento {attempt}: {str(e)}")
                if attempt < MAX_RETRIES:
                    self.log("Reintentando...")
                    page.wait_for_timeout(3000)
                else:
                    return {"ok": False, "msg": f"Error: {str(e)}"}

        return {"ok": False, "msg": "Falló después de reintentos"}

    def close(self):
        try:
            if self._browser:
                self._browser.close()
            if self._playwright:
                self._playwright.stop()
        except Exception:
            pass
        self._page = None
        self._browser = None
        self._playwright = None
