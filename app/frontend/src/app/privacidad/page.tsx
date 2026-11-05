'use client';
import Link from 'next/link';
import { PaginaLegal } from '@/components/PaginaLegal';

/** Política de privacidad (Ley 29733, Ley de Protección de Datos Personales, y su reglamento). */
export default function PaginaPrivacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad" actualizado="noviembre de 2026">
      {(p) => (
        <>
          <p>
            {p.razonSocial} ({p.direccion}) es responsable del tratamiento de los datos personales que nos das al pedir, pagar o registrar un reclamo. Los tratamos según la Ley N.° 29733, Ley de Protección de Datos Personales, y su reglamento.
          </p>
          <h2>Qué datos recogemos y para qué</h2>
          <ul>
            <li>
              <b>Delivery:</b> nombre, celular y dirección, para preparar y entregar tu pedido y avisarte por WhatsApp cuando salga.
            </li>
            <li>
              <b>Comprobantes:</b> DNI o RUC y nombre o razón social, porque SUNAT los exige en facturas y en boletas mayores a S/ 700.
            </li>
            <li>
              <b>Envío del comprobante:</b> tu celular, solo si pides recibirlo por WhatsApp.
            </li>
            <li>
              <b>Libro de Reclamaciones:</b> los datos de la hoja, para atender tu reclamo dentro del plazo legal.
            </li>
            <li>
              <b>Pago en línea:</b> no guardamos los datos de tu tarjeta ni tu código de Yape o Plin; los procesa directamente la pasarela de pagos. Solo guardamos el número de la transacción.
            </li>
          </ul>
          <h2>Con quién los compartimos</h2>
          <p>Solo con quien es necesario: SUNAT y nuestro proveedor de facturación electrónica (comprobantes), la pasarela de pagos (pago en línea) y WhatsApp (mensajes que pediste). No vendemos ni cedemos tus datos.</p>
          <h2>Cuánto tiempo los guardamos</h2>
          <p>Los datos de los comprobantes, el tiempo que exigen las normas tributarias. Los de delivery, mientras sigas pidiendo; puedes pedir que los borremos. Las hojas de reclamación, al menos dos años desde su registro.</p>
          <h2>Tus derechos</h2>
          <p>
            Puedes pedir acceder a tus datos, corregirlos, cancelarlos u oponerte a su uso (derechos ARCO) en el local o por el{' '}
            <Link className="text-blue-700 underline" href="/reclamaciones">
              Libro de Reclamaciones
            </Link>
            . Si no te respondemos, puedes acudir a la Autoridad Nacional de Protección de Datos Personales del Ministerio de Justicia.
          </p>
          <h2>Seguridad</h2>
          <p>El acceso del personal es con PIN personal y cada acción sensible queda registrada en una bitácora que no se puede modificar. Las conexiones con la pasarela, SUNAT y la nube van cifradas.</p>
        </>
      )}
    </PaginaLegal>
  );
}
