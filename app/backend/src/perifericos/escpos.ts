// Construcción de tickets para impresoras térmicas de 80 mm (comandos ESC/POS).
// El mismo ticket se guarda como líneas legibles (para la impresora virtual) y se
// convierte a bytes ESC/POS cuando hay una ticketera real configurada por IP.

export interface LineaTicket {
  t: string; // texto
  b?: boolean; // negrita
  g?: boolean; // doble alto y ancho
  c?: boolean; // centrado
}

export const ANCHO = 42; // caracteres por línea en papel de 80 mm con fuente A

export class Ticket {
  readonly lineas: LineaTicket[] = [];

  texto(t: string, f: Omit<LineaTicket, 't'> = {}) {
    // Las líneas grandes ocupan el doble de ancho
    const max = f.g ? ANCHO / 2 : ANCHO;
    for (const parte of partir(t, max)) this.lineas.push({ t: parte, ...f });
    return this;
  }
  titulo(t: string) {
    return this.texto(t, { g: true, b: true, c: true });
  }
  centro(t: string, b = false) {
    return this.texto(t, { c: true, b });
  }
  separador(ch = '-') {
    this.lineas.push({ t: ch.repeat(ANCHO) });
    return this;
  }
  par(izq: string, der: string, b = false) {
    const espacio = Math.max(1, ANCHO - izq.length - der.length);
    if (izq.length + der.length + 1 > ANCHO) {
      this.texto(izq, { b });
      this.lineas.push({ t: ' '.repeat(Math.max(0, ANCHO - der.length)) + der, b });
    } else this.lineas.push({ t: izq + ' '.repeat(espacio) + der, b });
    return this;
  }
  blanco() {
    this.lineas.push({ t: '' });
    return this;
  }
}

function partir(t: string, max: number) {
  const out: string[] = [];
  for (const linea of t.split('\n')) {
    let resto = linea;
    while (resto.length > max) {
      let corte = resto.lastIndexOf(' ', max);
      if (corte <= 0) corte = max;
      out.push(resto.slice(0, corte));
      resto = resto.slice(corte).trimStart();
    }
    out.push(resto);
  }
  return out;
}

const ESC = 0x1b;
const GS = 0x1d;

/** Las ticketeras usan páginas de código de 1 byte: se quitan tildes para evitar símbolos raros. */
const ascii = (t: string) =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ñ]/g, 'n')
    .replace(/[Ñ]/g, 'N')
    .replace(/[^\x20-\x7e]/g, '?');

/**
 * Bytes ESC/POS: inicializar, cada línea con su formato, avance, corte parcial.
 * pitidos: buzzer de la ticketera (ESC B n t, compatible con Epson TM y la mayoría de clones).
 * gaveta: pulso al conector RJ11 de la gaveta (ESC p 0 25 250).
 */
export function aEscPos(lineas: LineaTicket[], opciones: { pitidos?: number; gaveta?: boolean; cortar?: boolean } = {}) {
  const b: number[] = [ESC, 0x40]; // ESC @ inicializar
  for (const l of lineas) {
    b.push(ESC, 0x61, l.c ? 1 : 0); // alineación
    b.push(ESC, 0x45, l.b ? 1 : 0); // negrita
    b.push(GS, 0x21, l.g ? 0x11 : 0x00); // tamaño
    b.push(...Buffer.from(ascii(l.t) + '\n', 'latin1'));
  }
  b.push(GS, 0x21, 0, ESC, 0x45, 0, ESC, 0x61, 0);
  if (lineas.length && opciones.cortar !== false) b.push(ESC, 0x64, 4, GS, 0x56, 66, 0); // avanzar y cortar
  if (opciones.pitidos) b.push(ESC, 0x42, Math.min(9, opciones.pitidos), 2);
  if (opciones.gaveta) b.push(ESC, 0x70, 0, 25, 250);
  return Buffer.from(b);
}
