// Comprobante de pago electrónico (CPE): datos comunes, XML UBL 2.1 y validaciones de SUNAT.
import { createHash } from 'crypto';

export type TipoCpe = 'BOLETA' | 'FACTURA' | 'NOTA_CREDITO';

export interface LineaCpe {
  descripcion: string;
  cantidad: number;
  importe: number; // con impuestos, en soles
  base: number; // sin impuestos
  impuesto: number;
}

export interface DocumentoCpe {
  tipo: TipoCpe;
  serie: string;
  correlativo: number;
  emitidoEn: Date;
  emisor: { ruc: string; razonSocial: string; direccion: string };
  cliente: { tipoDocumento: '0' | '1' | '6'; numero: string; nombre: string };
  lineas: LineaCpe[];
  descuentoBase: number;
  base: number;
  impuesto: number;
  icbper: number;
  bolsas: number;
  total: number;
  tasa: number;
  referencia?: { tipo: TipoCpe; serie: string; correlativo: number } | null;
  motivo?: string | null;
}

/** Código de tipo de documento del catálogo 01 de SUNAT. */
export const CODIGO_TIPO: Record<TipoCpe, string> = { FACTURA: '01', BOLETA: '03', NOTA_CREDITO: '07' };
export const NOMBRE_TIPO: Record<TipoCpe, string> = { FACTURA: 'Factura', BOLETA: 'Boleta', NOTA_CREDITO: 'Nota de Credito' };

/** Dígito verificador del RUC (módulo 11), la misma validación que hace SUNAT. */
export function rucValido(ruc: string) {
  if (!/^(10|15|17|20)[0-9]{9}$/.test(ruc)) return false;
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const suma = pesos.reduce((s, p, i) => s + p * Number(ruc[i]), 0);
  const r = 11 - (suma % 11);
  return (r === 10 ? 0 : r === 11 ? 1 : r) === Number(ruc[10]);
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const m = (v: number) => v.toFixed(2);

/**
 * XML UBL 2.1 del comprobante (estructura de SUNAT para boleta, factura y nota de crédito).
 * La firma digital (ext:UBLExtensions) la agrega el OSE con el certificado del emisor.
 */
export function xmlUbl(d: DocumentoCpe) {
  const nc = d.tipo === 'NOTA_CREDITO';
  const raiz = nc ? 'CreditNote' : 'Invoice';
  const ns = nc ? 'urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2' : 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2';
  const fecha = d.emitidoEn.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const hora = d.emitidoEn.toLocaleTimeString('en-GB', { timeZone: 'America/Lima', hour12: false });
  const id = `${d.serie}-${d.correlativo}`;
  const lineaBase = d.lineas.reduce((s, l) => s + l.base, 0);
  const impuesto = (monto: number, base: number, codigo: string, nombre: string, tipo: string, extra = '') => `
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="PEN">${m(base)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="PEN">${m(monto)}</cbc:TaxAmount>${extra}
      <cac:TaxCategory><cac:TaxScheme><cbc:ID>${codigo}</cbc:ID><cbc:Name>${nombre}</cbc:Name><cbc:TaxTypeCode>${tipo}</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>`;
  const lineas = d.lineas
    .map(
      (l, i) => `
  <cac:${nc ? 'CreditNoteLine' : 'InvoiceLine'}>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:${nc ? 'CreditedQuantity' : 'InvoicedQuantity'} unitCode="NIU">${l.cantidad}</cbc:${nc ? 'CreditedQuantity' : 'InvoicedQuantity'}>
    <cbc:LineExtensionAmount currencyID="PEN">${m(l.base)}</cbc:LineExtensionAmount>
    <cac:PricingReference><cac:AlternativeConditionPrice><cbc:PriceAmount currencyID="PEN">${m(l.importe / l.cantidad)}</cbc:PriceAmount><cbc:PriceTypeCode>01</cbc:PriceTypeCode></cac:AlternativeConditionPrice></cac:PricingReference>
    <cac:TaxTotal><cbc:TaxAmount currencyID="PEN">${m(l.impuesto)}</cbc:TaxAmount>${impuesto(l.impuesto, l.base, '1000', 'IGV', 'VAT', `\n      <cbc:Percent>${(d.tasa * 100).toFixed(2)}</cbc:Percent>`)}
    </cac:TaxTotal>
    <cac:Item><cbc:Description>${esc(l.descripcion)}</cbc:Description></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="PEN">${m(l.base / l.cantidad)}</cbc:PriceAmount></cac:Price>
  </cac:${nc ? 'CreditNoteLine' : 'InvoiceLine'}>`,
    )
    .join('');
  const referencia = d.referencia
    ? `
  <cac:DiscrepancyResponse><cbc:ReferenceID>${d.referencia.serie}-${d.referencia.correlativo}</cbc:ReferenceID><cbc:ResponseCode>01</cbc:ResponseCode><cbc:Description>${esc(d.motivo ?? 'Anulación de la operación')}</cbc:Description></cac:DiscrepancyResponse>
  <cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>${d.referencia.serie}-${d.referencia.correlativo}</cbc:ID><cbc:DocumentTypeCode>${CODIGO_TIPO[d.referencia.tipo]}</cbc:DocumentTypeCode></cac:InvoiceDocumentReference></cac:BillingReference>`
    : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<${raiz} xmlns="${ns}" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>${id}</cbc:ID>
  <cbc:IssueDate>${fecha}</cbc:IssueDate>
  <cbc:IssueTime>${hora}</cbc:IssueTime>${nc ? '' : `\n  <cbc:InvoiceTypeCode listID="0101">${CODIGO_TIPO[d.tipo]}</cbc:InvoiceTypeCode>`}
  <cbc:DocumentCurrencyCode>PEN</cbc:DocumentCurrencyCode>${referencia}
  <cac:AccountingSupplierParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="6">${d.emisor.ruc}</cbc:ID></cac:PartyIdentification>
    <cac:PartyLegalEntity><cbc:RegistrationName>${esc(d.emisor.razonSocial)}</cbc:RegistrationName><cac:RegistrationAddress><cbc:AddressTypeCode>0000</cbc:AddressTypeCode><cac:AddressLine><cbc:Line>${esc(d.emisor.direccion)}</cbc:Line></cac:AddressLine></cac:RegistrationAddress></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="${d.cliente.tipoDocumento}">${esc(d.cliente.numero)}</cbc:ID></cac:PartyIdentification>
    <cac:PartyLegalEntity><cbc:RegistrationName>${esc(d.cliente.nombre)}</cbc:RegistrationName></cac:PartyLegalEntity>
  </cac:Party></cac:AccountingCustomerParty>${
    d.descuentoBase > 0
      ? `
  <cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReasonCode>02</cbc:AllowanceChargeReasonCode><cbc:Amount currencyID="PEN">${m(d.descuentoBase)}</cbc:Amount><cbc:BaseAmount currencyID="PEN">${m(lineaBase)}</cbc:BaseAmount></cac:AllowanceCharge>`
      : ''
  }
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="PEN">${m(d.impuesto + d.icbper)}</cbc:TaxAmount>${impuesto(d.impuesto, d.base, '1000', 'IGV', 'VAT')}${
      d.icbper > 0 ? impuesto(d.icbper, 0, '7152', 'ICBPER', 'OTH', `\n      <cbc:BaseUnitMeasure unitCode="NIU">${d.bolsas}</cbc:BaseUnitMeasure>`) : ''
    }
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="PEN">${m(lineaBase)}</cbc:LineExtensionAmount>
    <cbc:TaxInclusiveAmount currencyID="PEN">${m(d.total)}</cbc:TaxInclusiveAmount>${d.descuentoBase > 0 ? `\n    <cbc:AllowanceTotalAmount currencyID="PEN">${m(d.descuentoBase)}</cbc:AllowanceTotalAmount>` : ''}
    <cbc:PayableAmount currencyID="PEN">${m(d.total)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lineas}
</${raiz}>
`;
}

/** Resumen (DigestValue) del XML: SHA-256 en Base64, como el que se imprime en la representación impresa. */
export const hashXml = (xml: string) => createHash('sha256').update(xml, 'utf8').digest('base64');
