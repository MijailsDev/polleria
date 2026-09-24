# Sistema de Gestión Web y Automatización para Pollería y Brasas

Proyecto desarrollado bajo la modalidad **"Llave en Mano"** para el curso de **Análisis y Diseño de Sistemas II** en la **Universidad Nacional Amazónica de Madre de Dios (UNAMAD)**.

---

## 👥 Información del Proyecto

* **Institución:** Universidad Nacional Amazónica de Madre de Dios (UNAMAD)
* **Escuela:** Ingeniería de Sistemas e Informática
* **Curso:** Análisis y Diseño de Sistemas II
* **Docente:** Dr. Dany Dorian Isuiza Pérez
* **Equipo de Desarrollo:** 
  * Mijail
  * Nilton
* **Periodo Oficial:** Setiembre 2026 – Diciembre 2026

---

## 📁 Estructura del Repositorio

```text
polleria/
├── entregables_excel/        # Libros oficiales de Excel con cálculos financieros y cronograma
│   ├── Diagrama_de_Gantt_Polleria.xlsx
│   └── Estudio_de_Factibilidad_Polleria.xlsx
│
├── requerimientos/           # Documentación técnica completa en formato Markdown
│   ├── casos_de_uso_y_escenarios_de_pedidos.md
│   ├── documento_de_requerimientos_v3.md
│   ├── estudio_de_factibilidad_y_gantt.md
│   ├── informe_tecnicas_recoleccion_datos.md
│   └── plan_de_inversion_y_equipamiento.md
│
├── scripts/                  # Scripts de automatización y utilitarios
│   └── generar_archivos_excel.ps1
│
├── archivos_locales/         # (Excluido en .gitignore) Archivos temporales, zips y pruebas locales
│
├── .gitignore                # Reglas de exclusión para Git (ignora archivos_locales/, temporales de Office, etc.)
└── README.md                 # Documentación general del repositorio
```

---

## ⚙️ Generación de Entregables Excel

El repositorio incluye un script en PowerShell para generar o actualizar automáticamente los libros de Excel (`.xlsx`) mediante la automatización COM de Microsoft Excel con fórmulas dinámicas, bordes y formatos:

```powershell
# Ejecutar desde la raíz del proyecto:
powershell -ExecutionPolicy Bypass -File .\scripts\generar_archivos_excel.ps1
```

Los archivos generados se guardarán automáticamente en la carpeta `entregables_excel/`.
