const { chromium } = require("playwright");

const SAT_URL = "https://portalcfdi.facturaelectronica.sat.gob.mx/";

class SATClient {
  constructor(rutaCer, rutaKey, password) {
    this.rutaCer = rutaCer;
    this.rutaKey = rutaKey;
    this.password = password;
    this.browser = null;
    this.page = null;
  }

  async login() {
    this.browser = await chromium.launch({ headless: false });
    const context = await this.browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1366, height: 768 },
    });
    this.page = await context.newPage();
    const page = this.page;

    try {
      await page.goto(SAT_URL, { timeout: 30000 });
      await page.waitForLoadState("networkidle");

      await page.locator("text=Iniciar sesión").first().waitFor({ timeout: 15000 });
      await page.locator("text=Iniciar sesión").first().click();
      await page.waitForTimeout(2000);

      await page.locator("text=Certificado de sello digital").first().waitFor({ timeout: 10000 });
      await page.locator("text=Certificado de sello digital").first().click();
      await page.waitForTimeout(1000);

      const fileInputs = page.locator("input[type='file']");
      await fileInputs.first().waitFor({ timeout: 10000 });
      await fileInputs.nth(0).setInputFiles(this.rutaCer);
      await page.waitForTimeout(1000);

      const count = await fileInputs.count();
      if (count > 1) {
        await fileInputs.nth(1).setInputFiles(this.rutaKey);
      } else {
        await page.waitForTimeout(2000);
        const keyInputs = page.locator("input[type='file']");
        if ((await keyInputs.count()) > 1) {
          await keyInputs.nth(1).setInputFiles(this.rutaKey);
        } else {
          return { ok: false, msg: "No se encontró campo para la llave" };
        }
      }
      await page.waitForTimeout(1000);

      await page.locator("input[type='password']").first().waitFor({ timeout: 10000 });
      await page.locator("input[type='password']").first().fill(this.password);

      const submitBtn = page.locator("button[type='submit']").first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
      } else {
        await page.locator("text=Ingresar").first().click();
      }

      await page.waitForTimeout(5000);
      return { ok: true, msg: "Login exitoso" };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }

  async downloadPeriodo(year, month, tipo, downloadPath) {
    if (!this.page) return { ok: false, msg: "No hay sesión activa" };

    const meses = [
      "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
      "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
    ];

    try {
      await this.page.waitForTimeout(2000);

      // Select year and month (generic selectors - SAT may vary)
      const selects = await this.page.locator("select").all();
      for (const sel of selects) {
        const html = await sel.innerHTML();
        if (html.includes(String(year))) {
          await sel.selectOption(String(year));
          break;
        }
      }

      for (const sel of selects) {
        const html = await sel.innerHTML();
        if (html.includes(meses[month - 1].slice(0, 4))) {
          await sel.selectOption(String(month));
          break;
        }
      }

      // Click Buscar/Consultar
      const buscarBtn = this.page.locator("button:has-text('Buscar')").first();
      if ((await buscarBtn.count()) > 0) {
        await buscarBtn.click();
      } else {
        const consultarBtn = this.page.locator("button:has-text('Consultar')").first();
        if ((await consultarBtn.count()) > 0) await consultarBtn.click();
      }
      await this.page.waitForTimeout(8000);

      return { ok: true, msg: `${meses[month - 1]} ${year}` };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  }

  async close() {
    if (this.browser) await this.browser.close();
  }
}

module.exports = { SATClient };
