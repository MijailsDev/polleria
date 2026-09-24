# Plan Integral de Adquisiciones, Equipamiento e Inversión
## Modelo Operativo Real: Pollería de Barrio con Estación Central del Pollero (Piso Único)

**Proyecto:** Modernización Tecnológica para Pollería Tradicional de Barrio  
**Referencia Operativa:** Modelo Centralizado en Estación de Brasas + Cocina de Producción Interna  
**Objetivo:** Optimizar la inversión en hardware y servicios digitales, eliminando comandas manuales de papel, gritos en cocina y cobros desfasados.

---

## 1. La Realidad Operativa del Negocio (Mapeo de Procesos)

### 1.1. Distribución Física del Local
1. **Estación Central del Pollero (Front de Producción):**
   * Es el núcleo del restaurante. El maestro pollero cuenta en su estación con:
     * Horno de brasas con pollos girando continuamente.
     * Tabla de trozado y corte de presas.
     * Depósito/tina térmica de papas fritas listas para salar.
     * Recipientes de ensaladas (fresca y cocida) y salsas/cremas.
     * Tápers, envases descartables, bolsas y ligas para despacho rápido.
   * **Responsabilidad:** Corta el pollo, sirve las papas, agrega la ensalada y monta el plato (o empaca el pedido para llevar).
2. **Cocina Interna de Fondo (Back de Producción):**
   * Ubicada tras la puerta de servicio: es el área pesada de aderezo y maceración de pollos, lavado/corte de verduras, cocción de Arroz Chaufa y baterías de freidoras continuas de papas que reabastecen en tinas calientes la mesa del pollero.
3. **Salón de Comensales y Mostrador de Caja:**
   * Mesas de clientes, vitrina conservadora de gaseosas heladas, mostrador de caja y estación de despacho para llevar.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        MAPA DE FLUJO EN POLLERÍA DE BARRIO                             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  COCINA INTERNA (FONDO)         ESTACIÓN CENTRAL DEL POLERO         SALÓN Y CAJA       │
│                                                                                        │
│  ┌────────────────────┐         ┌─────────────────────────┐         ┌────────────────┐ │
│  │ Aderezo de Pollos  │         │ Horno de Brasas Giratorio│         │ Clientes Mesas │ │
│  │ Batería Freidoras  ├────────►│ Tina de Papas Fritas    │◄────────┤ (Mesero Tablet │ │
│  │ Cocción Chaufa     │ (Tinas) │ Bowls Ensaladas/Cremas  │ Comanda │  o Menú QR)    │ │
│  │ 🖨️ Ticketera Cocina│         │ Tápers, Bolsas y Ligas  │ Digital └────────────────┘ │
│  └────────────────────┘         │ 🖨️ TICKET. CON BUZZER   │                            │
│                                 └────────────┬────────────┘         ┌────────────────┐ │
│                                              │ Plato Listo          │ Mostrador Caja │ │
│                                              ▼ / Paquete Llevar     │ - PC Touch     │ │
│                                 ┌─────────────────────────┐         │ - Conservadora │ │
│                                 │ Mesero (Lleva a mesa)   ├────────►│   de Bebidas   │ │
│                                 │ o Despacho Takeout      │         │ 🖨️ Ticket. Caja│ │
│                                 └─────────────────────────┘         └────────────────┘ │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Optimización del Esquema de Impresión (Split Simplificado)

En base a la observación real de campo, **se descarta la sobrecarga de ticketeras innecesarias**. El restaurante opera de forma óptima con **solo 2 a 3 impresoras de red**:

1. **Ticketera 1: Estación Central del Pollero (Obligatoria - Con Alarma Sonora / Buzzer):**
   * Conexión por cable Ethernet Cat6 y timbre acústico de alto volumen.
   * **¿Qué imprime?** La comanda integral de salón y llevar: presa de pollo (1/8, 1/4, 1/2 o entero), tipo de papas, tipo de ensalada y cremas solicitadas. El pollero tiene todo a la mano y ensambla el pedido de inmediato.
2. **Ticketera 2: Caja y Despacho de Bebidas (Obligatoria):**
   * Ubicada junto al terminal de cobro y la conservadora de refrescos/gaseosas.
   * **¿Qué imprime?** Precuentas de salón, tickets fiscales SUNAT y la comanda interna de bebidas (Inca Kola personal, jarras de chicha) para que la cajera o mesero saque la bebida helada al instante.
3. **Ticketera 3: Cocina Interna de Fondo (Opcional):**
   * Solo si el restaurante ofrece platos de cocina caliente que no despacha el pollero (porciones de Arroz Chaufa, tequeños o caldos).

---

## 3. Nuevos Flujos Automatizados de Atención al Cliente

### 3.1. Flujo de Salón (Consumo en Mesa)
1. **Toma de Pedido:** El comensal se sienta en la Mesa 4. El mesero se acerca con su tablet (o el comensal escanea el QR en la mesa):
   * Selecciona: `1x 1/8 Pollo (pecho) + Papas Clásicas + Ensalada Fresca`.
2. **Disparo Instantáneo:** Al presionar *"Enviar"*, la ticketera del pollero emite su pitido penetrante (*Buzzer*) y expulsa la comanda:
   ```
   ================================
   MESA: 04          ORDEN: #42
   HORA: 19:45       MOZO: Juan
   ================================
   1x 1/8 POLLO (PECHO)
      - Papas Fritas
      - Ensalada Fresca
      - Cremas Mixtas
   ================================
   ```
3. **Emplatado sin Gritos:** El pollero troza la pechuga, saca papas de su tina, monta la ensalada de su bandeja y deja el plato listo en el mostrador en 3 minutos. El mesero lo recoge y lo lleva a la mesa.
4. **Adición de Bebidas en Proceso:** Si a los 20 minutos el comensal pide una *"Inca Kola personal"*, la mesera la agrega en su tablet en 3 segundos. La bebida se carga a la cuenta digital de la Mesa 4. La mesera la retira de la conservadora y se la entrega.
5. **Cierre de Cuenta en Caja:** El comensal se acerca al mostrador de caja y dice: *"Mesa 4, por favor"*. La cajera visualiza en la pantalla táctil:
   * 1/8 Pollo a la Brasa: S/. 14.00
   * 1 Inca Kola Personal 500ml: S/. 4.50
   * **Total a Cobrar: S/. 18.50**  
   *(Se erradica el papelito manuscrito con sumas erróneas; el comensal paga con efectivo, Yape o tarjeta y recibe su boleta electrónica).*

### 3.2. Flujo de Pedidos Para Llevar (Takeout)
1. **Cobro y Registro en Mostrador:** El cliente ingresa directo a caja: *"Buenas noches, 3/8 de pollo para llevar"*.
2. **Identificación y Prepago:** La cajera digita en la pantalla: `3/8 Pollo Llevar - Cliente: Carlos`. El cliente abona en el acto. La ticketera de caja le emite su comprobante con el identificador: **Llevar #15 - Carlos**.
3. **Impresión Directa en la Estación del Pollero:** Simultáneamente, la ticketera del pollero imprime:
   ```
   ================================
   *** PARA LLEVAR ***
   ORDEN: #15        CLIENTE: Carlos
   ================================
   3x 1/8 POLLO (2 Piernas, 1 Pecho)
      - 3x Porción de Papas Fritas
      - Ensalada Clásica (Empacada)
      - Cremas completas + Ligas
   ================================
   ```
4. **Despacho Organizado:** El cliente no invade el área de brasas ni sostiene papelitos grasosos. Espera cómodo. El pollero empaca en los tápers de su repisa, coloca las ligas en la bolsa y llama: *"¡Orden #15, señor Carlos!"*.

---

## 4. Lista de Adquisiciones Actualizada (Tangibles e Intangibles)

### A. Elementos TANGIBLES (Hardware y Redes)
1. **Mini PC Industrial (Edge Gateway - Intel N100, 16GB RAM):** Garantiza que si se cae el internet de la calle, las tablets de salón y la ticketera del pollero sigan funcionando por la red local sin frenar el restaurante.
2. **Terminal de Caja Táctil (All-in-One 15.6"):** Agiliza el registro de cobros y pedidos para llevar en segundos.
3. **Gaveta Metálica Automática (RJ11):** Solo se abre por impulso eléctrico tras registrar el cobro en el sistema.
4. **UPS de Respaldo (1000VA - 1200VA):** Respaldo de 30-45 minutos de energía para la caja, router y Mini PC ante cortes imprevistos de luz.
5. **Ticketera Térmica de Red con Buzzer (Estación del Pollero):** Modelo Ethernet 80mm con alarma acústica potente para alertar sobre el ruido del extractor y el horno.
6. **Ticketera Térmica de Caja / Bebidas (80mm USB/Red):** Impresión de precuentas, boletas/facturas SUNAT y despacho de conservadora.
7. **Tablets Android para Meseros (1 o 2 unidades de 8.7" con Fundas Rugged Anticaídas):** Para toma de órdenes rápida en mesas sin papeles.
8. **Router Balanceador Dual-WAN + Access Point WiFi 6 de Techo:** Soporta la concurrencia de clientes usando el QR y ofrece conmutación automática (*failover*) a internet 4G si la fibra óptica falla.
9. **Cableado UTP Cat6 100% Cobre:** Conexión por cable directo desde el switch hacia la ticketera del pollero y la caja (cero WiFi en cocina).
10. **Parantes Acrílicos para Mesas con QR:** Códigos permanentes y lavables por mesa.

### B. Elementos INTANGIBLES (Servicios, Nube y Conexiones Externas)
1. **Servidor VPS Cloud (PostgreSQL + API NestJS):** Base de datos centralizada con copias de seguridad automáticas diarias fuera del local.
2. **Dominio Web Comercial (.pe o .com) + Certificado SSL HTTPS:** Dirección oficial para la carta QR (`mirestaurante.pe/m/01`).
3. **Suscripción a Facturación SUNAT vía PSE/OSE (Nubefact):** Emisión legal de Boletas y Facturas electrónicas en 1 segundo sin caídas.
4. **Pasarela de Pagos Digitales para Autoservicio (Culqi / Izipay Online):** Soporte oficial para cobros con código de aprobación Yape, Plin y tarjetas.
5. **API de Consulta RENIEC / SUNAT (ApisPeru):** Autocompletado de DNI y RUC en caja para evitar errores en comprobantes.
6. **Línea de Contingencia Móvil 4G (Chip de datos):** Conectada al router para respaldo ante caída de fibra óptica.
7. **Talonario Físico de Contingencia SUNAT:** Respaldo manual en gaveta de caja por normativa tributaria.

---

## 5. Presupuesto Consolidado Adaptado al Modelo de Barrio

Al unificar la estación del pollero y simplificar el número de ticketeras, el presupuesto de inversión se reduce notablemente:

### Inversión Inicial en Hardware (CapEx Optimizado)
| Ítem | Cantidad | Costo Unitario Ref. | Subtotal (S/.) |
| :--- | :---: | :---: | :---: |
| Mini PC Servidor Local (Intel N100, 16GB) | 1 | S/. 950.00 | S/. 950.00 |
| Terminal Táctil All-in-One de Caja | 1 | S/. 1,350.00 | S/. 1,350.00 |
| Gaveta Portadinero con cable RJ11 | 1 | S/. 160.00 | S/. 160.00 |
| UPS de Respaldo 1200VA | 1 | S/. 380.00 | S/. 380.00 |
| Ticketera Red Ethernet con Buzzer (Estación Pollero) | 1 | S/. 360.00 | S/. 360.00 |
| Ticketera Térmica de Caja / Bebidas (80mm) | 1 | S/. 290.00 | S/. 290.00 |
| Tablet Android 8.7" + Funda Anticaídas (Mesero) | 1 | S/. 550.00 | S/. 550.00 |
| Router Dual-WAN Empresarial (TP-Link ER605) | 1 | S/. 240.00 | S/. 240.00 |
| Access Point WiFi 6 de Techo (EAP610) | 1 | S/. 380.00 | S/. 380.00 |
| Cableado estructurado Cat6, conectores e inst. | 1 lote | S/. 280.00 | S/. 280.00 |
| Parantes Acrílicos para Mesas (con QR) | 20 | S/. 8.00 | S/. 160.00 |
| **TOTAL INVERSIÓN INICIAL OPTIMIZADA (CapEx)** | — | — | **~S/. 5,100.00** |

*(Se logró un ahorro de más de S/. 2,200 soles respecto al modelo sobredimensionado anterior, adecuándolo a la economía real de una pollería de barrio).*

---

### Costo Operativo Mensual Recurrente (OpEx)
| Servicio Mensual | Modalidad | Costo Mensual Estimado (S/.) |
| :--- | :--- | :---: |
| Internet Fibra Óptica Empresarial | Mensual | S/. 110.00 |
| Chip Móvil 4G Contingencia (Failover) | Mensual | S/. 30.00 |
| Servidor VPS Cloud (PostgreSQL + Backups) | Mensual | S/. 35.00 |
| Facturación Electrónica SUNAT (Nubefact) | Mensual | S/. 65.00 |
| API Consulta DNI/RUC (ApisPeru) | Mensual | S/. 15.00 |
| Dominio Web (.pe prorrateado mensual) | Anual (S/. 110/año) | S/. 9.00 |
| Consumible: Rollos de papel térmico (80mm) | Mensual | S/. 30.00 |
| **TOTAL COSTO OPERATIVO MENSUAL (OpEx)** | — | **~S/. 294.00 / mes** |
