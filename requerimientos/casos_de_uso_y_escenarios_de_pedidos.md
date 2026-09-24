# Matriz Integral de Casos de Uso y Escenarios Reales de Pedidos
## Sistema de Gestión para Pollerías y Restaurantes de Brasas en el Perú

**Proyecto:** Modernización Tecnológica de Pollería (Piso Único)  
**Contexto Cultural:** Análisis de Dominio y Hábitos Gastronómicos del Consumidor Peruano  
**Objetivo:** Documentar y validar cómo el sistema de software responde ante cada variante, maña, contingencia y combinación de pedidos reales en salón, mostrador y delivery.

---

## 1. Introducción y Enfoque de Ingeniería

En el mercado gastronómico peruano, una pollería no funciona como una cadena estandarizada rígida. El cliente peruano exige personalización constante: pide cambios de presas, reemplazo de guarniciones, combinaciones de salsas y modalidades de pago variadas.

Este documento consolida **todos los escenarios posibles de pedidos**, auditando la respuesta técnica y operativa del software para garantizar que no existan cuellos de botella ni fugas de dinero.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAPA GENERAL DE CASOS DE PEDIDOS EN PERÚ                        │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. CORTES Y FRACCIONAMIENTO     2. MAÑAS Y MODIFICADORES     3. CANALES DE VENTA       │
│ - 1/8 Pollo (Menú económico)    - Cambiar ensalada x papas   - Salón (Consumo en vivo) │
│ - 1/4 Pecho vs. Pierna          - Papas bien doradas/sin sal - Mostrador Takeout       │
│ - 1/2 Pollo (Mixto o Pechos)    - Guerra del Ají Pollero     - Delivery Propio (Vuelto)│
│ - Pollo Entero (4 u 8 presas)   - Vinagreta aparte           - Pick & Collect (Prog.)  │
│ - El "Mostrito" (Con Chaufa)    - Pollo sin pellejo          - Apps (PedidosYa/Rappi)  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. DINÁMICAS DE PAGO            5. CONTINGENCIAS Y RECLAMOS                            │
│ - Cuentas separadas (Split Bill)- Cambio de presa a último segundo                     │
│ - Factura con RUC (Empresas)    - Plato devuelto (Pollo crudo/quemado -> Merma)        │
│ - Pago Mixto (Efectivo + Yape)  - El "Perro Muerto" (Fuga sin pagar -> Auditoría)      │
│ - Fusión / Transferencia mesas  - Delivery cancelado en puerta                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Categoría 1: Por Fraccionamiento y Cortes de Pollo

### Caso 1.1: El 1/8 de Pollo (El "Menú Pollero" / Almuerzo Rápido)
* **Descripción del Escenario:** Cliente individual (oficinista, estudiante o trabajador) al mediodía que busca un almuerzo accesible. Solicita 1/8 de pollo + porción de papas + ensalada fresca + vaso de chicha morada.
* **Comportamiento del Sistema:**
  * En el catálogo, el ítem descuenta exactamente `0.125` de unidad de pollo entero del inventario.
  * La comanda enviada a la ticketera del pollero especifica: `1x 1/8 POLLO + PAPAS + ENSALADA`.
  * Si incluye bebida de menú, el sistema genera la orden en caja/barra sin costo adicional.

### Caso 1.2: El 1/4 de Pollo (La Disputa: Pecho vs. Pierna)
* **Descripción del Escenario:** El pedido más vendido del Perú. El comensal define obligatoriamente su preferencia:
  * *Pecho con ala:* Mayor volumen de carne blanca, menor tenor graso.
  * *Pierna con encuentro (muslo):* Carne oscura, jugosa y piel crocante.
* **Comportamiento del Sistema:**
  * **Modificador Obligatorio:** La interfaz (tablet o QR) no permite continuar sin marcar *"Pecho"* o *"Pierna"*.
  * **Control de Stock Desbalanceado:** El inventario mantiene contadores independientes para pechos y piernas. Si se detecta que las piernas están a punto de agotarse (ej. quedan 3 piernas y 14 pechos), el sistema deshabilita la opción pierna en el QR y notifica a las tablets de los meseros para que sugieran pechuga jugosa.

### Caso 1.3: El 1/2 Pollo (Estándar vs. "Puro Pecho")
* **Descripción del Escenario:** Dos personas comparten 1/2 pollo. La combinación estándar es 1 Pecho + 1 Pierna. Sin embargo, el cliente puede exigir: *"Quiero 1/2 pollo pero que sean 2 pechos"*.
* **Comportamiento del Sistema:**
  * El sistema permite seleccionar la combinación:
    * `[Opción 1]` Tradicional: 1 Pecho + 1 Pierna (Precio estándar).
    * `[Opción 2]` Especial: 2 Pechos (Aplica recargo configurable de S/. 2.00 por mayor costo cárnico y descuenta 2 pechos del kardex).
    * `[Opción 3]` Especial: 2 Piernas (Descuenta 2 piernas del inventario).

### Caso 1.4: Pollo Entero con Trozado Especial (4 u 8 Presas)
* **Descripción del Escenario:** Una familia compra 1 Pollo a la Brasa en salón o para llevar. La madre solicita: *"Por favor, córtelo en 8 presas pequeñas para que los niños coman fácil"*.
* **Comportamiento del Sistema:**
  * Selector de corte en comanda: `[Corte Estándar: 4 presas]` o `[Corte Niños: 8 presas]`.
  * La ticketera del pollero resalta en negrita: `*** CORTAR EN 8 PRESAS ***`.

### Caso 1.5: El Emblemático "Mostrito" Peruano
* **Descripción del Escenario:** Fusión clásica de barrio donde se sirve 1/4 de pollo a la brasa montado sobre una cama generosa de Arroz Chaufa, acompañado de papas fritas y cremas.
* **Comportamiento del Sistema:**
  * Configurado como producto compuesto (*Combo Dual*):
    * Descuenta del kardex: 0.25 pollo + 1 porción papas + 1 porción arroz chaufa.
    * Envía la orden de pollo a la ticketera del pollero y la notificación de porción de chaufa a la cocina interna si se requiere reabastecimiento.

---

## 3. Categoría 2: Mañas, Modificaciones y Preferencias del Comensal

### Caso 2.1: "Cámbieme la ensalada por más papas fritas"
* **Descripción del Escenario:** Comensales jóvenes que no comen verduras y piden reemplazar la ensalada por una ración adicional de papas fritas.
* **Comportamiento del Sistema:**
  * En la sección de ensaladas existe el modificador: `[ ] Sin ensalada (Cambio por Extra Papas)`.
  * El sistema no descuenta bowl de ensalada del inventario, suma `+100 gramos` al consumo de papas y avisa en el ticket del pollero: `SIN ENSALADA - AUMENTAR PAPAS`.

### Caso 2.2: Puntos de Cocción de las Papas Fritas
* **Descripción del Escenario:**
  * *"Las papas que salgan bien doradas y crocantes"*.
  * *"Papas sin sal por indicación médica/hipertensión"*.
* **Comportamiento del Sistema:**
  * Botones rápidos de selección: `[Bien Doradas]` / `[Papas Sin Sal]` / `[Normales]`.
  * Texto destacado en la comanda del pollero para que tome papas de la tina sin sal antes de salar el lote.

### Caso 2.3: La Guerra de las Cremas y el Ají Pollero
* **Descripción del Escenario:**
  * Clientes que exigen *"bastante ají de la casa"*.
  * Clientes que piden la vinagreta en vaso cerrado aparte.
  * Pedidos para llevar donde el cliente compra potes de crema extra.
* **Comportamiento del Sistema:**
  * **En Salón:** Selector múltiple gratuito (`Ají`, `Mayonesa`, `Mostaza`, `Kétchup`, `Tártara`, `Vinagreta aparte`).
  * **Para Llevar / Delivery:** El sistema incluye el ítem con cobro: `Pote de Ají Especial Extra (S/. 1.50)`.

### Caso 2.4: Modificaciones Especiales ("Pollo sin pellejo")
* **Descripción del Escenario:** Cliente fitness o con prescripción médica que solicita que se le retire la piel antes de servir.
* **Comportamiento del Sistema:**
  * Campo libre de observaciones en comanda: `NOTA: Retirar pellejo al servir`.

---

## 4. Categoría 3: Canales de Venta y Despacho

### Caso 3.1: Salón con Consumo Progresivo (Cuenta Abierta y Re-pedidos)
* **Descripción del Escenario:**
  1. El cliente entra a las 19:30 y pide solo 1/8 de pollo.
  2. A las 19:50 le da sed y pide una Inca Kola personal de 500ml.
  3. A las 20:05 pide una porción adicional de papas al centro para picar.
* **Comportamiento del Sistema:**
  * La mesa permanece en estado `OCUPADA` (cuenta abierta).
  * Cada nuevo pedido se agrega como un sub-bloque con marca de tiempo.
  * No se imprimen de nuevo los ítems anteriores; la ticketera solo imprime el ítem añadido (`Re-orden Mesa 4: +1 Inca Kola Personal`).
  * Al ir a pagar a caja, la cuenta consolida los 3 pedidos en una sola cuenta total sin posibilidad de olvidos.

### Caso 3.2: Para Llevar (Takeout) en Hora Punta con Llamado por Nombre
* **Descripción del Escenario:** Cliente entra con prisa al mostrador de caja a las 21:00. Pide 3/8 para llevar y paga al instante con Yape.
* **Comportamiento del Sistema:**
  * La cajera ingresa: `3/8 Llevar - Nombre: Carlos`.
  * Cobra en el acto con código de aprobación Yape o QR.
  * La ticketera de caja emite la boleta con el rótulo: **Llevar #18 - Carlos**.
  * La ticketera del pollero expulsa: `[PARA LLEVAR #18] - Carlos: 3/8 Pollo (2 Piernas, 1 Pecho) + Táper/Bolsa`.
  * El pollero empaca y anuncia por voz o mediante la pantalla de turnos: *"¡Orden #18, señor Carlos!"*.

### Caso 3.3: Delivery Propio con "Paga con Billete de S/. 100"
* **Descripción del Escenario:** El cliente pide por WhatsApp un combo de S/. 38.00 y solicita pagar en efectivo en su casa con un billete de S/. 100.
* **Comportamiento del Sistema:**
  * En la pantalla de despacho se ingresa: `Paga con: S/. 100.00`.
  * El software calcula automáticamente: `Vuelto exacto: S/. 62.00`.
  * En la hoja de ruta del motorizado se imprime:  
    `COBRAR: S/. 38.00 | ENTREGAR VUELTO: S/. 62.00`.
  * La cajera entrega los S/. 62.00 al repartidor antes de salir y cuadra el fondo de caja.

### Caso 3.4: Pedido Programado para Recoger Después ("Pick & Collect")
* **Descripción del Escenario:** Un cliente escribe por la web a las 18:00: *"Voy a pasar a las 20:15 a recoger 2 pollos enteros calientes"*.
* **Comportamiento del Sistema:**
  * El pedido ingresa en estado `PROGRAMADO (Hora: 20:15)`.
  * El sistema **no** imprime el ticket a las 18:00 (evitando que el pollo se enfríe 2 horas).
  * Un temporizador en Redis libera la orden automáticamente a las 20:00 (15 minutos antes) para que el pollero lo troce justo a tiempo.

### Caso 3.5: Delivery por Apps Externas (PedidosYa / Rappi)
* **Descripción del Escenario:** Llega una comanda desde la tablet de PedidosYa con el código `#PY-9421`.
* **Comportamiento del Sistema:**
  * La orden se registra con medio de pago `Plataforma Externa (Pre-pagado)`.
  * Se genera ticket para el pollero con el código `#PY-9421`.
  * Al llegar el repartidor de la app, solo dicta el código alfanumérico para retirar el paquete sin transacciones de dinero en caja.

---

## 5. Categoría 4: Dinámicas de Pago y Facturación Fiscal

### Caso 4.1: División de Cuenta entre Amigos ("Split Bill")
* **Descripción del Escenario:** 4 compañeros de oficina consumen juntos en la Mesa 6 (Total: S/. 80.00). Al pagar en caja piden: *"Cóbranos por separado, cada uno S/. 20.00: dos pagan con Yape, uno con tarjeta y uno en efectivo, y emítenos boletas separadas con DNI"*.
* **Comportamiento del Sistema:**
  * En el módulo de cobro se pulsa *"Dividir Cuenta"*.
  * Se generan 4 sub-pagos de S/. 20.00 cada uno.
  * La cajera ingresa el DNI de cada persona y cobra con el método correspondiente.
  * Se emiten 4 Boletas Electrónicas independientes ante SUNAT vía Nubefact y la mesa pasa a estado `LIBRE`.

### Caso 4.2: Factura Electrónica con RUC para Empresas
* **Descripción del Escenario:** Almuerzo de negocios donde se requiere Factura comercial para deducir gastos tributarios.
* **Comportamiento del Sistema:**
  * La cajera selecciona `Comprobante: Factura` e ingresa el RUC (11 dígitos).
  * La API de ApisPeru consulta la base de datos de SUNAT en 0.2 segundos y llena automáticamente: Razón Social, Dirección Fiscal y Estado (Activo/Habido).
  * Se envía el payload JSON a Nubefact, generando el comprobante fiscal legal.

### Caso 4.3: Pago Mixto en la Misma Transacción
* **Descripción del Escenario:** Cuenta de S/. 45.00. El cliente dice: *"Tengo S/. 15 en efectivo en monedas y los S/. 30 restantes te los transfiero por Yape"*.
* **Comportamiento del Sistema:**
  * La pantalla de cobro permite agregar múltiples líneas de pago:
    * `Línea 1:` Efectivo (S/. 15.00).
    * `Línea 2:` Yape / Billetera Digital (S/. 30.00).
  * Saldo pendiente: S/. 0.00 ➔ Habilita el botón de emisión del ticket.

### Caso 4.4: Cambio o Fusión de Mesas en Salón
* **Descripción del Escenario:**
  * *Cambio:* Una pareja sentada en la Mesa 2 se cambia a la Mesa 7 porque está cerca de la ventana.
  * *Fusión:* Una familia en la Mesa 4 recibe más invitados y junta la Mesa 5.
* **Comportamiento del Sistema:**
  * La tablet del mesero permite:
    * `Transferir Mesa:` Mueve toda la comanda activa de Mesa 2 a Mesa 7 en 1 clic.
    * `Fusionar Mesas:` Une las cuentas de Mesa 4 y 5 en una sola cuenta maestra.

---

## 6. Categoría 5: Contingencias, Reclamos y Excepciones Críticas

### Caso 5.1: Cambio de Presa a Último Segundo
* **Descripción del Escenario:** El cliente pidió 1/4 pierna, pero a los 30 segundos rectifica: *"Joven, perdón, que sea pechuga"*.
* **Comportamiento del Sistema:**
  * El mesero edita la orden en su tablet antes de que el pollero corte.
  * La ticketera del pollero emite una alerta acústica y expulsa un ticket rojo/destacado:  
    `*** CORRECCIÓN MESA 3: ANULA PIERNA -> CAMBIA A PECHO ***`.

### Caso 5.2: Plato Devuelto por Inconformidad (Pollo Crudo o Sobrecocido)
* **Descripción del Escenario:** El cliente corta el pollo y encuentra sangre en el hueso o piel quemada. Exige cambio de presa.
* **Comportamiento del Sistema:**
  * El mesero utiliza la opción `Reposición por Reclamo`.
  * La ticketera del pollero expulsa: `REPOSICIÓN MESA 5: 1/4 Pecho Urgente`.
  * **Cero costo para el cliente:** No se altera la cuenta por cobrar.
  * **Control de Kardex:** La presa devuelta se registra automáticamente en el módulo de **Mermas de Producción (RF-15)** con el motivo *"Falla de cocción"*, permitiendo que el arqueo de pollos cuadre al final de la noche.

### Caso 5.3: El "Perro Muerto" (Fuga de Comensal sin Pagar)
* **Descripción del Escenario:** Una mesa se levanta con disimulo y escapa del local sin pagar la cuenta de S/. 55.00.
* **Comportamiento del Sistema:**
  * El mesero tiene **bloqueada** la anulación directa (para evitar robos del personal).
  * El Administrador ingresa su PIN maestro y selecciona: `Anular Comanda por Fuga / Pérdida`.
  * El sistema registra el incidente en la bitácora de auditoría, desocupa la mesa y no altera el efectivo esperado en caja.

### Caso 5.4: Delivery Cancelado en Puerta (Dirección Inexistente)
* **Descripción del Escenario:** El motorizado llega a la dirección de entrega y nadie atiende, el celular está apagado o era una broma.
* **Comportamiento del Sistema:**
  * El repartidor marca en su app: `Entrega Fallida / Cliente no responde`.
  * Al retornar a la pollería con el paquete intacto, la cajera registra el reingreso de los insumos o su pase a consumo de personal/merma.

---

## 7. Matriz Resumen de Cobertura Tecnológica

| Escenario Operativo | Requerimiento Funcional (RF) | Componente Responsable | Estado en el Sistema |
| :--- | :---: | :--- | :---: |
| **1/8 de Pollo / Menú** | RF-03 / RF-05 | Catálogo y Modificadores (0.125 insumo) | ✅ Cubierto al 100% |
| **Pecho vs. Pierna** | RF-05 / RF-15 | Modificador Obligatorio y Kardex Dual | ✅ Cubierto al 100% |
| **El "Mostrito"** | RF-03 / RF-15 | Plato Compuesto (Pollo + Chaufa + Papas) | ✅ Cubierto al 100% |
| **Cambio Ensalada x Papas** | RF-05 / RF-15 | Regla de canje y ajuste de gramaje | ✅ Cubierto al 100% |
| **Papas Doradas / Sin Sal** | RF-05 / RF-08 | Campo de notas ESC/POS destacado | ✅ Cubierto al 100% |
| **Guerra del Ají / Cremas** | RF-05 / RF-08 | Selector múltiple y producto extra en carta | ✅ Cubierto al 100% |
| **Consumo Progresivo** | RF-01 / RF-02 | Comanda abierta multi-tiempo en PostgreSQL | ✅ Cubierto al 100% |
| **Takeout con Nombre** | RF-08 / RF-10 | Caja rápida con rotulado `[LLEVAR #XX]` | ✅ Cubierto al 100% |
| **Delivery Vuelto de 100** | RF-13 / RF-14 | Cálculo de vuelto en hoja de repartidor | ✅ Cubierto al 100% |
| **Pick & Collect Programado** | RF-07 / RF-08 | Cola de retención diferida en Redis | ✅ Cubierto al 100% |
| **Split Bill (4 Boletas)** | RF-10 / RF-11 | Módulo de división y multifacturación | ✅ Cubierto al 100% |
| **Factura RUC en 0.2s** | RF-11 | API ApisPeru + Nubefact PSE/OSE | ✅ Cubierto al 100% |
| **Pago Mixto (Efectivo+Yape)**| RF-10 | Módulo de pago multimétodo | ✅ Cubierto al 100% |
| **Fusión / Mudanza Mesas** | RF-02 | Operaciones de salón en WebSockets | ✅ Cubierto al 100% |
| **Reposición por Merma** | RF-12 / RF-15 | Flujo de reposición y kardex de pérdidas | ✅ Cubierto al 100% |
| **Fuga de Comensal** | RF-10 / RF-14 | Anulación protegida por PIN de supervisor | ✅ Cubierto al 100% |
