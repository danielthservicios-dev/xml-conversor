import xml.etree.ElementTree as ET
import os
from typing import List

NS_COMMON = {
    "cfdi33": "http://www.sat.gob.mx/cfd/3",
    "cfdi40": "http://www.sat.gob.mx/cfd/4",
    "tfd": "http://www.sat.gob.mx/TimbreFiscalDigital",
}

IMPIVA = "002"
IMPIEPS = "003"


class CFDIRow:
    def __init__(self):
        self.rfc_emisor = ""
        self.nombre_emisor = ""
        self.rfc_receptor = ""
        self.nombre_receptor = ""
        self.uuid = ""
        self.serie = ""
        self.folio = ""
        self.fecha = ""
        self.subtotal = 0.0
        self.iva = 0.0
        self.ieps = 0.0
        self.total = 0.0
        self.forma_pago = ""
        self.metodo_pago = ""
        self.uso_cfdi = ""
        self.status = ""
        self.moneda = ""
        self.tipo_comprobante = ""

    def to_dict(self):
        return {
            "RFC Emisor": self.rfc_emisor,
            "Nombre Emisor": self.nombre_emisor,
            "RFC Receptor": self.rfc_receptor,
            "Nombre Receptor": self.nombre_receptor,
            "UUID": self.uuid,
            "Serie": self.serie,
            "Folio": self.folio,
            "Fecha": self.fecha,
            "Subtotal": self.subtotal,
            "IVA": self.iva,
            "IEPS": self.ieps,
            "Total": self.total,
            "FormaPago": self.forma_pago,
            "MetodoPago": self.metodo_pago,
            "UsoCFDI": self.uso_cfdi,
            "Status": self.status,
            "Moneda": self.moneda,
            "TipoComprobante": self.tipo_comprobante,
        }


def _detect_ns(root: ET.Element) -> str:
    tag = root.tag
    if "}" in tag:
        return tag.split("}")[0].lstrip("{")
    return ""


def _text_or_attr(element, attr):
    if element is not None:
        return element.get(attr, "")
    return ""


def _build_ns_map(root_ns: str):
    nsmap = {}
    if "cfdi33" in root_ns or "/3" in root_ns:
        nsmap["cfdi"] = "http://www.sat.gob.mx/cfd/3"
    else:
        nsmap["cfdi"] = "http://www.sat.gob.mx/cfd/4"
    nsmap["tfd"] = "http://www.sat.gob.mx/TimbreFiscalDigital"
    return nsmap


def parse_xml(filepath: str) -> CFDIRow:
    row = CFDIRow()
    try:
        tree = ET.parse(filepath)
        root = tree.getroot()
    except ET.ParseError:
        return row

    root_ns = _detect_ns(root)
    ns = _build_ns_map(root_ns)
    ns_cfdi = ns["cfdi"]

    row.rfc_emisor = _text_or_attr(root.find(f"{{{ns_cfdi}}}Emisor"), "Rfc")
    row.nombre_emisor = _text_or_attr(root.find(f"{{{ns_cfdi}}}Emisor"), "Nombre")
    row.rfc_receptor = _text_or_attr(root.find(f"{{{ns_cfdi}}}Receptor"), "Rfc")
    row.nombre_receptor = _text_or_attr(root.find(f"{{{ns_cfdi}}}Receptor"), "Nombre")

    row.serie = root.get("Serie", "")
    row.folio = root.get("Folio", "")
    row.fecha = root.get("Fecha", "")
    row.subtotal = _float(root.get("SubTotal", "0"))
    row.total = _float(root.get("Total", "0"))
    row.forma_pago = root.get("FormaPago", "")
    row.metodo_pago = root.get("MetodoPago", "")
    row.moneda = root.get("Moneda", "")
    row.tipo_comprobante = root.get("TipoDeComprobante", "")

    uso_cfdi_el = root.find(f"{{{ns_cfdi}}}Receptor")
    if uso_cfdi_el is not None:
        row.uso_cfdi = uso_cfdi_el.get("UsoCFDI", "")

    impuestos = root.find(f"{{{ns_cfdi}}}Impuestos")
    if impuestos is not None:
        traslados = impuestos.find(f"{{{ns_cfdi}}}Traslados")
        if traslados is not None:
            for traslado in traslados.findall(f"{{{ns_cfdi}}}Traslado"):
                impuesto = traslado.get("Impuesto", "")
                importe = _float(traslado.get("Importe", "0"))
                if impuesto == IMPIVA:
                    row.iva += importe
                elif impuesto == IMPIEPS:
                    row.ieps += importe

    complemento = root.find(f"{{{ns_cfdi}}}Complemento")
    if complemento is not None:
        for elem in complemento.iter():
            if "TimbreFiscalDigital" in elem.tag:
                row.uuid = elem.get("UUID", "")
                break

    row.status = root.get("Status", "")

    return row


def _float(val: str) -> float:
    try:
        return float(val)
    except ValueError:
        return 0.0


def parse_folder(folder_path: str) -> List[CFDIRow]:
    results = []
    for fname in sorted(os.listdir(folder_path)):
        if not fname.lower().endswith(".xml"):
            continue
        fpath = os.path.join(folder_path, fname)
        if os.path.isfile(fpath):
            row = parse_xml(fpath)
            results.append(row)
    return results
