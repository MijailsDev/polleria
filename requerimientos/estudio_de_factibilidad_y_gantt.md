# Estudio de Factibilidad y Diagrama de Gantt – Sistema de Gestión para Pollería

**Proyecto:** Sistema de Gestión Web y Automatización para Pollerías y Brasas (Modalidad "Llave en Mano")  
**Equipo de Desarrollo:** 2 Estudiantes Junior (**Mijail y Nilton**)  
**Institución:** UNAMAD – Escuela Profesional de Ingeniería de Sistemas e Informática  
**Curso:** Análisis y Diseño de Sistemas II (Dr. Dany Dorian Isuiza Pérez)  
**Periodo Oficial del Proyecto:**  
* **Fecha de Inicio:** Lunes 21 de Septiembre de 2026 (`2026-09-21`)  
* **Fecha de Fin / Cierre:** Jueves 24 de Diciembre de 2026 (`2026-12-24`)  
* **Jornada Laboral:** **Lunes a Viernes exclusivamente** (Sábados y Domingos no laborables)  
* **Duración Total:** 95 Días Calendario / **66 Días Laborables Efectivos**  
* **Feriados No Laborables Excluidos:**  
  * *Jueves 08 de Octubre:* Combate de Angamos (Nacional).  
  * *Domingo 01 de Noviembre:* Día de Todos los Santos (Cae fin de semana).  
  * *Martes 08 de Diciembre:* Inmaculada Concepción (Nacional).  
  * *Miércoles 09 de Diciembre:* Batalla de Ayacucho (Nacional).  
  *(Viernes 25 de Diciembre: Navidad - posterior al fin del proyecto).*  
**Moneda:** Soles Peruanos (S/.)  

---

## ESTRUCTURA DEL DOCUMENTO AUDITADO
1. **Hoja 1: Hoja de Costos y Sueldos Junior** (9 roles funcionales adaptados a escala salarial junior en Perú).
2. **Hoja 2: Recursos de Desarrollo y Hardware de Implementación** (Proyecto Llave en Mano: Hardware de local S/. 5,100 + Servicios reales de desarrollo S/. 705 + Mobiliario S/. 0).
3. **Hoja 3: TIR y VAN** (Inversión inicial $I_0$, ingresos netos justificados por rotación y ahorro de comisiones, VAN, TIR y Payback).
4. **Diagrama de Gantt Detallado** (6 fases de Lunes a Viernes, inicio 17 Setiembre y fin 24 Diciembre 2026).
5. **Apéndice Técnico de Fórmulas de Excel** (Celda por celda para transcripción directa).

---

# HOJA 1: `Hoja de costos`

### 1.1 Escala Salarial de Perfil Junior / Estudiante sin Experiencia en Perú

Remuneración real de mercado peruano para practicantes profesionales y juniors sin experiencia:

| Rol Funcional | Persona Asignada | Sueldo Base Mensual (S/.) | Columna en Excel | Justificación Salarial Junior en Perú |
| :--- | :--- | :---: | :---: | :--- |
| **Jefe de Proyecto** | **Mijail** | 1,800.00 | **E** | Líder estudiantil del equipo, coordinación y entregables. |
| **Analista** | **Nilton** | 1,400.00 | **F** | Levantamiento de requisitos y documentación de campo. |
| **Programador 1** | **Mijail** | 1,500.00 | **G** | Desarrollador Backend Junior (NestJS, APIs, PostgreSQL). |
| **Programador 2** | **Nilton** | 1,500.00 | **H** | Desarrollador Frontend Junior (Next.js, Tailwind, PWA). |
| **Programador 3** | **Nilton** | 1,400.00 | **I** | Soporte de Hardware Junior (Ticketeras ESC/POS y Red LAN).|
| **DBA** | **Mijail** | 1,500.00 | **J** | Administrador de Base de Datos Junior (Modelado SQL). |
| **Auditor / QA** | **Nilton** | 1,200.00 | **K** | Tester Junior (Pruebas de estrés y casos de prueba). |
| **Diseño UI/UX** | **Mijail** | 1,200.00 | **L** | Diseñador Junior (Wireframes y prototipos Figma). |
| **Documentador** | **Nilton** | 1,025.00 | **M** | Auxiliar de Documentación (Sueldo Mínimo Vital en Perú). |

---

### 1.2 Fases del Proyecto: Duración y Dedicación por Rol (68 Días Laborables)

*Jornada de Lunes a Viernes. Total: 68 días laborables = 2.23 meses efectivos.*  
`Meses` = `Días / 30` (para 9 y 16 días) o `Días / 31` (para 18, 11 y 5 días).

| Fase | Días | Meses | Resp. | Jefe (Mijail) | Analista (Nilton) | Prog 1 (Mijail) | Prog 2 (Nilton) | Prog 3 (Nilton) | DBA (Mijail) | Auditor (Nilton) | Diseño (Mijail) | Docum. (Nilton) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Planif. y Análisis** | 9 | 0.3000 | Mijail | 50% | 50% | 20% | 20% | 10% | 30% | 40% | 50% | 30% |
| **2. Arquitectura y UI** | 9 | 0.3000 | Mijail | 50% | 40% | 50% | 20% | 20% | 30% | 30% | 20% | 40% |
| **3. Desarr. Ciclo 1 (Core)** | 18 | 0.5806 | Mijail | 30% | 20% | 50% | 50% | 20% | 30% | 50% | 20% | 30% |
| **4. Desarr. Ciclo 2 (Hardware)** | 16 | 0.5333 | Nilton | 30% | 20% | 20% | 50% | 50% | 50% | 20% | 30% | 30% |
| **5. Pruebas y QA** | 11 | 0.3548 | Nilton | 50% | 50% | 30% | 25% | 20% | 30% | 30% | 40% | 25% |
| **6. Despliegue y Cierre** | 5 | 0.1613 | Nilton | 50% | 30% | 50% | 10% | 10% | 30% | 40% | 20% | 60% |
| **TOTAL** | **68** | **2.2300** | — | — | — | — | — | — | — | — | — | — |

---

### 1.3 Costo por Fase y por Rol Junior (en Soles S/.)

Fórmula: `Costo = Sueldo_Junior × %Dedicación × Meses` (Columnas N a W en Excel):

| Fase | Jefe (N) | Analista (O) | Prog 1 (P) | Prog 2 (Q) | Prog 3 (R) | DBA (S) | Auditor (T) | Diseño (U) | Docum (V) | Total Fase (W) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **1. Planificación** | 270.00 | 210.00 | 90.00 | 90.00 | 42.00 | 135.00 | 144.00 | 180.00 | 92.25 | **1,253.25** |
| **2. Diseño y UI** | 270.00 | 168.00 | 225.00 | 90.00 | 84.00 | 135.00 | 108.00 | 72.00 | 123.00 | **1,275.00** |
| **3. Ciclo 1 Core** | 313.55 | 162.58 | 435.48 | 435.48 | 162.58 | 261.29 | 348.39 | 139.35 | 178.55 | **2,437.26** |
| **4. Ciclo 2 Ventas** | 288.00 | 149.33 | 160.00 | 400.00 | 373.33 | 400.00 | 128.00 | 192.00 | 164.00 | **2,254.67** |
| **5. Pruebas y QA** | 319.35 | 248.39 | 159.68 | 133.06 | 106.45 | 159.68 | 129.03 | 167.74 | 90.93 | **1,514.32** |
| **6. Despliegue** | 145.16 | 67.74 | 120.97 | 24.19 | 22.58 | 72.58 | 77.42 | 38.71 | 99.19 | **668.55** |
| **TOTAL SUELDOS** | **1,606.06** | **1,006.04** | **1,191.13** | **1,172.74** | **783.85** | **1,163.55** | **933.55** | **792.39** | **747.92** | **9,403.04** |

**Costo Total de Sueldos Junior: S/. 9,403.04**

---

### 1.4 Consolidación de Pago Mensual Real (Mijail y Nilton)

* **Mijail** = Jefe de Proyecto (N) + Programador 1 (P) + DBA (S) + Diseñador UI/UX (U)
* **Nilton** = Analista (O) + Programador 2 (Q) + Programador 3 (R) + Auditor QA (T) + Documentador (V)

| Mes | Fases Correspondientes | Pago a Mijail (S/.) | Pago a Nilton (S/.) | Total Mensual Equipo (S/.) |
| :---: | :--- | :---: | :---: | :---: |
| **Mes 1** | Fases 1 y 2 (17 Setiembre a 13 Octubre) | 1,377.00 | 1,151.25 | 2,528.25 |
| **Mes 2** | Fase 3 (14 Octubre a 06 Noviembre) | 1,149.68 | 1,287.58 | 2,437.26 |
| **Mes 3** | Fase 4 (09 Noviembre a 30 Noviembre) | 1,040.00 | 1,214.67 | 2,254.67 |
| **Mes 4** | Fases 5 y 6 (01 Diciembre a 24 Diciembre) | 1,183.87 | 999.00 | 2,182.87 |
| **TOTAL** | — | **4,750.55** | **4,652.50** | **9,403.04** |

---

# HOJA 2: `Recursos y Hardware Llave en Mano`

### 2.1 Hardware Operativo Físico para la Pollería (Instalación en Local)
Equipos adquiridos formalmente para el restaurante bajo la modalidad "Llave en Mano":

| Ítem de Hardware | Descripción Técnica | Cant. | Costo Unit. (S/.) | Costo Total (S/.) | Destino Operativo |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Mini PC Servidor Local** | Intel N100, 16GB RAM, 512GB SSD (Edge) | 1 | 950.00 | 950.00 | Caja (Servidor de Resiliencia LAN). |
| **Terminal Táctil All-in-One** | Pantalla capacitiva 15.6" de alta velocidad | 1 | 1,350.00 | 1,350.00 | Caja Principal (Cobros rápidos). |
| **Ticketera Red con Buzzer** | Térmica Ethernet 80mm con alarma sonora | 1 | 360.00 | 360.00 | Estación Central del Maestro Pollero. |
| **Ticketera Caja / Bebidas** | Térmica 80mm con puerto USB/Red | 1 | 290.00 | 290.00 | Mostrador de Caja / Precuentas. |
| **Tablet Android 8.7" Rugged** | Samsung Tab A9 con funda industrial anticaídas| 1 | 550.00 | 550.00 | Atención móvil de mesero en salón. |
| **Gaveta Metálica Automática** | Apertura eléctrica por pulso RJ11 | 1 | 160.00 | 160.00 | Caja (Seguridad de efectivo). |
| **UPS de Respaldo 1200VA** | Batería interactiva AVR (30-45 min respaldo) | 1 | 380.00 | 380.00 | Protección eléctrica de Caja y Mini PC.|
| **Router Dual-WAN + AP WiFi 6** | Balanceador TP-Link ER605 + AP Techo EAP610 | 1 | 620.00 | 620.00 | Red LAN y WiFi para comensales QR. |
| **Cableado y Conectores** | Bobina Cat6 cobre, canaletas e instalación | 1 | 280.00 | 280.00 | Conexión alámbrica de cocina y caja. |
| **Parantes Acrílicos para Mesas**| Acrílicos lavables con código QR de mesa | 20 | 8.00 | 160.00 | Salón (Acceso a Menú Digital). |
| **SUBTOTAL HARDWARE LOCAL**| — | — | — | **5,100.00** | **Activos físicos del restaurante.** |

### 2.2 Hardware de Desarrollo (Aporte Propio de los Socios - Depreciación 3 Meses)
Mijail y Nilton aportan sus 2 laptops gamer de alto rendimiento. Se registra únicamente el desgaste durante los 3 meses del proyecto (tasa fiscal anual del 25% / 4 trimestres):

| Ítem | Valor de Referencia | Cant. | Total Activo | Depreciación Periodo (S/.) | Justificación Contable |
| :--- | :---: | :---: | :---: | :---: | :--- |
| Laptop Gamer Dev | S/. 2,500.00 | 2 | S/. 5,000.00 | 312.50 | Desgaste térmico y de batería (3 meses). |
| Mouse Óptico Dev | S/. 25.00 | 2 | S/. 50.00 | 3.13 | Desgaste operativo de periféricos. |
| **SUBTOTAL DEPRECIACIÓN**| — | — | — | **315.63** | **Costo contable de desgaste de equipos.** |

### 2.3 Software y Herramientas (Licencias Comerciales Gratuitas: S/. 0.00)
* Todas las herramientas operan bajo licencias permisivas libres (**MIT, Apache 2.0, PostgreSQL License**): VS Code, NestJS, Next.js, PostgreSQL 16, Redis, Docker Engine, Figma Free y GitHub. **Costo: S/. 0.00**.

### 2.4 Mobiliario de Oficina: S/. 0.00 (Eliminado)
* **S/. 0.00 (No aplica):** Se eliminó el alquiler ficticio de sillas y mesas. Los desarrolladores utilizan sus estaciones de trabajo propias.

### 2.5 Gastos Operativos de Desarrollo y Pruebas de Campo
*Gastos estrictamente necesarios para construir y probar la solución:*

| Concepto Operativo | Justificación Real | Monto Total (S/.) |
| :--- | :--- | :---: |
| **Servidor Cloud VPS (DigitalOcean)** | Aprovisionamiento **Just-in-Time** a partir de Fase 3 (14 Oct - 24 Dic = 2.3 meses a S/. 23/mes) para pruebas de la PWA, Webhooks Yape y base de datos en vivo. | 55.00 |
| **Movilidad y Visitas Técnicas de Campo** | Pasajes locales en Puerto Maldonado para entrevistas, medición de distancias para cableado, pruebas acústicas de buzzer y capacitación. | 300.00 |
| **Conectividad y Pruebas Móviles 4G/5G** | Plan de datos móviles para pruebas de tráfico concurrente del menú QR desde celulares en calle. | 200.00 |
| **Energía Eléctrica Imputada** | Consumo eléctrico prorrateado de laptops gamer y pruebas de ticketeras. | 150.00 |
| **TOTAL GASTOS OPERATIVOS** | — | **705.00** |

### 2.6 Consolidación Total de Recursos del Proyecto

| Concepto | Origen del Monto | Total (S/.) |
| :--- | :--- | :---: |
| **1. Hardware Operativo Físico para la Pollería** | Equipos físicos entregados al cliente (`2.1`) | 5,100.00 |
| **2. Depreciación de Laptops de Desarrollo** | Desgaste contable de 3 meses (`2.2`) | 315.63 |
| **3. Mobiliario de Oficina** | Eliminado por ser innecesario (`2.4`) | 0.00 |
| **4. Gastos Operativos de Desarrollo (VPS, Pasajes, Luz)**| Gastos de ejecución y pruebas (`2.5`) | 705.00 |
| **TOTAL RECURSOS Y EQUIPAMIENTO** | Suma total (`D49`) | **6,120.63** |

---

# HOJA 3: `TIR-VAN` (Evaluación Financiera Llave en Mano)

### 3.1 Parámetros Base del Negocio

| Celda | Concepto | Valor | Justificación / Explicación |
| :---: | :--- | :---: | :--- |
| `E14` | **Sueldos del Proyecto** | S/. 9,403.04 | Enlazado dinámicamente con `'Hoja de costos'!W10`. |
| `F14` | **Recursos y Hardware Local**| S/. 6,120.63 | Enlazado dinámicamente con `'Recursos'!D49`. |
| `G14` | **Costo Base de Producción** | **S/. 15,523.67** | `=E14+F14` (Sueldos + Hardware del local + Gastos dev). |
| `H15` | **Margen Comercial** | **30%** | Margen comercial estándar para proyectos integrales. |
| `H14` | **Utilidad del Equipo (30%)** | S/. 4,657.10 | `=G14*H15`. |
| `G16` | **Precio Normal Llave en Mano**| S/. 20,180.77 | `=G14+H14` (Costo total + utilidad comercial). |
| `E16` | **Precio con Descuento (5%)** | S/. 19,171.73 | `=G16-(G16*5%)` (Precio promocional). |
| `F16` | **Precio Negociable (Inversión $I_0$)**| **S/. 19,676.25** | `=(G16+E16)/2` (**Monto que paga el dueño por TODO**). |
| `I16` | **Ingreso Bruto Anual Pollería**| S/. 80,000.00 | Beneficio económico anual generado por el sistema. |
| `I14` | **Tasa de IGV** | 18% | Impuesto General a las Ventas. |
| `H16` | **Ingresos Netos Año 1** | **S/. 65,600.00** | `=I16-(I16*I14)` (Ingreso neto real sin IGV). |
| `F12` | **Tasa de Descuento (COK)** | **25%** | Costo de Oportunidad del Capital. |
| `D14` | **Operación Mensual del Local**| S/. 250.00 | VPS DigitalOcean, Nubefact y rollos de papel. |
| `D16` | **Mantenimiento Mensual** | S/. 400.00 | Soporte técnico continuo para el restaurante. |

> [!NOTE]
> **Sustento del Ingreso Anual de S/. 80,000.00 (~S/. 6,600 al mes):**  
> 1. *Cero mermas y errores en comandas:* Ahorro comprobado de **S/. 800 / mes**.  
> 2. *Rotación 15 minutos más rápida de mesas en hora punta:* 5 mesas adicionales por día = **S/. 3,500 / mes**.  
> 3. *Canal Delivery Propio:* Ahorro de comisiones del 25% de PedidosYa en pedidos del barrio = **S/. 2,300 / mes**.  
> **Total Beneficio Real:** S/. 6,600 / mes = **S/. 79,200 / año**.

---

### 3.2 Flujo de Caja Proyectado a 5 Años (C3:H10)

*Crecimiento anual estimado de ingresos del **6%**.*  
*Egresos operativos del restaurante: `(S/. 250 + S/. 400) * 12 meses = S/. 7,800.00` + Mantenimiento anual S/. 1,000 = **S/. 8,800.00**.*

| Concepto | Año 0 | Año 1 | Año 2 | Año 3 | Año 4 | Año 5 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Ingresos Netos** | 0.00 | 65,600.00 | 69,536.00 | 73,708.16 | 78,130.65 | 82,818.49 |
| **Egresos Totales** | 19,676.25 | 8,800.00 | 8,800.00 | 8,800.00 | 8,800.00 | 8,800.00 |
| *— Inversión Inicial* | 19,676.25 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 |
| *— Operación Anual* | 0.00 | 7,800.00 | 7,800.00 | 7,800.00 | 7,800.00 | 7,800.00 |
| *— Mantenimiento Anual*| 0.00 | 1,000.00 | 1,000.00 | 1,000.00 | 1,000.00 | 1,000.00 |
| **FLUJO NETO ∑(I − E)**| **-19,676.25** | **56,800.00** | **60,736.00** | **64,908.16** | **69,330.65** | **74,018.49** |

---

### 3.3 Indicadores Financieros de Rentabilidad

| Indicador | Celda | Fórmula en Excel | Resultado | Interpretación Financiera |
| :--- | :---: | :--- | :---: | :--- |
| **VAN** | `C12` | `=C10+NPV(F12, D10:H10)` | **S/. 140,939.08** | **Altamente Viable ($VAN > 0$):** El proyecto genera más de S/. 140,000 de ganancia neta descontada. |
| **TIR** | `C13` | `=IRR(C10:H10)` | **287.65%** | **Excelente Rendimiento ($TIR > 25\%$):** Rendimiento sobresaliente por entregar valor integral con bajo costo. |

---

### 3.4 Recuperación de la Inversión (Flujo Acumulado)

| Concepto | Año 0 | Año 1 | Año 2 | Año 3 | Año 4 | Año 5 |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Flujo Neto del Periodo** | -19,676.25 | 56,800.00 | 60,736.00 | 64,908.16 | 69,330.65 | 74,018.49 |
| **Flujo Acumulado** | **-19,676.25** | **+37,123.75** | **+97,859.75** | **+162,767.91** | **+232,098.56** | **+306,117.05** |

> [!IMPORTANT]
> **Periodo de Recuperación (Payback):**  
> El cliente recupera la inversión total de S/. 19,676.25 en el **Año 1** (aproximadamente a los **4.1 meses** de funcionamiento).

---

# DIAGRAMA DE GANTT OFICIAL (LUNES A VIERNES: 21 SET – 24 DIC 2026)

**Fechas Oficiales:** Lunes 21 de Septiembre a Jueves 24 de Diciembre de 2026.  
**Semana Laboral:** **Lunes a Viernes** (Sábados y Domingos no laborables).  
**Días Laborables Totales:** **66 Días**  
**Feriados Descontados:** 08/10 (Angamos), 08/12 (Inmaculada Concepción) y 09/12 (Batalla de Ayacucho).

---

### Resumen Oficial por Fases

| ID | Fase | Duración | Inicio | Fin | Predecesora | Responsable Principal |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **1** | **FASE 1: PLANIFICACIÓN Y ANÁLISIS** | **8 días** | **21/09/2026 (Lun)** | **30/09/2026 (Mié)** | — | **Mijail** |
| **2** | **FASE 2: DISEÑO DE ARQUITECTURA Y PROTOTIPADO** | **9 días** | **01/10/2026 (Jue)** | **14/10/2026 (Mié)** | 1 | **Mijail** |
| **3** | **FASE 3: DESARROLLO CICLO 1 (CORE Y SALÓN)** | **18 días** | **15/10/2026 (Jue)** | **09/11/2026 (Lun)** | 2 | **Mijail** *(Inicio Servidor VPS)* |
| **4** | **FASE 4: DESARROLLO CICLO 2 (HARDWARE Y SUNAT)** | **16 días** | **10/11/2026 (Mar)** | **01/12/2026 (Mar)** | 3 | **Nilton** |
| **5** | **FASE 5: PRUEBAS Y ASEGURAMIENTO CALIDAD (QA)**| **10 días** | **02/12/2026 (Mié)** | **17/12/2026 (Jue)** | 4 | **Nilton** |
| **6** | **FASE 6: DESPLIEGUE Y CIERRE EN LOCAL** | **5 días** | **18/12/2026 (Vie)** | **24/12/2026 (Jue)** | 5 | **Nilton** |

---

### Lista Detallada de Tareas de Lunes a Viernes (21 Set – 24 Dic 2026)

| ID | Tarea Específica | Duración | Inicio | Fin | Predec. | Responsable |
| :---: | :--- | :---: | :---: | :---: | :---: | :---: |
| **1** | **FASE 1: PLANIFICACIÓN Y ANÁLISIS** | **8 d** | **21/09/2026 (Lun)** | **30/09/2026 (Mié)** | — | **Mijail** |
| 1.1 | Búsqueda y selección del restaurante en la zona | 1 d | 21/09/2026 (Lun) | 21/09/2026 (Lun) | — | Mijail, Nilton |
| 1.2 | Primer contacto y coordinación con el dueño | 1 d | 21/09/2026 (Lun) | 21/09/2026 (Lun) | 1.1 | Mijail |
| 1.3 | Técnica 1: Entrevista a profundidad con el dueño | 1 d | 22/09/2026 (Mar) | 22/09/2026 (Mar) | 1.2 | Mijail |
| 1.4 | Técnica 2: Observación de la atención en el local | 1 d | 23/09/2026 (Mié) | 23/09/2026 (Mié) | 1.3 | Nilton |
| 1.5 | Revisión de comandas de papel y boletas | 1 d | 23/09/2026 (Mié) | 23/09/2026 (Mié) | 1.3 | Mijail |
| 1.6 | Definición de usuarios: Mozo, Cocinero, Caja | 1 d | 24/09/2026 (Jue) | 24/09/2026 (Jue) | 1.4 | Nilton |
| 1.7 | Lista de necesidades del restaurante (Backlog) | 2 d | 24/09/2026 (Jue) | 25/09/2026 (Vie) | 1.6 | Mijail, Nilton |
| 1.8 | Detalle de funciones del sistema (RF-01 al 15) | 1 d | 28/09/2026 (Lun) | 28/09/2026 (Lun) | 1.7 | Nilton |
| 1.9 | Requisitos de seguridad y velocidad del sistema | 1 d | 28/09/2026 (Lun) | 28/09/2026 (Lun) | 1.8 | Nilton |
| 1.10 | Evaluación técnica de herramientas y servidor | 1 d | 29/09/2026 (Mar) | 29/09/2026 (Mar) | 1.8 | Mijail |
| 1.11 | Cálculo de costos y rentabilidad (TIR y VAN) | 1 d | 29/09/2026 (Mar) | 29/09/2026 (Mar) | 1.10 | Mijail |
| 1.12 | Ajuste final del cronograma de 66 días | 1 d | 30/09/2026 (Mié) | 30/09/2026 (Mié) | 1.11 | Mijail, Nilton |
| 1.13 | Aprobación del documento con el dueño | 1 d | 30/09/2026 (Mié) | 30/09/2026 (Mié) | 1.12 | Mijail, Nilton |
| **2** | **FASE 2: DISEÑO DE ARQUITECTURA Y PROTOTIPADO** | **9 d** | **01/10/2026 (Jue)** | **14/10/2026 (Mié)** | **1** | **Mijail** |
| 2.1 | Diagramas del uso del sistema por cada rol | 2 d | 01/10/2026 (Jue) | 02/10/2026 (Vie) | 1.13 | Nilton |
| 2.2 | Diseño de bocetos de las pantallas | 1 d | 05/10/2026 (Lun) | 05/10/2026 (Lun) | 2.1 | Mijail |
| 2.3 | Diseño del modelo de datos para el restaurante | 2 d | 05/10/2026 (Lun) | 06/10/2026 (Mar) | 2.1 | Mijail |
| 2.4 | Creación de tablas en la base de datos | 1 d | 07/10/2026 (Mié) | 07/10/2026 (Mié) | 2.3 | Mijail |
| — | *Feriado Nacional: Combate de Angamos* | *0 d* | *08/10/2026 (Jue)* | *08/10/2026 (Jue)* | — | *No laborable* |
| 2.5 | Diagrama de estructura interna del sistema | 1 d | 09/10/2026 (Vie) | 09/10/2026 (Vie) | 2.4 | Mijail |
| 2.6 | Diagrama de cómo se comunican las partes | 1 d | 12/10/2026 (Lun) | 12/10/2026 (Lun) | 2.5 | Mijail |
| 2.7 | Diagrama del paso a paso del cobro con QR | 1 d | 12/10/2026 (Lun) | 12/10/2026 (Lun) | 2.6 | Nilton |
| 2.8 | Plano de conexión de red e impresoras | 1 d | 13/10/2026 (Mar) | 13/10/2026 (Mar) | 2.7 | Nilton |
| 2.9 | Manual descriptivo de los datos almacenados | 1 d | 13/10/2026 (Mar) | 13/10/2026 (Mar) | 2.4 | Nilton |
| 2.10 | Diseño visual del menú digital para celular | 1 d | 13/10/2026 (Mar) | 13/10/2026 (Mar) | 2.2 | Mijail |
| 2.11 | Diseño visual de las pantallas de mozo y caja | 1 d | 14/10/2026 (Mié) | 14/10/2026 (Mié) | 2.10 | Mijail |
| 2.12 | Presentación de pantallas de ejemplo al dueño | 1 d | 14/10/2026 (Mié) | 14/10/2026 (Mié) | 2.11 | Mijail, Nilton |
| **3** | **FASE 3: DESARROLLO CICLO 1 (CORE Y SALÓN)** | **18 d** | **15/10/2026 (Jue)** | **09/11/2026 (Lun)** | **2** | **Mijail** |
| 3.1 | Preparación del entorno de programación | 1 d | 15/10/2026 (Jue) | 15/10/2026 (Jue) | 2.12 | Mijail |
| 3.2 | Configuración del servidor en la nube | 1 d | 16/10/2026 (Vie) | 16/10/2026 (Vie) | 3.1 | Mijail |
| 3.3 | Conexión del programa con la base de datos | 1 d | 19/10/2026 (Lun) | 19/10/2026 (Lun) | 3.2 | Mijail |
| 3.4 | Registro de la carta de pollos y precios | 1 d | 20/10/2026 (Mar) | 20/10/2026 (Mar) | 3.3 | Nilton |
| 3.5 | Inicio de sesión seguro para mozos y cajero | 2 d | 21/10/2026 (Mié) | 22/10/2026 (Jue) | 3.4 | Mijail |
| 3.6 | Pantalla para ver el estado de las 10 mesas | 2 d | 23/10/2026 (Vie) | 26/10/2026 (Lun) | 3.5 | Nilton |
| 3.7 | Opción para unir mesas o cambiar de mesa | 2 d | 27/10/2026 (Mar) | 28/10/2026 (Mié) | 3.6 | Nilton |
| 3.8 | Pantalla del menú digital con fotos de platos | 2 d | 29/10/2026 (Jue) | 30/10/2026 (Vie) | 3.7 | Nilton |
| 3.9 | Opción obligatoria: Elegir Pecho o Pierna | 2 d | 02/11/2026 (Lun) | 03/11/2026 (Mar) | 3.8 | Nilton |
| 3.10 | Opción de cambio de papas o ensalada | 1 d | 04/11/2026 (Mié) | 04/11/2026 (Mié) | 3.9 | Nilton |
| 3.11 | Aviso en tiempo real cuando llega un pedido | 2 d | 05/11/2026 (Jue) | 06/11/2026 (Vie) | 3.10 | Mijail |
| 3.12 | Botón en el celular para llamar al mozo | 1 d | 09/11/2026 (Lun) | 09/11/2026 (Lun) | 3.11 | Nilton |
| 3.13 | Control de porciones (1 pollo = 4 cuartos) | 1 d | 09/11/2026 (Lun) | 09/11/2026 (Lun) | 3.12 | Mijail |
| 3.14 | Revisión y pruebas de la toma de pedidos | 1 d | 09/11/2026 (Lun) | 09/11/2026 (Lun) | 3.13 | Mijail, Nilton |
| **4** | **FASE 4: DESARROLLO CICLO 2 (HARDWARE Y SUNAT)** | **16 d** | **10/11/2026 (Mar)** | **01/12/2026 (Mar)** | **3** | **Nilton** |
| 4.1 | Diseño del ticket impreso con letra grande | 1 d | 10/11/2026 (Mar) | 10/11/2026 (Mar) | 3.14 | Nilton |
| 4.2 | Impresora con sonido de alerta para cocina | 1 d | 11/11/2026 (Mié) | 11/11/2026 (Mié) | 4.1 | Nilton |
| 4.3 | Apertura de turno de caja con dinero inicial | 1 d | 12/11/2026 (Jue) | 12/11/2026 (Jue) | 4.2 | Mijail |
| 4.4 | Cobro rápido para pedidos para llevar | 1 d | 13/11/2026 (Vie) | 13/11/2026 (Vie) | 4.3 | Nilton |
| 4.5 | Cobro con Yape y Plin mediante código | 2 d | 16/11/2026 (Lun) | 17/11/2026 (Mar) | 4.4 | Mijail |
| 4.6 | Confirmación automática del pago en pantalla | 1 d | 18/11/2026 (Mié) | 18/11/2026 (Mié) | 4.5 | Mijail |
| 4.7 | Búsqueda automática de nombre por DNI o RUC | 1 d | 19/11/2026 (Jue) | 19/11/2026 (Jue) | 4.6 | Nilton |
| 4.8 | Emisión de boletas y facturas electrónicas | 2 d | 20/11/2026 (Vie) | 23/11/2026 (Lun) | 4.7 | Mijail |
| 4.9 | Impresión del código QR de SUNAT en ticket | 1 d | 24/11/2026 (Mar) | 24/11/2026 (Mar) | 4.8 | Nilton |
| 4.10 | Opción para dividir la cuenta entre amigos | 2 d | 25/11/2026 (Mié) | 26/11/2026 (Jue) | 4.9 | Mijail |
| 4.11 | Cierre de caja diario y reporte de ventas | 1 d | 27/11/2026 (Vie) | 27/11/2026 (Vie) | 4.10 | Mijail |
| 4.12 | Pedidos a domicilio y cálculo de vuelto | 1 d | 30/11/2026 (Lun) | 30/11/2026 (Lun) | 4.11 | Nilton |
| 4.13 | Botón para marcar platos agotados al instante | 1 d | 01/12/2026 (Mar) | 01/12/2026 (Mar) | 4.12 | Nilton |
| 4.14 | Registro de pollos quemados o devueltos | 1 d | 01/12/2026 (Mar) | 01/12/2026 (Mar) | 4.13 | Mijail |
| 4.15 | Prueba completa de pantallas e impresoras | 1 d | 01/12/2026 (Mar) | 01/12/2026 (Mar) | 4.14 | Mijail, Nilton |
| **5** | **FASE 5: PRUEBAS Y ASEGURAMIENTO CALIDAD (QA)**| **10 d** | **02/12/2026 (Mié)** | **17/12/2026 (Jue)** | **4** | **Nilton** |
| 5.1 | Plan de pruebas del sistema | 1 d | 02/12/2026 (Mié) | 02/12/2026 (Mié) | 4.15 | Nilton |
| 5.2 | Lista de casos y situaciones a probar | 1 d | 03/12/2026 (Jue) | 03/12/2026 (Jue) | 5.1 | Nilton |
| 5.3 | Pruebas de cobros y cálculo de vueltos | 1 d | 04/12/2026 (Vie) | 04/12/2026 (Vie) | 5.2 | Mijail |
| 5.4 | Pruebas de la alarma sonora en cocina | 1 d | 07/12/2026 (Lun) | 07/12/2026 (Lun) | 5.3 | Nilton |
| — | *Feriado Nacional: Inmaculada Concepción* | *0 d* | *08/12/2026 (Mar)* | *08/12/2026 (Mar)* | — | *No laborable* |
| — | *Feriado Nacional: Batalla de Ayacucho* | *0 d* | *09/12/2026 (Mié)* | *09/12/2026 (Mié)* | — | *No laborable* |
| 5.5 | Prueba de varios pedidos al mismo tiempo | 1 d | 10/12/2026 (Jue) | 10/12/2026 (Jue) | 5.4 | Mijail |
| 5.6 | Prueba de funcionamiento sin internet | 1 d | 11/12/2026 (Vie) | 11/12/2026 (Vie) | 5.5 | Mijail, Nilton |
| 5.7 | Prueba de respaldo ante corte de luz | 1 d | 14/12/2026 (Lun) | 14/12/2026 (Lun) | 5.6 | Nilton |
| 5.8 | Lista de errores encontrados para corregir | 1 d | 15/12/2026 (Mar) | 15/12/2026 (Mar) | 5.7 | Nilton |
| 5.9 | Corrección de los errores detectados | 1 d | 16/12/2026 (Mié) | 16/12/2026 (Mié) | 5.8 | Mijail, Nilton |
| 5.10 | Segunda revisión para verificar correcciones | 1 d | 17/12/2026 (Jue) | 17/12/2026 (Jue) | 5.9 | Nilton |
| 5.11 | Pruebas del sistema con el dueño y mozos | 1 d | 17/12/2026 (Jue) | 17/12/2026 (Jue) | 5.10 | Cliente / Dueño |
| **6** | **FASE 6: DESPLIEGUE Y CIERRE EN LOCAL** | **5 d** | **18/12/2026 (Vie)** | **24/12/2026 (Jue)** | **5** | **Nilton** |
| 6.1 | Instalación de la computadora de caja | 1 d | 18/12/2026 (Vie) | 18/12/2026 (Vie) | 5.11 | Nilton |
| 6.2 | Instalación de la red y WiFi del local | 1 d | 21/12/2026 (Lun) | 21/12/2026 (Lun) | 6.1 | Nilton |
| 6.3 | Puesta en marcha del sistema en internet | 1 d | 22/12/2026 (Mar) | 22/12/2026 (Mar) | 6.2 | Mijail |
| 6.4 | Instalación de impresora con alarma en cocina | 1 d | 22/12/2026 (Mar) | 22/12/2026 (Mar) | 6.3 | Nilton |
| 6.5 | Colocación de códigos QR en las 10 mesas | 1 d | 23/12/2026 (Mié) | 23/12/2026 (Mié) | 6.4 | Nilton |
| 6.6 | Manual de uso sencillo para mozos (PDF) | 1 d | 23/12/2026 (Mié) | 23/12/2026 (Mié) | 5.11 | Nilton |
| 6.7 | Manual técnico y copias de seguridad | 1 d | 23/12/2026 (Mié) | 23/12/2026 (Mié) | 6.5 | Mijail |
| 6.8 | Enseñanza del uso del sistema al cocinero | 1 d | 24/12/2026 (Jue) | 24/12/2026 (Jue) | 6.7 | Nilton |
| 6.9 | Enseñanza de cobros y cierre de caja | 1 d | 24/12/2026 (Jue) | 24/12/2026 (Jue) | 6.8 | Mijail |
| 6.10 | Enseñanza del uso de tablets a los mozos | 1 d | 24/12/2026 (Jue) | 24/12/2026 (Jue) | 6.8 | Nilton |
| 6.11 | Firma de conformidad con el dueño | Hito | 24/12/2026 (Jue) | 24/12/2026 (Jue) | 6.10 | Cliente / Dueño |
| 6.12 | Entrega final del proyecto terminado | Hito | 24/12/2026 (Jue) | 24/12/2026 (Jue) | 6.11 | Mijail, Nilton |

---

# APÉNDICE TÉCNICO: FÓRMULAS DE EXCEL AUDITADAS

### Fórmulas para la `Hoja de costos`
```excel
A4    =C4/30                             => 0.3000 (Meses Fase 1: 9 días)
A5    =C5/30                             => 0.3000 (Meses Fase 2: 9 días)
A6    =C6/31                             => 0.5806 (Meses Fase 3: 18 días)
A7    =C7/30                             => 0.5333 (Meses Fase 4: 16 días)
A8    =C8/31                             => 0.3548 (Meses Fase 5: 11 días)
A9    =C9/31                             => 0.1613 (Meses Fase 6: 5 días)

N4    =E$2*E4*$A4                        => Costo Jefe Fase 1 (S/. 270.00)
W4    =SUM(N4:V4)                        => Costo Total Fase 1 (S/. 1,253.25)
W10   =SUM(W4:W9)                        => Total Sueldos Junior (S/. 9,403.04)

'Consolidado Mensual Mijail y Nilton':
N14 (Mijail Mes 1) = (N4+P4+S4+U4)+(N5+P5+S5+U5) => 1,377.00
O14 (Nilton Mes 1) = (O4+Q4+R4+T4+V4)+(O5+Q5+R5+T5+V5) => 1,151.25
N15 (Mijail Mes 2) = (N6+P6+S6+U6)               => 1,149.68
O15 (Nilton Mes 2) = (O6+Q6+R6+T6+V6)             => 1,287.58
N16 (Mijail Mes 3) = (N7+P7+S7+U7)               => 1,040.00
O16 (Nilton Mes 3) = (O7+Q7+R7+T7+V7)             => 1,214.67
N17 (Mijail Mes 4) = (N8+P8+S8+U8)+(N9+P9+S9+U9) => 1,183.87
O17 (Nilton Mes 4) = (O8+Q8+R8+T8+V8)+(O9+Q9+R9+T9+V9) => 999.00
Q18 = SUM(N18:O18)                                => 9,403.04 (Cuadre Exacto)
```

### Fórmulas para `TIR-VAN`
```excel
E14   ='Hoja de costos'!W10              => 9,403.04 (Enlace dinámico)
F14   ='Recursos'!D49                    => 6,120.63 (Enlace dinámico)
G14   =SUM(E14:F14)                      => 15,523.67 (Costo Base Llave en Mano)
H14   =G14*H15                           => 4,657.10 (Margen Utilidad 30%)
G16   =G14+H14                           => 20,180.77 (Precio Normal de Venta)
E16   =G16-(G16*5%)                      => 19,171.73 (Precio Descuento 5%)
F16   =(G16+E16)/2                       => 19,676.25 (Inversión Inicial I0 Año 0)
H16   =I16-(I16*I14)                     => 65,600.00 (Ingreso Neto Año 1 sin IGV)

'Flujo de Caja':
C10   =-F16                              => -19,676.25 (Año 0 Negativo)
D10   =D5-D6                             => 56,800.00 (Flujo Neto Año 1)
E10   =E5-E6                             => 60,736.00 (Flujo Neto Año 2: +6% ingresos)
F10   =F5-F6                             => 64,908.16 (Flujo Neto Año 3)
G10   =G5-G6                             => 69,330.65 (Flujo Neto Año 4)
H10   =H5-H6                             => 74,018.49 (Flujo Neto Año 5)

'Indicadores Financieros':
C12   =C10+NPV(F12, D10:H10)             => 140,939.08 (VAN con tasa 25%)
C13   =IRR(C10:H10)                      => 2.8765 (TIR = 287.65%)

'Flujo Acumulado Payback':
C27   =C10                               => -19,676.25 (Año 0)
D27   =C27+D10                           => +37,123.75 (Recuperación en Año 1)
E27   =D27+E10                           => +97,859.75
F27   =E27+F10                           => +162,767.91
G27   =F27+G10                           => +232,098.56
H27   =G27+H10                           => +306,117.05
```

### Fórmulas para el `Diagrama de Gantt` (Lunes a Viernes)
```excel
Fila 3 (Línea de tiempo de Lunes a Viernes):
H3    =D4                                => 2026-09-17 (Jueves de Inicio)
I3    =WORKDAY(H3, 1, $C$108:$C$114)     => Siguiente día hábil de Lunes a Viernes sin feriados

Barras de Gantt con Formato Condicional (H5:DB86):
=AND(H$3>=$D5, H$3<=$E5)                 => Se pinta de color durante la tarea

Cálculo de Duración Total:
D100  =NETWORKDAYS(D4, E86, C108:C114)   => 68 Días Laborables
```
