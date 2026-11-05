'use client';
import Link from 'next/link';
import { PaginaLegal } from '@/components/PaginaLegal';

/** Términos y condiciones de la carta QR, el delivery y el pago en línea. */
export default function PaginaTerminos() {
  return (
    <PaginaLegal titulo="Términos y condiciones" actualizado="noviembre de 2026">
      {(p) => (
        <>
          <p>Estos términos se aplican cuando pides desde la carta QR de la mesa, por delivery o pagas en línea en {p.razonSocial}.</p>
          <h2>Pedidos desde la carta QR</h2>
          <ul>
            <li>Tu pedido llega a la tablet del mozo, que lo confirma antes de enviarlo a cocina.</li>
            <li>Los precios incluyen IGV. Las bolsas plásticas pagan el impuesto ICBPER que fija la ley.</li>
            <li>Si un producto se agota mientras pides, te avisamos y puedes elegir otra opción.</li>
          </ul>
          <h2>Pago en línea</h2>
          <ul>
            <li>Al iniciar el pago, la cuenta de la mesa queda reservada hasta por 10 minutos para que nadie la cobre dos veces.</li>
            <li>El pago lo procesa la pasarela; recibirás tu boleta electrónica en el celular cuando se apruebe.</li>
            <li>Si se te cobró y no recibiste tu comprobante, avísale al mozo o a la caja con el número de operación.</li>
          </ul>
          <h2>Delivery</h2>
          <ul>
            <li>El precio de algunos productos en delivery puede ser distinto al del salón; se muestra antes de confirmar.</li>
            <li>Si no te encontramos en la dirección, intentaremos llamarte; el pedido puede no ser reembolsable si ya se preparó.</li>
          </ul>
          <h2>Comprobantes</h2>
          <p>Emitimos boleta o factura electrónica por cada pago. Las anulaciones se hacen con nota de crédito, como exige SUNAT.</p>
          <h2>Reclamos</h2>
          <p>
            Tenemos un{' '}
            <Link className="text-blue-700 underline" href="/reclamaciones">
              Libro de Reclamaciones virtual
            </Link>
            . Respondemos en un plazo máximo de 15 días hábiles. Tus datos se tratan según nuestra{' '}
            <Link className="text-blue-700 underline" href="/privacidad">
              política de privacidad
            </Link>
            .
          </p>
        </>
      )}
    </PaginaLegal>
  );
}
