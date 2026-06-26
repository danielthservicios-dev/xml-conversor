const path = require("path");
const fs = require("fs");
const os = require("os");
const { parseCFDI, parseFolder, generateExcel, findKey, safeArray } = require("../src/xmlService");

const FIXTURES_DIR = path.join(__dirname, "fixtures");

describe("findKey", () => {
  test("returns value for first matching key", () => {
    const obj = { a: 1, b: 2 };
    expect(findKey(obj, "a", "b")).toBe(1);
  });

  test("returns null for no match", () => {
    expect(findKey({}, "a")).toBeNull();
  });

  test("returns null for null/undefined input", () => {
    expect(findKey(null, "a")).toBeNull();
    expect(findKey(undefined, "a")).toBeNull();
  });

  test("falls through to subsequent keys", () => {
    const obj = { b: 2 };
    expect(findKey(obj, "a", "b")).toBe(2);
  });
});

describe("safeArray", () => {
  test("returns empty array for null/undefined", () => {
    expect(safeArray(null)).toEqual([]);
    expect(safeArray(undefined)).toEqual([]);
  });

  test("wraps single value in array", () => {
    expect(safeArray("a")).toEqual(["a"]);
    expect(safeArray({ x: 1 })).toEqual([{ x: 1 }]);
  });

  test("returns array as-is", () => {
    const arr = [1, 2, 3];
    expect(safeArray(arr)).toBe(arr);
  });
});

describe("parseCFDI", () => {
  test("parses valid CFDI 4.0 (factura.xml)", () => {
    const filePath = path.join(FIXTURES_DIR, "factura.xml");
    const rows = parseCFDI(filePath);
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.uuid).toBe("dfbaa870-b974-4645-9584-7e8bd5fb685f");
    expect(row.rfcEmisor).toBe("EKU9003173C9");
    expect(row.nombreEmisor).toBe("ESCUELA KEMPER URGATE");
    expect(row.rfcReceptor).toBe("URE180429TM6");
    expect(row.nombreReceptor).toBe("UNIVERSIDAD ROBOTICA ESPAÑOLA");
    expect(row.version).toBe("4.0");
    expect(row.tipo).toBe("I");
    expect(row.folio).toBe("Folio");
    expect(row.serie).toBe("Serie");
    expect(row.metodo).toBe("PPD");
    expect(row.formaPago).toBe("99");
    expect(row.usoCFDI).toBe("G01");
    expect(row.subtotal).toBe(200);
    expect(row.total).toBe(199.96);
    expect(row.baseIVA16).toBe(1);
    expect(row.iva16).toBe(0.16);
    expect(row.iva8).toBe(0);
    expect(row.iva0Base).toBe(0);
    expect(row.exentoBase).toBe(0);
    expect(row.baseIEPS).toBe(0);
    expect(row.ieps).toBe(0);
    expect(row.importeRetIva).toBe(0.10);
    expect(row.importeRetISR).toBe(0.10);
    expect(row.descuento).toBe(0);
    expect(row.subtotalReal).toBe(200);
    expect(row.moneda).toBe("MXN");
    expect(row.tipoCambio).toBe("");
    expect(row.exportacion).toBe("01");
    expect(row.lugarExpedicion).toBe("20000");
    expect(row.monedaDR).toBe("");
    expect(row.cfdiRelPag).toBe("");
    expect(row.tipoRelacion).toBe("");
    expect(row.montoP).toBe("");
  });

  test("parses CFDI 4.0 with exento IVA (factura_exento.xml)", () => {
    const filePath = path.join(FIXTURES_DIR, "factura_exento.xml");
    const rows = parseCFDI(filePath);
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.uuid).toBe("fd5c008b-3d30-4b9b-9920-a432678d4d9d");
    expect(row.rfcEmisor).toBe("EKU9003173C9");
    expect(row.subtotal).toBe(125);
    expect(row.exentoBase).toBe(125);
    expect(row.iva16).toBe(0);
    expect(row.importeRetIva).toBe(0);
    expect(row.importeRetISR).toBe(0);
  });

  test("parses CFDI 4.0 with tasa 0% (factura_tasa0.xml)", () => {
    const filePath = path.join(FIXTURES_DIR, "factura_tasa0.xml");
    const rows = parseCFDI(filePath);
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.uuid).toBe("6f3c2d5b-6661-4083-8835-4655089b07d7");
    expect(row.subtotal).toBe(200);
    expect(row.total).toBe(200);
    expect(row.iva0Base).toBe(200);
    expect(row.iva16).toBe(0);
    expect(row.importeRetIva).toBe(0);
    expect(row.importeRetISR).toBe(0);
  });

  test("parses CFDI 4.0 with retenciones (factura_tasa0_ret.xml)", () => {
    const filePath = path.join(FIXTURES_DIR, "factura_tasa0_ret.xml");
    const rows = parseCFDI(filePath);
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.uuid).toBe("ced14bc9-7620-4d45-898b-64ab20938de7");
    expect(row.subtotal).toBe(200);
    expect(row.total).toBe(199.80);
    expect(row.iva0Base).toBe(200);
    expect(row.iva16).toBe(0);
    expect(row.importeRetIva).toBe(0.10);
    expect(row.importeRetISR).toBe(0.10);
  });

  test("parses CFDI 3.3 (cfdi33.xml)", () => {
    const filePath = path.join(FIXTURES_DIR, "cfdi33.xml");
    const rows = parseCFDI(filePath);
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.uuid).toBe("12345678-1234-1234-1234-123456789abc");
    expect(row.version).toBe("3.3");
    expect(row.rfcEmisor).toBe("AAA010101AAA");
    expect(row.nombreEmisor).toBe("EMPRESA TEST SA DE CV");
    expect(row.subtotal).toBe(1000);
    expect(row.total).toBe(1160);
    expect(row.baseIVA16).toBe(1000);
    expect(row.iva16).toBe(160);
    expect(row.metodo).toBe("PUE");
    expect(row.formaPago).toBe("01");
    expect(row.usoCFDI).toBe("G01");
  });

  test("parses CFDI with multiple conceptos and mixed IVA rates (factura_multi_concepto.xml)", () => {
    const filePath = path.join(FIXTURES_DIR, "factura_multi_concepto.xml");
    const rows = parseCFDI(filePath);
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.uuid).toBe("multi-concepto-0000-0000-000000000001");
    expect(row.subtotal).toBe(1800);
    expect(row.total).toBe(2000);
    expect(row.descripcion).toBe("Producto A; Producto B; Producto C");
    expect(row.baseIVA16).toBe(1000);
    expect(row.iva16).toBe(160);
    expect(row.baseIVA8).toBe(500);
    expect(row.iva8).toBe(40);
    expect(row.exentoBase).toBe(300);
    expect(row.iva0Base).toBe(0);
    expect(row.baseIEPS).toBe(0);
    expect(row.ieps).toBe(0);
    expect(row.moneda).toBe("MXN");
    expect(row.exportacion).toBe("01");
    expect(row.lugarExpedicion).toBe("20000");
  });

  test("parses payment CFDI (pago.xml) - Tipo P", () => {
    const filePath = path.join(FIXTURES_DIR, "pago.xml");
    const rows = parseCFDI(filePath);
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.tipo).toBe("P");
    expect(row.uuid).toBe("pago-uuid-0000-0000-000000000001");
    expect(row.rfcEmisor).toBe("EKU9003173C9");
    expect(row.comFechaPago).toBe("2026-06-10T12:00:00");
    expect(row.compFormaPago).toBe("03");
    expect(row.cfdiRelPag).toBe("factura-uuid-0000-0000-000000000001");
    expect(row.monedaP).toBe("MXN");
    expect(row.tipoCambioP).toBe("1");
    expect(row.numParcialidad).toBe("1");
    expect(row.impSaldoAnt).toBe(500);
    expect(row.impPagado).toBe(500);
    expect(row.impSaldoInsoluto).toBe(0);
    expect(row.baseIVA16).toBe(500);
    expect(row.iva16).toBe(80);
    expect(row.iva8).toBe(0);
    expect(row.iva0Base).toBe(0);
    expect(row.exentoBase).toBe(0);
    expect(row.baseIEPS).toBe(0);
    expect(row.ieps).toBe(0);
    expect(row.subtotal).toBe(500);
    expect(row.total).toBe(500);
    expect(row.montoP).toBe("500.00");
  });

  test("returns null for malformed XML", () => {
    const filePath = path.join(FIXTURES_DIR, "malformed.xml");
    const result = parseCFDI(filePath);
    expect(result).toBeNull();
  });

  test("returns null for empty document", () => {
    const filePath = path.join(FIXTURES_DIR, "empty.xml");
    const result = parseCFDI(filePath);
    expect(result).toBeNull();
  });

  test("returns null for non-existent file", () => {
    const result = parseCFDI("/nonexistent/file.xml");
    expect(result).toBeNull();
  });

  test("parses CFDI without UUID (no complemento)", () => {
    const filePath = path.join(FIXTURES_DIR, "no_uuid.xml");
    const rows = parseCFDI(filePath);
    expect(rows).not.toBeNull();
    expect(rows.length).toBe(1);
    const row = rows[0];
    expect(row.uuid).toBe("");
    expect(row.rfcEmisor).toBe("EKU9003173C9");
    expect(row.subtotal).toBe(100);
    expect(row.total).toBe(100);
  });

  test("row contains all expected fields", () => {
    const filePath = path.join(FIXTURES_DIR, "factura.xml");
    const rows = parseCFDI(filePath);
    const row = rows[0];

    const expectedFields = [
      "archivo", "version", "tipo", "metodo", "formaPago", "usoCFDI",
      "uuid", "folio", "serie", "fecha", "rfcEmisor", "nombreEmisor",
      "rfcReceptor", "nombreReceptor", "descripcion", "regimen",
      "subtotal", "descuento", "subtotalReal",
      "baseIVA16", "iva16", "baseIVA8", "iva8", "iva0Base",
      "exentoBase", "baseIEPS", "ieps",
      "importeRetIva", "importeRetISR",
      "total", "moneda", "tipoCambio", "exportacion", "lugarExpedicion",
      "tipo2", "poliza", "observaciones",
      "comFechaPago", "compFormaPago", "cfdiRelEg", "tipoRelacion", "cfdiRelPag", "cp",
      "monedaP", "tipoCambioP", "montoP", "numParcialidad", "impSaldoAnt",
      "impPagado", "impSaldoInsoluto", "monedaDR", "objetoImpDR",
      "equivalenciaDR",
    ];

    for (const field of expectedFields) {
      expect(row).toHaveProperty(field);
    }
  });
});

describe("parseFolder", () => {
  test("returns valid and invalid XMLs from directory", () => {
    const result = parseFolder(FIXTURES_DIR);
    expect(result.valid.length).toBeGreaterThan(0);
    expect(result.invalid.length).toBeGreaterThan(0);
    const validNames = result.valid.map((r) => path.basename(r.archivo));
    expect(validNames).toContain("factura.xml");
    expect(validNames).toContain("factura_exento.xml");
    expect(validNames).toContain("factura_ingreso.xml");
    expect(validNames).toContain("factura_tasa0.xml");
    expect(validNames).toContain("factura_tasa0_ret.xml");
    expect(validNames).toContain("factura_multi_concepto.xml");
    expect(validNames).toContain("cfdi33.xml");
    expect(validNames).toContain("pago.xml");
    expect(validNames).toContain("no_uuid.xml");
    expect(result.invalid).toContain("malformed.xml");
    expect(result.invalid).toContain("empty.xml");
  });

  test("returns empty result for empty directory", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "xml-test-"));
    try {
      const result = parseFolder(tmpDir);
      expect(result.valid).toEqual([]);
      expect(result.invalid).toEqual([]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test("throws error for non-existent directory", () => {
    expect(() => parseFolder("/nonexistent/dir")).toThrow();
  });
});

describe("generateExcel", () => {
  test("creates valid xlsx file with headers", async () => {
    const filePath = path.join(FIXTURES_DIR, "factura.xml");
    const rows = parseCFDI(filePath);
    const outputPath = path.join(os.tmpdir(), `test-facturas-${Date.now()}.xlsx`);

    await generateExcel(rows, outputPath);

    expect(fs.existsSync(outputPath)).toBe(true);
    const stats = fs.statSync(outputPath);
    expect(stats.size).toBeGreaterThan(0);

    fs.unlinkSync(outputPath);
  });

  test("creates xlsx with correct header count", async () => {
    const filePath = path.join(FIXTURES_DIR, "factura.xml");
    const rows = parseCFDI(filePath);
    const outputPath = path.join(os.tmpdir(), `test-facturas-${Date.now()}.xlsx`);

    await generateExcel(rows, outputPath);

    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const ws = wb.getWorksheet("Facturas");
    expect(ws).toBeDefined();
    expect(ws.rowCount).toBe(2);
    expect(ws.getRow(1).cellCount).toBe(53);
    expect(ws.getCell(1, 1).value).toBe("Archivo");
    expect(ws.getCell(1, 7).value).toBe("UUID");
    expect(ws.getCell(1, 11).value).toBe("RFCEmisor");

    fs.unlinkSync(outputPath);
  });

  test("creates xlsx from multiple rows", async () => {
    const allRows = [];
    for (const name of ["factura.xml", "factura_exento.xml", "factura_tasa0.xml"]) {
      const rows = parseCFDI(path.join(FIXTURES_DIR, name));
      allRows.push(...rows);
    }
    const outputPath = path.join(os.tmpdir(), `test-multi-${Date.now()}.xlsx`);

    await generateExcel(allRows, outputPath);

    const ExcelJS = require("exceljs");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(outputPath);
    const ws = wb.getWorksheet("Facturas");
    expect(ws.rowCount).toBe(4);
    expect(ws.getRow(2).getCell(7).value).toBe("dfbaa870-b974-4645-9584-7e8bd5fb685f");

    fs.unlinkSync(outputPath);
  });
});
