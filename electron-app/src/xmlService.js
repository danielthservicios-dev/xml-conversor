const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");
const ExcelJS = require("exceljs");

const IMPIVA = "002";
const IMPISR = "001";

function findKey(obj, ...keys) {
  if (!obj) return null;
  for (const key of keys) {
    if (obj[key] !== undefined) return obj[key];
  }
  return null;
}

function safeArray(val) {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}

function parseCFDI(filePath) {
  let xml;
  try {
    xml = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }

  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "@_",
    });
    const json = parser.parse(xml);

    const comprobante = findKey(json,
      "cfdi:Comprobante", "cfdi33:Comprobante", "cfdi40:Comprobante",
      "Comprobante"
    );
    if (!comprobante) return null;

    const tipo = comprobante["@_TipoDeComprobante"] || "";
    if (tipo === "P") {
      return parsePagoCFDI(comprobante, filePath);
    }
    return [parseNormalCFDI(comprobante, filePath)];
  } catch {
    return null;
  }
}

function parseNormalCFDI(comprobante, filePath) {
  const emisor = findKey(comprobante,
    "cfdi:Emisor", "cfdi33:Emisor", "cfdi40:Emisor", "Emisor"
  ) || {};
  const receptor = findKey(comprobante,
    "cfdi:Receptor", "cfdi33:Receptor", "cfdi40:Receptor", "Receptor"
  ) || {};

  let uuid = "";
  const complemento = findKey(comprobante,
    "cfdi:Complemento", "cfdi33:Complemento", "cfdi40:Complemento", "Complemento"
  );
  if (complemento) {
    const tfd = findKey(complemento,
      "tfd:TimbreFiscalDigital", "TimbreFiscalDigital"
    );
    if (tfd) uuid = tfd["@_UUID"] || "";
  }

  const conceptos = findKey(comprobante,
    "cfdi:Conceptos", "cfdi33:Conceptos", "cfdi40:Conceptos", "Conceptos"
  );
  let descripcion = "";
  if (conceptos) {
    const items = safeArray(findKey(conceptos,
      "cfdi:Concepto", "cfdi33:Concepto", "cfdi40:Concepto", "Concepto"
    ));
    if (items.length > 0) {
      descripcion = items[0]["@_Descripcion"] || "";
    }
  }

  let ivaTrasladado = 0;
  let ivaRetenido = 0;
  let isrRetenido = 0;

  const impuestos = findKey(comprobante,
    "cfdi:Impuestos", "cfdi33:Impuestos", "cfdi40:Impuestos", "Impuestos"
  );
  if (impuestos) {
    const traslados = findKey(impuestos,
      "cfdi:Traslados", "cfdi33:Traslados", "cfdi40:Traslados", "Traslados"
    );
    if (traslados) {
      for (const t of safeArray(findKey(traslados,
        "cfdi:Traslado", "cfdi33:Traslado", "cfdi40:Traslado", "Traslado"
      ))) {
        if (t["@_Impuesto"] === IMPIVA) {
          ivaTrasladado += parseFloat(t["@_Importe"] || "0");
        }
      }
    }

    const retenciones = findKey(impuestos,
      "cfdi:Retenciones", "cfdi33:Retenciones", "cfdi40:Retenciones", "Retenciones"
    );
    if (retenciones) {
      for (const r of safeArray(findKey(retenciones,
        "cfdi:Retencion", "cfdi33:Retencion", "cfdi40:Retencion", "Retencion"
      ))) {
        const imp = r["@_Impuesto"] || "";
        const impo = parseFloat(r["@_Importe"] || "0");
        if (imp === IMPIVA) ivaRetenido += impo;
        else if (imp === IMPISR) isrRetenido += impo;
      }
    }
  }

  const subtotal = parseFloat(comprobante["@_SubTotal"] || "0");
  const descuento = parseFloat(comprobante["@_Descuento"] || "0");
  const subtotalReal = subtotal - descuento;

  return {
    archivo: filePath,
    version: comprobante["@_Version"] || "",
    tipo: comprobante["@_TipoDeComprobante"] || "",
    metodo: comprobante["@_MetodoPago"] || "",
    formaPago: comprobante["@_FormaPago"] || "",
    usoCFDI: receptor["@_UsoCFDI"] || "",
    uuid,
    folio: comprobante["@_Folio"] || "",
    serie: comprobante["@_Serie"] || "",
    fecha: comprobante["@_Fecha"] || "",
    rfcEmisor: emisor["@_Rfc"] || "",
    nombreEmisor: emisor["@_Nombre"] || "",
    rfcReceptor: receptor["@_Rfc"] || "",
    nombreReceptor: receptor["@_Nombre"] || "",
    descripcion,
    regimen: emisor["@_RegimenFiscal"] || "",
    subtotal,
    descuento,
    subtotalReal,
    iva: ivaTrasladado,
    importeRetIva: ivaRetenido,
    importeRetISR: isrRetenido,
    total: parseFloat(comprobante["@_Total"] || "0"),
    tipo2: "",
    poliza: "",
    observaciones: "",
    comFechaPago: "",
    compFormaPago: "",
    cfdiRelEg: "",
    cfdiRelPag: "",
    cp: receptor["@_DomicilioFiscalReceptor"] || receptor["@_CP"] || "",
    monedaP: "",
    tipoCambioP: "",
    numParcialidad: "",
    impSaldoAnt: 0,
    impPagado: 0,
    impSaldoInsoluto: 0,
    monedaDR: "",
    objetoImpDR: "",
    equivalenciaDR: "",
  };
}

function parsePagoCFDI(comprobante, filePath) {
  const emisor = findKey(comprobante,
    "cfdi:Emisor", "cfdi33:Emisor", "cfdi40:Emisor", "Emisor"
  ) || {};
  const receptor = findKey(comprobante,
    "cfdi:Receptor", "cfdi33:Receptor", "cfdi40:Receptor", "Receptor"
  ) || {};

  const complemento = findKey(comprobante,
    "cfdi:Complemento", "cfdi33:Complemento", "cfdi40:Complemento", "Complemento"
  );
  if (!complemento) return null;

  let tfdUUID = "";
  const tfd = findKey(complemento,
    "tfd:TimbreFiscalDigital", "TimbreFiscalDigital"
  );
  if (tfd) tfdUUID = tfd["@_UUID"] || "";

  const pagos = findKey(complemento,
    "pago20:Pagos", "pago10:Pagos", "Pagos"
  );
  if (!pagos) return null;

  const totales = findKey(pagos,
    "pago20:Totales", "pago10:Totales", "Totales"
  ) || {};
  const montoTotalPagos = parseFloat(totales["@_MontoTotalPagos"] || "0");

  const rows = [];

  const pagosList = safeArray(findKey(pagos,
    "pago20:Pago", "pago10:Pago", "Pago"
  ));

  for (const pago of pagosList) {
    const fechaPago = pago["@_FechaPago"] || "";
    const formaPagoP = pago["@_FormaDePagoP"] || "";
    const monedaP = pago["@_MonedaP"] || "";
    const tipoCambioP = pago["@_TipoCambioP"] || "";

    const doctos = safeArray(findKey(pago,
      "pago20:DoctoRelacionado", "pago10:DoctoRelacionado", "DoctoRelacionado"
    ));

    for (const docto of doctos) {
      const idDocumento = docto["@_IdDocumento"] || "";

      let ivaDR = 0;
      const impuestosDR = findKey(docto,
        "pago20:ImpuestosDR", "pago10:ImpuestosDR", "ImpuestosDR"
      );
      if (impuestosDR) {
        const trasladosDR = findKey(impuestosDR,
          "pago20:TrasladosDR", "pago10:TrasladosDR", "TrasladosDR"
        );
        if (trasladosDR) {
          const trasladoDR = safeArray(findKey(trasladosDR,
            "pago20:TrasladoDR", "pago10:TrasladoDR", "TrasladoDR"
          ));
          if (trasladoDR.length > 0) {
            ivaDR = parseFloat(trasladoDR[0]["@_ImporteDR"] || "0");
          }
        }
      }

      rows.push({
        archivo: filePath,
        version: comprobante["@_Version"] || "",
        tipo: "P",
        metodo: comprobante["@_MetodoPago"] || "",
        formaPago: formaPagoP,
        usoCFDI: receptor["@_UsoCFDI"] || "",
        uuid: tfdUUID,
        folio: docto["@_Folio"] || "",
        serie: docto["@_Serie"] || "",
        fecha: fechaPago,
        rfcEmisor: emisor["@_Rfc"] || "",
        nombreEmisor: emisor["@_Nombre"] || "",
        rfcReceptor: receptor["@_Rfc"] || "",
        nombreReceptor: receptor["@_Nombre"] || "",
        descripcion: "Complemento de Pago - " + idDocumento,
        regimen: emisor["@_RegimenFiscal"] || "",
        subtotal: montoTotalPagos,
        descuento: 0,
        subtotalReal: montoTotalPagos,
        iva: ivaDR,
        importeRetIva: 0,
        importeRetISR: 0,
        total: montoTotalPagos,
        tipo2: "",
        poliza: "",
        observaciones: "",
        comFechaPago: fechaPago,
        compFormaPago: formaPagoP,
        cfdiRelEg: "",
        cfdiRelPag: idDocumento,
        cp: receptor["@_DomicilioFiscalReceptor"] || receptor["@_CP"] || "",
        monedaP,
        tipoCambioP,
        numParcialidad: docto["@_NumParcialidad"] || "",
        impSaldoAnt: parseFloat(docto["@_ImpSaldoAnt"] || "0"),
        impPagado: parseFloat(docto["@_ImpPagado"] || "0"),
        impSaldoInsoluto: parseFloat(docto["@_ImpSaldoInsoluto"] || "0"),
        monedaDR: docto["@_MonedaDR"] || "",
        objetoImpDR: docto["@_ObjetoImpDR"] || "",
        equivalenciaDR: docto["@_EquivalenciaDR"] || "",
      });
    }
  }

  return rows.length > 0 ? rows : null;
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
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".xml")) {
        const rows = parseCFDI(fullPath);
        if (rows && rows.length > 0 && rows[0] && rows[0].uuid) valid.push(...rows);
        else invalid.push(entry.name);
      }
    }
  }

  walk(folderPath);
  return { valid, invalid };
}

// ─── Excel generation ──────────────────────────────────────────────

const EXCEL_HEADERS = [
  "Archivo", "Version", "Tipo", "Método", "FormaDePago", "UsoCFDI", "UUID",
  "Folio", "Serie", "Fecha", "RFCEmisor", "NombreEmisor", "RFCReceptor",
  "NombreReceptor", "Descripción", "Régimen", "SubTotal", "Descuento",
  "Subtotal Real", "IVA", "ImporteRetIva", "ImporteRetISR", "Total", "Tipo",
  "Póliza", "Observaciones", "Com_FechaPago", "Comp_FormaPago", "CFDIRel_Eg",
  "CFDIRel_Pag", "CP", "MonedaP", "TipoCambioP", "NumParcialidad",
  "ImpSaldoAnt", "ImpPagado", "ImpSaldoInsoluto", "MonedaDR", "ObjetoImpDR",
  "EquivalenciaDR",
];

async function generateExcel(rows, outputPath) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Facturas");

  const headerRow = ws.addRow(EXCEL_HEADERS);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F5E9" },
  };

  for (const r of rows) {
    ws.addRow([
      r.archivo, r.version, r.tipo, r.metodo, r.formaPago, r.usoCFDI, r.uuid,
      r.folio, r.serie, r.fecha, r.rfcEmisor, r.nombreEmisor, r.rfcReceptor,
      r.nombreReceptor, r.descripcion, r.regimen, r.subtotal, r.descuento,
      r.subtotalReal, r.iva, r.importeRetIva, r.importeRetISR, r.total, r.tipo2,
      r.poliza, r.observaciones, r.comFechaPago, r.compFormaPago, r.cfdiRelEg,
      r.cfdiRelPag, r.cp, r.monedaP, r.tipoCambioP, r.numParcialidad,
      r.impSaldoAnt, r.impPagado, r.impSaldoInsoluto, r.monedaDR, r.objetoImpDR,
      r.equivalenciaDR,
    ]);
  }

  ws.columns.forEach((col, i) => {
    let maxLen = EXCEL_HEADERS[i].length;
    for (const r of rows) {
      const vals = [
        r.archivo, r.version, r.tipo, r.metodo, r.formaPago, r.usoCFDI, r.uuid,
        r.folio, r.serie, r.fecha, r.rfcEmisor, r.nombreEmisor, r.rfcReceptor,
        r.nombreReceptor, r.descripcion, r.regimen, r.subtotal, r.descuento,
        r.subtotalReal, r.iva, r.importeRetIva, r.importeRetISR, r.total, r.tipo2,
        r.poliza, r.observaciones, r.comFechaPago, r.compFormaPago, r.cfdiRelEg,
        r.cfdiRelPag, r.cp, r.monedaP, r.tipoCambioP, r.numParcialidad,
        r.impSaldoAnt, r.impPagado, r.impSaldoInsoluto, r.monedaDR, r.objetoImpDR,
        r.equivalenciaDR,
      ];
      const val = String(vals[i] || "");
      maxLen = Math.max(maxLen, val.length);
    }
    col.width = Math.min(maxLen + 3, 50);
  });

  const moneyColumns = [17, 18, 19, 20, 21, 22, 23, 35, 36, 37]; // 1-indexed
  for (let i = 2; i <= rows.length + 1; i++) {
    for (const col of moneyColumns) {
      const cell = ws.getCell(i, col);
      if (typeof cell.value === "number") {
        cell.numFmt = '$#,##0.00';
      }
    }
  }

  await wb.xlsx.writeFile(outputPath);
}

module.exports = { parseCFDI, parseFolder, generateExcel, findKey, safeArray };
