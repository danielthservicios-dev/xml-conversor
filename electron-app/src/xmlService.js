const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");
const ExcelJS = require("exceljs");
const os = require("os");

const IMPIVA = "002";
const IMPIEPS = "003";

function parseCFDI(filePath) {
  try {
    const xml = fs.readFileSync(filePath, "utf-8");
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const json = parser.parse(xml);

    const comprobante = json["cfdi:Comprobante"] || json["Comprobante"];
    if (!comprobante) return null;

    const ns =
      comprobante["@_xmlns:cfdi"] ||
      (comprobante["@_xmlns"] && comprobante["@_xmlns"].includes("cfdi") ? comprobante["@_xmlns"] : "");
    const emisor = comprobante["cfdi:Emisor"] || comprobante["Emisor"] || {};
    const receptor = comprobante["cfdi:Receptor"] || comprobante["Receptor"] || {};

    let uuid = "";
    const complemento = comprobante["cfdi:Complemento"] || comprobante["Complemento"];
    if (complemento) {
      const tfd = complemento["tfd:TimbreFiscalDigital"] || complemento["TimbreFiscalDigital"];
      if (tfd) uuid = tfd["@_UUID"] || "";
    }

    let iva = 0;
    let ieps = 0;
    const impuestos = comprobante["cfdi:Impuestos"] || comprobante["Impuestos"];
    if (impuestos) {
      const traslados = impuestos["cfdi:Traslados"] || impuestos["Traslados"];
      if (traslados) {
        let items = traslados["cfdi:Traslado"] || traslados["Traslado"];
        if (!Array.isArray(items)) items = items ? [items] : [];
        for (const t of items) {
          const imp = t["@_Impuesto"] || "";
          const impo = parseFloat(t["@_Importe"] || "0");
          if (imp === IMPIVA) iva += impo;
          else if (imp === IMPIEPS) ieps += impo;
        }
      }
    }

    return {
      rfcEmisor: emisor["@_Rfc"] || "",
      nombreEmisor: emisor["@_Nombre"] || "",
      rfcReceptor: receptor["@_Rfc"] || "",
      nombreReceptor: receptor["@_Nombre"] || "",
      uuid,
      serie: comprobante["@_Serie"] || "",
      folio: comprobante["@_Folio"] || "",
      fecha: comprobante["@_Fecha"] || "",
      subtotal: parseFloat(comprobante["@_SubTotal"] || "0"),
      iva,
      ieps,
      total: parseFloat(comprobante["@_Total"] || "0"),
      formaPago: comprobante["@_FormaPago"] || "",
      metodoPago: comprobante["@_MetodoPago"] || "",
      usoCFDI: receptor["@_UsoCFDI"] || "",
      status: comprobante["@_Status"] || "",
      moneda: comprobante["@_Moneda"] || "",
      tipoComprobante: comprobante["@_TipoDeComprobante"] || "",
    };
  } catch {
    return null;
  }
}

function parseFolder(folderPath) {
  const valid = [];
  const invalid = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.name.toLowerCase().endsWith(".xml")) {
        const row = parseCFDI(fullPath);
        if (row && row.uuid) valid.push(row);
        else invalid.push(entry.name);
      }
    }
  }

  walk(folderPath);
  return { valid, invalid };
}

async function generateExcel(rows, outputPath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Facturas");

  const headers = [
    "RFC Emisor", "Nombre Emisor", "RFC Receptor", "Nombre Receptor",
    "UUID", "Serie", "Folio", "Fecha", "Subtotal", "IVA", "IEPS",
    "Total", "FormaPago", "MetodoPago", "UsoCFDI", "Status", "Moneda", "TipoComprobante",
  ];

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F5E9" },
  };

  for (const r of rows) {
    ws.addRow([
      r.rfcEmisor, r.nombreEmisor, r.rfcReceptor, r.nombreReceptor,
      r.uuid, r.serie, r.folio, r.fecha,
      r.subtotal, r.iva, r.ieps, r.total,
      r.formaPago, r.metodoPago, r.usoCFDI, r.status, r.moneda, r.tipoComprobante,
    ]);
  }

  // Auto-width
  ws.columns.forEach((col, i) => {
    let maxLen = headers[i].length;
    rows.forEach((r) => {
      const val = String(
        [r.rfcEmisor, r.nombreEmisor, r.rfcReceptor, r.nombreReceptor,
         r.uuid, r.serie, r.folio, r.fecha,
         r.subtotal, r.iva, r.ieps, r.total,
         r.formaPago, r.metodoPago, r.usoCFDI, r.status, r.moneda, r.tipoComprobante][i] || ""
      );
      maxLen = Math.max(maxLen, val.length);
    });
    col.width = Math.min(maxLen + 3, 50);
  });

  // Number format
  for (let i = 2; i <= rows.length + 1; i++) {
    for (const col of [9, 10, 11, 12]) {
      const cell = ws.getCell(i, col);
      if (typeof cell.value === "number") {
        cell.numFmt = "$#,##0.00";
      }
    }
  }

  await wb.xlsx.writeFile(outputPath);
}

module.exports = { parseCFDI, parseFolder, generateExcel };
