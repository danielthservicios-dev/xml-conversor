const fs = require("fs");
const path = require("path");
const { XMLParser } = require("fast-xml-parser");
const ExcelJS = require("exceljs");

const IMPIVA = "002";
const IMPISR = "001";
const IMPIEPS = "003";

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

function processTraslado(t) {
  return {
    impuesto: t["@_Impuesto"] || "",
    tasa: parseFloat(t["@_TasaOCuota"] || "0"),
    base: parseFloat(t["@_Base"] || "0"),
    importe: parseFloat(t["@_Importe"] || "0"),
    tipoFactor: t["@_TipoFactor"] || "",
  };
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
      return [parsePagoCFDIGeneral(comprobante, filePath)];
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

  const conceptosNode = findKey(comprobante,
    "cfdi:Conceptos", "cfdi33:Conceptos", "cfdi40:Conceptos", "Conceptos"
  );
  let descripcion = "";
  let baseIVA16 = 0, iva16 = 0;
  let baseIVA8 = 0, iva8 = 0;
  let iva0Base = 0;
  let exentoBase = 0;
  let baseIEPS = 0, ieps = 0;
  let ivaTrasladadoSum = 0;
  let ivaRetenido = 0;
  let isrRetenido = 0;
  let hasPerConceptoImpuestos = false;

  if (conceptosNode) {
    const items = safeArray(findKey(conceptosNode,
      "cfdi:Concepto", "cfdi33:Concepto", "cfdi40:Concepto", "Concepto"
    ));
    const descs = [];
    for (const item of items) {
      if (item["@_Descripcion"]) descs.push(item["@_Descripcion"]);

      const itemImpuestos = findKey(item,
        "cfdi:Impuestos", "cfdi33:Impuestos", "cfdi40:Impuestos", "Impuestos"
      );
      if (itemImpuestos) {
        hasPerConceptoImpuestos = true;
        const traslados = findKey(itemImpuestos,
          "cfdi:Traslados", "cfdi33:Traslados", "cfdi40:Traslados", "Traslados"
        );
        if (traslados) {
          for (const t of safeArray(findKey(traslados,
            "cfdi:Traslado", "cfdi33:Traslado", "cfdi40:Traslado", "Traslado"
          ))) {
            const { impuesto, tasa, base, importe, tipoFactor } = processTraslado(t);
            if (impuesto === IMPIVA) {
              ivaTrasladadoSum += importe;
              if (tipoFactor === "Exento") {
                exentoBase += base;
              } else if (Math.abs(tasa - 0.16) < 0.001) {
                iva16 += importe;
                baseIVA16 += base;
              } else if (Math.abs(tasa - 0.08) < 0.001) {
                iva8 += importe;
                baseIVA8 += base;
              } else if (Math.abs(tasa) < 0.001) {
                iva0Base += base;
              } else {
                iva16 += importe;
                baseIVA16 += base;
              }
            } else if (impuesto === IMPIEPS) {
              ieps += importe;
              baseIEPS += base;
            }
          }
        }

        const retenciones = findKey(itemImpuestos,
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
    }
    descripcion = descs.join("; ");
  }

  if (!hasPerConceptoImpuestos) {
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
          const { impuesto, tasa, base, importe, tipoFactor } = processTraslado(t);
          if (impuesto === IMPIVA) {
            ivaTrasladadoSum += importe;
            if (tipoFactor === "Exento") {
              exentoBase += base;
            } else if (Math.abs(tasa - 0.16) < 0.001) {
              iva16 += importe;
              baseIVA16 += base;
            } else if (Math.abs(tasa - 0.08) < 0.001) {
              iva8 += importe;
              baseIVA8 += base;
            } else if (Math.abs(tasa) < 0.001) {
              iva0Base += base;
            } else {
              iva16 += importe;
              baseIVA16 += base;
            }
          } else if (impuesto === IMPIEPS) {
            ieps += importe;
            baseIEPS += base;
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
  }

  let cfdiRelEg = "";
  let tipoRelacion = "";
  if (comprobante["@_TipoDeComprobante"] === "E") {
    const relacionados = findKey(comprobante,
      "cfdi:CfdiRelacionados", "cfdi33:CfdiRelacionados", "cfdi40:CfdiRelacionados", "CfdiRelacionados"
    );
    if (relacionados) {
      tipoRelacion = relacionados["@_TipoRelacion"] || "";
      const relList = safeArray(findKey(relacionados,
        "cfdi:CfdiRelacionado", "cfdi33:CfdiRelacionado", "cfdi40:CfdiRelacionado", "CfdiRelacionado"
      ));
      cfdiRelEg = relList.map(r => r["@_UUID"] || "").filter(Boolean).join("; ");
    }
  }

  const subtotal = parseFloat(comprobante["@_SubTotal"] || "0");
  const descuentoVal = parseFloat(comprobante["@_Descuento"] || "0");
  const subtotalReal = subtotal - descuentoVal;

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
    descuento: descuentoVal,
    subtotalReal,
    baseIVA16, iva16,
    baseIVA8, iva8,
    iva0Base,
    exentoBase,
    baseIEPS, ieps,
    importeRetIva: ivaRetenido,
    importeRetISR: isrRetenido,
    total: parseFloat(comprobante["@_Total"] || "0"),
    moneda: comprobante["@_Moneda"] || "",
    tipoCambio: comprobante["@_TipoCambio"] || "",
    exportacion: comprobante["@_Exportacion"] || "",
    lugarExpedicion: comprobante["@_LugarExpedicion"] || "",
    tipo2: "",
    poliza: "",
    observaciones: "",
    comFechaPago: "",
    compFormaPago: "",
    cfdiRelEg,
    tipoRelacion,
    cfdiRelPag: "",
    cp: receptor["@_DomicilioFiscalReceptor"] || receptor["@_CP"] || "",
    montoP: "",
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
    const montoP = pago["@_Monto"] || "";

    const doctos = safeArray(findKey(pago,
      "pago20:DoctoRelacionado", "pago10:DoctoRelacionado", "DoctoRelacionado"
    ));

    for (const docto of doctos) {
      const idDocumento = docto["@_IdDocumento"] || "";

      let drBaseIVA16 = 0, drIVA16 = 0;
      let drBaseIVA8 = 0, drIVA8 = 0;
      let drBaseIEPS = 0, drIEPS = 0;

      const impuestosDR = findKey(docto,
        "pago20:ImpuestosDR", "pago10:ImpuestosDR", "ImpuestosDR"
      );
      if (impuestosDR) {
        const trasladosDR = findKey(impuestosDR,
          "pago20:TrasladosDR", "pago10:TrasladosDR", "TrasladosDR"
        );
        if (trasladosDR) {
          for (const tdr of safeArray(findKey(trasladosDR,
            "pago20:TrasladoDR", "pago10:TrasladoDR", "TrasladoDR"
          ))) {
            const impuesto = tdr["@_ImpuestoDR"] || tdr["@_Impuesto"] || "";
            const base = parseFloat(tdr["@_BaseDR"] || tdr["@_Base"] || "0");
            const importe = parseFloat(tdr["@_ImporteDR"] || tdr["@_Importe"] || "0");
            const tasa = parseFloat(tdr["@_TasaOCuotaDR"] || tdr["@_TasaOCuota"] || "0");
            if (impuesto === IMPIVA) {
              if (Math.abs(tasa - 0.16) < 0.001) {
                drIVA16 += importe;
                drBaseIVA16 += base;
              } else if (Math.abs(tasa - 0.08) < 0.001) {
                drIVA8 += importe;
                drBaseIVA8 += base;
              } else {
                drIVA16 += importe;
                drBaseIVA16 += base;
              }
            } else if (impuesto === IMPIEPS) {
              drIEPS += importe;
              drBaseIEPS += base;
            }
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
        baseIVA16: drBaseIVA16, iva16: drIVA16,
        baseIVA8: drBaseIVA8, iva8: drIVA8,
        iva0Base: 0,
        exentoBase: 0,
        baseIEPS: drBaseIEPS, ieps: drIEPS,
        importeRetIva: 0,
        importeRetISR: 0,
        total: montoTotalPagos,
        moneda: comprobante["@_Moneda"] || "",
        tipoCambio: comprobante["@_TipoCambio"] || "",
        exportacion: comprobante["@_Exportacion"] || "",
        lugarExpedicion: comprobante["@_LugarExpedicion"] || "",
        tipo2: "",
        poliza: "",
        observaciones: "",
        comFechaPago: fechaPago,
        compFormaPago: formaPagoP,
        cfdiRelEg: "",
        tipoRelacion: "",
        cfdiRelPag: idDocumento,
        cp: receptor["@_DomicilioFiscalReceptor"] || receptor["@_CP"] || "",
        monedaP,
        montoP,
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

function parsePagoCFDIGeneral(comprobante, filePath) {
  const emisor = findKey(comprobante,
    "cfdi:Emisor", "cfdi33:Emisor", "cfdi40:Emisor", "Emisor"
  ) || {};
  const receptor = findKey(comprobante,
    "cfdi:Receptor", "cfdi33:Receptor", "cfdi40:Receptor", "Receptor"
  ) || {};

  const complemento = findKey(comprobante,
    "cfdi:Complemento", "cfdi33:Complemento", "cfdi40:Complemento", "Complemento"
  );

  let tfdUUID = "";
  if (complemento) {
    const tfd = findKey(complemento,
      "tfd:TimbreFiscalDigital", "TimbreFiscalDigital"
    );
    if (tfd) tfdUUID = tfd["@_UUID"] || "";
  }

  const pagos = complemento ? findKey(complemento,
    "pago20:Pagos", "pago10:Pagos", "Pagos"
  ) : null;

  let montoTotalPagos = 0;
  let fechaPago = "";
  let formaPagoP = "";
  let monedaP = "";
  let tipoCambioP = "";
  let montoP = "";

  if (pagos) {
    const totales = findKey(pagos,
      "pago20:Totales", "pago10:Totales", "Totales"
    ) || {};
    montoTotalPagos = parseFloat(totales["@_MontoTotalPagos"] || "0");

    const pagosList = safeArray(findKey(pagos,
      "pago20:Pago", "pago10:Pago", "Pago"
    ));
    if (pagosList.length > 0) {
      const firstPago = pagosList[0];
      fechaPago = firstPago["@_FechaPago"] || "";
      formaPagoP = firstPago["@_FormaDePagoP"] || "";
      monedaP = firstPago["@_MonedaP"] || "";
      tipoCambioP = firstPago["@_TipoCambioP"] || "";
      montoP = firstPago["@_Monto"] || "";
    }
  }

  return {
    archivo: filePath,
    version: comprobante["@_Version"] || "",
    tipo: "P",
    metodo: comprobante["@_MetodoPago"] || "",
    formaPago: formaPagoP,
    usoCFDI: receptor["@_UsoCFDI"] || "",
    uuid: tfdUUID,
    folio: "",
    serie: "",
    fecha: fechaPago,
    rfcEmisor: emisor["@_Rfc"] || "",
    nombreEmisor: emisor["@_Nombre"] || "",
    rfcReceptor: receptor["@_Rfc"] || "",
    nombreReceptor: receptor["@_Nombre"] || "",
    descripcion: "Complemento de Pago",
    regimen: emisor["@_RegimenFiscal"] || "",
    subtotal: montoTotalPagos,
    descuento: 0,
    subtotalReal: montoTotalPagos,
    baseIVA16: 0, iva16: 0,
    baseIVA8: 0, iva8: 0,
    iva0Base: 0,
    exentoBase: 0,
    baseIEPS: 0, ieps: 0,
    importeRetIva: 0,
    importeRetISR: 0,
    total: montoTotalPagos,
    moneda: comprobante["@_Moneda"] || "",
    tipoCambio: comprobante["@_TipoCambio"] || "",
    exportacion: comprobante["@_Exportacion"] || "",
    lugarExpedicion: comprobante["@_LugarExpedicion"] || "",
    tipo2: "",
    poliza: "",
    observaciones: "",
    comFechaPago: fechaPago,
    compFormaPago: formaPagoP,
    cfdiRelEg: "",
    tipoRelacion: "",
    cfdiRelPag: "",
    cp: receptor["@_DomicilioFiscalReceptor"] || receptor["@_CP"] || "",
    monedaP,
    montoP,
    tipoCambioP,
    numParcialidad: "",
    impSaldoAnt: 0,
    impPagado: 0,
    impSaldoInsoluto: 0,
    monedaDR: "",
    objetoImpDR: "",
    equivalenciaDR: "",
  };
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
        if (rows && rows.length > 0 && rows[0]) valid.push(...rows);
        else invalid.push(entry.name);
      }
    }
  }

  walk(folderPath);
  return { valid, invalid };
}

function parseCFDIPagos(filePath) {
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
    if (tipo !== "P") return null;
    return parsePagoCFDI(comprobante, filePath);
  } catch {
    return null;
  }
}

function parseFolderPagos(folderPath) {
  const valid = [];
  const invalid = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".xml")) {
        const rows = parseCFDIPagos(fullPath);
        if (rows && rows.length > 0 && rows[0]) valid.push(...rows);
        else invalid.push(entry.name);
      }
    }
  }

  walk(folderPath);
  return { valid, invalid };
}

// ─── Excel generation ──────────────────────────────────────────────

const EXCEL_HEADERS = [
  "Archivo", "Version", "Tipo", "MetodoPago", "FormaPago", "UsoCFDI", "UUID",
  "Folio", "Serie", "Fecha", "RFCEmisor", "NombreEmisor", "RFCReceptor",
  "NombreReceptor", "Descripcion", "RegimenFiscal", "SubTotal", "Descuento",
  "Subtotal Real", "BaseIVA16", "IVA16", "BaseIVA8", "IVA8", "IVA0",
  "BaseExento", "BaseIEPS", "IEPS", "ImporteRetIVA", "ImporteRetISR",
  "Total", "Moneda", "TipoCambio", "Exportacion", "LugarExpedicion",
  "Tipo2", "Poliza", "Observaciones", "Com_FechaPago", "Comp_FormaPago",
  "CFDIRel_Eg", "TipoRelacion", "CFDIRel_Pag", "CP", "MonedaP", "TipoCambioP",
  "MontoP", "NumParcialidad", "ImpSaldoAnt", "ImpPagado", "ImpSaldoInsoluto",
  "MonedaDR", "ObjetoImpDR", "EquivalenciaDR",
];

function rowValues(r) {
  return [
    r.archivo, r.version, r.tipo, r.metodo, r.formaPago, r.usoCFDI, r.uuid,
    r.folio, r.serie, r.fecha, r.rfcEmisor, r.nombreEmisor, r.rfcReceptor,
    r.nombreReceptor, r.descripcion, r.regimen, r.subtotal, r.descuento,
    r.subtotalReal,
    r.baseIVA16, r.iva16, r.baseIVA8, r.iva8, r.iva0Base,
    r.exentoBase, r.baseIEPS, r.ieps,
    r.importeRetIva, r.importeRetISR,
    r.total, r.moneda, r.tipoCambio, r.exportacion, r.lugarExpedicion,
    r.tipo2, r.poliza, r.observaciones, r.comFechaPago, r.compFormaPago,
    r.cfdiRelEg, r.tipoRelacion, r.cfdiRelPag, r.cp, r.monedaP, r.tipoCambioP,
    r.montoP, r.numParcialidad, r.impSaldoAnt, r.impPagado, r.impSaldoInsoluto,
    r.monedaDR, r.objetoImpDR, r.equivalenciaDR,
  ];
}

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
    ws.addRow(rowValues(r));
  }

  ws.columns.forEach((col, i) => {
    let maxLen = EXCEL_HEADERS[i].length;
    for (const r of rows) {
      const vals = rowValues(r);
      const val = String(vals[i] || "");
      maxLen = Math.max(maxLen, val.length);
    }
    col.width = Math.min(maxLen + 3, 50);
  });

  const moneyColumns = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 46, 48, 49, 50];
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

module.exports = { parseCFDI, parseFolder, parseFolderPagos, generateExcel, findKey, safeArray };
