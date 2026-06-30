const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const SAT_URL = "https://portalcfdi.facturaelectronica.sat.gob.mx/";
const MAX_RETRIES = 2;

class SATClient {
  constructor(rutaCer, rutaKey, password, logFn = null) {
    this.rutaCer = rutaCer;
    this.rutaKey = rutaKey;
    this.password = password;
    this.logFn = logFn;
    this.browser = null;
    this.page = null;
  }

  log(msg) {
    if (this.logFn) this.logFn(msg);
  }

  _validateFiles() {
    if (!fs.existsSync(this.rutaCer)) {
      return "El archivo de certificado no existe: " + this.rutaCer;
    }
    if (!fs.existsSync(this.rutaKey)) {
      return "El archivo de llave no existe: " + this.rutaKey;
    }
    return null;
  }

  async _initBrowser() {
    const bundledBrowsers = path.join(process.resourcesPath || '', 'browsers');
    let hasChromium = false;
    try {
      if (fs.existsSync(bundledBrowsers)) {
        const entries = fs.readdirSync(bundledBrowsers);
        hasChromium = entries.some(e => e.startsWith('chromium'));
      }
    } catch (e) {}
    if (hasChromium) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = bundledBrowsers;
    } else if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
      process.env.PLAYWRIGHT_BROWSERS_PATH = "0";
    }
    const launchOptions = { headless: false };
    if (process.platform === 'darwin') {
      launchOptions.channel = 'chrome';
    }
    this.browser = await chromium.launch(launchOptions);
    const context = await this.browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1366, height: 768 },
    });
    context.setDefaultTimeout(0);
    this.page = await context.newPage();
    this.page.setDefaultTimeout(0);
    this.page.setDefaultNavigationTimeout(0);
  }

  async login() {
    const fileError = this._validateFiles();
    if (fileError) {
      this.log(fileError);
      return { ok: false, msg: fileError };
    }

    this.log("Iniciando navegador...");
    try {
      await this._initBrowser();
    } catch (e) {
      this.log(e.message);
      return { ok: false, msg: e.message };
    }
    const page = this.page;

    try {
      this.log("Abriendo portal SAT...");
      await page.goto(SAT_URL);
      await page.waitForLoadState("load");

      this.log("Haciendo clic en 'e.firma'...");
      const efirmaBtn = page.locator("#buttonFiel");
      await efirmaBtn.waitFor();
      await efirmaBtn.click();
      await page.waitForTimeout(2000);

      this.log(`Subiendo certificado: ${this.rutaCer}`);
      const [fc1] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.locator("#btnCertificate").click(),
      ]);
      await fc1.setFiles(this.rutaCer);
      this.log("Certificado subido");

      this.log(`Subiendo llave: ${this.rutaKey}`);
      const [fc2] = await Promise.all([
        page.waitForEvent("filechooser"),
        page.locator("#btnPrivateKey").click(),
      ]);
      await fc2.setFiles(this.rutaKey);
      this.log("Llave subida");

      this.log("Ingresando password...");
      const pwInput = page.locator("input[type='password']").first();
      await pwInput.waitFor();
      await pwInput.fill(this.password);

      let satDialogMsg = null;
      page.once("dialog", dialog => {
        satDialogMsg = dialog.message();
        this.log(`Dialog del SAT: ${satDialogMsg}`);
        dialog.accept();
      });

      this.log("Enviando formulario de inicio de sesión...");
      await page.locator("#submit").waitFor({ state: "visible" });
      await page.waitForFunction(() => !document.getElementById("submit")?.disabled);
      await page.locator("#submit").click();

      this.log("Esperando autenticación...");
      await page.waitForTimeout(5000);

      if (satDialogMsg) {
        return { ok: false, msg: `El SAT indicó: ${satDialogMsg}` };
      }

      const currentUrl = page.url().toLowerCase();
      if (currentUrl.includes("error") || currentUrl.includes("bloqueado")
        || currentUrl.includes("suspender") || currentUrl.includes("mantenimiento")) {
        this.log("Error de autenticación - revisa certificados y password");
        return { ok: false, msg: "Error de autenticación en el SAT. Revisa tus certificados." };
      }

      try {
        const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
        if (bodyText.includes("vencido") || bodyText.includes("revocado")) {
          return { ok: false, msg: "El certificado está vencido o revocado." };
        }
        if (bodyText.includes("no corresponde")) {
          return { ok: false, msg: "El archivo de llave no corresponde al certificado." };
        }
        if (bodyText.includes("contraseña") || bodyText.includes("password") || bodyText.includes("incorrecta")) {
          return { ok: false, msg: "Contraseña incorrecta." };
        }
      } catch (e) {
        // ignore errors reading body text
      }

      this.log("Inicio de sesión exitoso");
      return { ok: true, msg: "Login exitoso" };
    } catch (e) {
      const msg = e.message;
      this.log(`Error durante autenticación: ${msg}`);
      if (msg.includes("timeout") || msg.includes("Timeout") || msg.includes("net::ERR_")) {
        return { ok: false, msg: "Error de conexión con el SAT. Verifica tu conexión a internet." };
      }
      return { ok: false, msg: msg };
    }
  }

  async navigateToEmitidas() {
    return this._navigateToFacturas("emitidas");
  }

  async navigateToRecibidas() {
    const page = this.page;
    if (!page) return { ok: false, msg: "Navegador no inicializado" };
    try {
      this.log("Navegando a facturas recibidas...");
      const link = page.locator('a[title="Facturas Recibidas"]');
      await link.waitFor();
      await link.click();
      await page.waitForLoadState("load");
      this.log("Navegación exitosa a recibidas");
      return { ok: true };
    } catch (e) {
      return { ok: false, msg: `No se pudo navegar a facturas recibidas: ${e.message}` };
    }
  }

  async _navigateToFacturas(tipo) {
    const page = this.page;
    if (!page) return { ok: false, msg: "Navegador no inicializado" };

    try {
      this.log(`Navegando a facturas ${tipo}...`);
      const link = page.locator(`text=Facturas ${tipo}`).first();
      await link.waitFor();
      await link.click();
      await page.waitForLoadState("load");
      this.log("Navegación exitosa");
      return { ok: true };
    } catch {
      this.log("No se encontró el enlace directo. Intentando vía menú...");
      try {
        const consultas = page.locator("text=Consultas").first();
        await consultas.waitFor();
        await consultas.click();
        await page.waitForTimeout(1000);
        const subLink = page.locator(`text=Facturas ${tipo}`).first();
        await subLink.waitFor();
        await subLink.click();
        await page.waitForLoadState("load");
        return { ok: true };
      } catch (e) {
        return { ok: false, msg: `No se pudo navegar a facturas ${tipo}` };
      }
    }
  }

  async searchPeriodo(year, month) {
    const page = this.page;
    if (!page) return { ok: false, msg: "Navegador no inicializado" };

    try {
      await page.waitForTimeout(2000);

      this.log("Seleccionando filtro por fechas...");
      await page.locator("input#ctl00_MainContent_RdoFechas").click();
      this.log("Esperando respuesta del servidor...");
      await page.waitForTimeout(5000);

      this.log(`Seleccionando año ${year}...`);
      await page.locator("#DdlAnio").selectOption(String(year));

      this.log(`Seleccionando mes ${String(month).padStart(2, "0")}...`);
      await page.locator("#ctl00_MainContent_CldFecha_DdlMes").selectOption(String(month));

      await page.waitForTimeout(500);

      this.log("Haciendo clic en Buscar CFDI...");
      await page.locator("#ctl00_MainContent_BtnBusqueda").click();

      this.log("Esperando resultados de búsqueda...");
      await page.waitForTimeout(8000);

      const downloadBtns = page.locator("span.glyphicon-cloud-download, span[onclick*='AccionCfdi']");
      const total = await downloadBtns.count();
      this.log(`Facturas encontradas: ${total}`);

      return { ok: true, total };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }

  async requestDownloadAll(downloadPath) {
    const page = this.page;
    if (!page) return { ok: false, msg: "Navegador no inicializado" };

    try {
      await page.locator("span.glyphicon-cloud-download[onclick]").first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(2000);

      const urlParts = await page.locator("span.glyphicon-cloud-download[onclick]").evaluateAll(
        (els) => els.map((el) => {
          const onclick = el.getAttribute("onclick");
          const match = onclick.match(/AccionCfdi\('([^']+)'/);
          return match ? match[1] : null;
        }).filter(Boolean)
      );

      const total = urlParts.length;

      if (total === 0) {
        this.log("No hay facturas para descargar en este periodo");
        return { ok: true, downloaded: 0, failed: 0, total: 0 };
      }

      if (downloadPath) {
        fs.mkdirSync(downloadPath, { recursive: true });
      }

      this.log(`Facturas encontradas: ${total}`);

      const baseUrl = page.url();
      let downloaded = 0;
      let failed = 0;

      for (let i = 0; i < total; i++) {
        let success = false;
        for (let retry = 1; retry <= 2; retry++) {
          try {
            this.log(`Descargando ${i + 1}/${total}${retry > 1 ? ` (intento ${retry})` : ''}...`);
            const resolvedUrl = new URL(urlParts[i], baseUrl).href;
            const xml = await page.evaluate(async (url) => {
              const res = await fetch(url);
              return await res.text();
            }, resolvedUrl);

            if (!xml || xml.trim().length === 0) {
              throw new Error("Contenido XML vacío");
            }

            const uuidMatch = xml.match(/UUID=["']([a-fA-F0-9\-]{36})["']/);
            const uuid = uuidMatch ? uuidMatch[1] : null;
            const fileName = uuid ? `${uuid}.xml` : `cfdi_${i + 1}.xml`;
            const destDir = downloadPath || ".";
            const filePath = path.join(destDir, fileName);
            fs.writeFileSync(filePath, xml, "utf-8");
            this.log(`✓ ${i + 1}/${total} — ${filePath}`);
            downloaded++;
            success = true;
            break;
          } catch (e) {
            if (retry < 2) {
              this.log(`Reintentando ${i + 1}/${total}...`);
              await page.waitForTimeout(3000);
            } else {
              this.log(`✗ ${i + 1}/${total} — Error: ${e.message}`);
              failed++;
            }
          }
        }
        await page.waitForTimeout(2000);
      }

      const summary = `Periodo completado: ${downloaded} OK, ${failed} FALLIDAS`;
      if (failed > 0) {
        this.log(`⚠️  ${summary}`);
      } else {
        this.log(summary);
      }
      return { ok: true, downloaded, failed, total };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }

  async retrieveDownloads(downloadPath) {
    const page = this.page;
    if (!page) return { ok: false, msg: "Navegador no inicializado" };

    try {
      this.log("Navegando a Recuperar descargas...");
      const recuperarLink = page.locator("text=Recuperar descargas").first();
      if ((await recuperarLink.count()) === 0) {
        const consultas = page.locator("text=Consultas").first();
        if ((await consultas.count()) > 0) {
          await consultas.click();
          await page.waitForTimeout(1000);
        }
      }
      const recuperar = page.locator("text=Recuperar descargas").first();
      if ((await recuperar.count()) > 0) {
        await recuperar.click();
        await page.waitForLoadState("load");
        await page.waitForTimeout(3000);
      }

      const downloadLinks = page.locator("a:has-text('Descargar'), button:has-text('Descargar')");
      const linkCount = await downloadLinks.count();

      if (linkCount === 0) {
        return { ok: false, msg: "No hay descargas disponibles para recuperar. Las solicitudes pueden tardar minutos en procesarse." };
      }

      let downloaded = 0;
      let failed = 0;

      for (let i = 0; i < linkCount; i++) {
        const link = downloadLinks.nth(i);
        try {
          const [download] = await Promise.all([
            page.waitForEvent("download"),
            link.click(),
          ]);

          const now = new Date();
          const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const destDir = downloadPath || path.join(process.cwd(), "downloads", dateStr);
          fs.mkdirSync(destDir, { recursive: true });

          const fileName = download.suggestedFilename() || `descarga_${i}_${dateStr}.zip`;
          const filePath = path.join(destDir, fileName);
          await download.saveAs(filePath);
          this.log(`Descargado: ${fileName}`);
          downloaded++;
        } catch (e) {
          this.log(`Error al descargar: ${e.message}`);
          failed++;
        }
        await page.waitForTimeout(1000);
      }

      return { ok: true, downloaded, failed };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }

  async downloadPeriodo(year, month, tipo, downloadPath) {
    const page = this.page;
    if (!page) return { ok: false, msg: "Navegador no inicializado" };

    const meses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];
    const mesStr = meses[month - 1];

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        this.log(`[${attempt}/${MAX_RETRIES}] Periodo: ${mesStr} ${year} (${tipo})`);

        const searchResult = await this.searchPeriodo(year, month);
        if (!searchResult.ok) {
          if (attempt < MAX_RETRIES) {
            this.log("Reintentando búsqueda...");
            await page.waitForTimeout(3000);
            continue;
          }
          return { ok: false, msg: `Error en búsqueda: ${searchResult.msg}` };
        }

        const downloadResult = await this.requestDownloadAll(downloadPath);
        if (downloadResult.total > 0) {
          this.log(`Descargadas: ${downloadResult.downloaded}/${downloadResult.total}`);
        }
        if (downloadResult.failed > 0) {
          this.log(`${downloadResult.failed} fallidas`);
        }

        return {
          ok: true,
          msg: `${mesStr} ${year} - ${downloadResult.downloaded}/${downloadResult.total} descargadas`,
        };
      } catch (e) {
        this.log(`Error en intento ${attempt}: ${e.message}`);
        if (attempt < MAX_RETRIES) {
          this.log("Reintentando...");
          await page.waitForTimeout(3000);
        } else {
          return { ok: false, msg: `Error: ${e.message}` };
        }
      }
    }

    return { ok: false, msg: "Falló después de reintentos" };
  }

  async close() {
    try {
      if (this.browser) await this.browser.close();
    } catch {}
    this.page = null;
    this.browser = null;
  }
}

module.exports = { SATClient };
