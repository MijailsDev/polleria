# ==============================================================================
# SCRIPT DE EXPORTACION A EXCEL PARA EL PROYECTO POLLERIA
# Genera dos libros oficiales de Excel con formulas dinamicas, formatos y Gantt:
# 1. Estudio_de_Factibilidad_Polleria.xlsx (Hojas: Hoja de costos, Recursos de desarrollo, TIR-VAN)
# 2. Diagrama_de_Gantt_Polleria.xlsx (Hoja: diagrama gantt 7)
# ==============================================================================

param(
    [string]$OutputDir = (Join-Path $PSScriptRoot "..\entregables_excel")
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "Iniciando generacion de libros de Excel mediante Excel COM..." -ForegroundColor Cyan

$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false

function Set-Cell($sheet, $row, $col, $val) {
    $cell = $sheet.Cells.Item($row, $col)
    $cell.Formula = [string]$val
}

function Set-CellFormula($sheet, $row, $col, $val) {
    $cell = $sheet.Cells.Item($row, $col)
    $cell.Formula = [string]$val
}

function Set-Borders($ws, $rangeStr) {
    $rng = $ws.Range($rangeStr)
    for ($i = 7; $i -le 10; $i++) {
        $rng.Borders.Item($i).LineStyle = 1 # xlContinuous
        $rng.Borders.Item($i).Weight = 2 # xlThin
        $rng.Borders.Item($i).Color = 0xD0D0D0
    }
}

try {
    # --------------------------------------------------------------------------
    # ARCHIVO 1: Estudio_de_Factibilidad_Polleria.xlsx
    # --------------------------------------------------------------------------
    $factPath = Join-Path $OutputDir "Estudio_de_Factibilidad_Polleria.xlsx"
    Write-Host "Generando: $factPath" -ForegroundColor Yellow

    $wbFact = $xl.Workbooks.Add()
    while ($wbFact.Worksheets.Count -gt 1) {
        $wbFact.Worksheets.Item(2).Delete()
    }
    
    $wsCostos = $wbFact.Worksheets.Item(1)
    $wsCostos.Name = "Hoja de costos"
    $wsRecursos = $wbFact.Worksheets.Add([System.Type]::Missing, $wsCostos)
    $wsRecursos.Name = "Recursos de desarrollo"
    $wsTirVan = $wbFact.Worksheets.Add([System.Type]::Missing, $wsRecursos)
    $wsTirVan.Name = "TIR-VAN"

    # --------------------------------------------------------------------------
    # HOJA 1: Hoja de costos
    # --------------------------------------------------------------------------
    Write-Host "  -> Configurando 'Hoja de costos'..." -ForegroundColor Gray
    
    Set-Cell $wsCostos 1 4 "Rol"
    Set-Cell $wsCostos 2 4 "Sueldo"
    Set-Cell $wsCostos 3 4 "Persona Asignada"

    $roles = @(
        @{ Col=5; Name="Jefe de Proyecto"; Sal=1800; Dev="Mijail"; ColLet="E" },
        @{ Col=6; Name="Analista"; Sal=1400; Dev="Nilton"; ColLet="F" },
        @{ Col=7; Name="Programador 1"; Sal=1500; Dev="Mijail"; ColLet="G" },
        @{ Col=8; Name="Programador 2"; Sal=1500; Dev="Nilton"; ColLet="H" },
        @{ Col=9; Name="Programador 3"; Sal=1400; Dev="Nilton"; ColLet="I" },
        @{ Col=10; Name="DBA"; Sal=1500; Dev="Mijail"; ColLet="J" },
        @{ Col=11; Name="Auditor"; Sal=1200; Dev="Nilton"; ColLet="K" },
        @{ Col=12; Name="Diseno"; Sal=1200; Dev="Mijail"; ColLet="L" },
        @{ Col=13; Name="Docum."; Sal=1025; Dev="Nilton"; ColLet="M" }
    )

    foreach ($r in $roles) {
        Set-Cell $wsCostos 1 $r.Col $r.Name
        Set-Cell $wsCostos 2 $r.Col $r.Sal
        Set-Cell $wsCostos 3 $r.Col $r.Dev
    }
    $wsCostos.Range("E2:M2").NumberFormat = '"S/." #,##0.00'

    # Encabezados de tabla de Fases
    Set-Cell $wsCostos 3 1 "Meses"
    Set-Cell $wsCostos 3 2 "Fase"
    Set-Cell $wsCostos 3 3 "Dias"
    
    # Encabezados de columnas de costo por rol (Cols N a W)
    $costCols = @("Jefe de Proyecto", "Analista", "Programador 1", "Programador 2", "Programador 3", "DBA", "Auditor", "Disenador", "Documentador", "Total")
    for ($c = 0; $c -lt $costCols.Count; $c++) {
        Set-Cell $wsCostos 3 (14 + $c) $costCols[$c]
    }

    $fasesData = @(
        @{ Row=4; Name="Planificacion y analisis"; Dias=9; Div=30; Resp="Mijail"; Ded=@(0.5, 0.5, 0.2, 0.2, 0.1, 0.3, 0.4, 0.5, 0.3) },
        @{ Row=5; Name="Diseno de Arquitectura y UI"; Dias=9; Div=30; Resp="Mijail"; Ded=@(0.5, 0.4, 0.5, 0.2, 0.2, 0.3, 0.3, 0.2, 0.4) },
        @{ Row=6; Name="Desarr. Ciclo 1"; Dias=18; Div=31; Resp="Mijail"; Ded=@(0.3, 0.2, 0.5, 0.5, 0.2, 0.3, 0.5, 0.2, 0.3) },
        @{ Row=7; Name="Desarr. Ciclo 2"; Dias=16; Div=30; Resp="Nilton"; Ded=@(0.3, 0.2, 0.2, 0.5, 0.5, 0.5, 0.2, 0.3, 0.3) },
        @{ Row=8; Name="Pruebas y QA"; Dias=11; Div=31; Resp="Nilton"; Ded=@(0.5, 0.5, 0.3, 0.25, 0.2, 0.3, 0.3, 0.4, 0.25) },
        @{ Row=9; Name="Despliegue y DOC"; Dias=5; Div=31; Resp="Nilton"; Ded=@(0.5, 0.3, 0.5, 0.1, 0.1, 0.3, 0.4, 0.2, 0.6) }
    )

    foreach ($f in $fasesData) {
        $r = $f.Row
        Set-Cell $wsCostos $r 2 $f.Name
        Set-Cell $wsCostos $r 3 $f.Dias
        Set-Cell $wsCostos $r 4 $f.Resp
        Set-Cell $wsCostos $r 1 "=C$r/$($f.Div)"

        for ($k = 0; $k -lt 9; $k++) {
            $colDed = 5 + $k
            $colCost = 14 + $k
            Set-Cell $wsCostos $r $colDed $f.Ded[$k]
            $roleLetter = [char](69 + $k)
            Set-Cell $wsCostos $r $colCost "=${roleLetter}`$2*${roleLetter}${r}*`$A${r}"
        }
        Set-Cell $wsCostos $r 23 "=SUM(N${r}:V${r})"
    }

    # Fila de Totales de Fases (Fila 10)
    Set-Cell $wsCostos 10 2 "TOTAL"
    Set-Cell $wsCostos 10 3 "=SUM(C4:C9)"
    Set-Cell $wsCostos 10 1 "=SUM(A4:A9)"
    for ($k = 0; $k -lt 9; $k++) {
        $colCost = 14 + $k
        Set-Cell $wsCostos 10 $colCost "=SUM($([char](78+$k))4:$([char](78+$k))9)"
    }
    Set-Cell $wsCostos 10 23 "=SUM(N10:V10)"

    # Formatos
    $wsCostos.Range("A4:A10").NumberFormat = '0.0000'
    $wsCostos.Range("E4:M9").NumberFormat = '0.0%'
    $wsCostos.Range("N4:W10").NumberFormat = '"S/." #,##0.00'

    # Consolidado Mensual de Trabajadores (Mijail y Nilton)
    Set-Cell $wsCostos 12 13 "Mes"
    Set-Cell $wsCostos 12 14 "Mijail"
    Set-Cell $wsCostos 12 15 "Nilton"
    Set-Cell $wsCostos 12 17 "Total"

    Set-Cell $wsCostos 14 13 1
    Set-Cell $wsCostos 14 14 "=(N4+P4+S4+U4)+(N5+P5+S5+U5)"
    Set-Cell $wsCostos 14 15 "=(O4+Q4+R4+T4+V4)+(O5+Q5+R5+T5+V5)"
    Set-Cell $wsCostos 14 17 "=N14+O14"

    Set-Cell $wsCostos 15 13 2
    Set-Cell $wsCostos 15 14 "=(N6+P6+S6+U6)"
    Set-Cell $wsCostos 15 15 "=(O6+Q6+R6+T6+V6)"
    Set-Cell $wsCostos 15 17 "=N15+O15"

    Set-Cell $wsCostos 16 13 3
    Set-Cell $wsCostos 16 14 "=(N7+P7+S7+U7)"
    Set-Cell $wsCostos 16 15 "=(O7+Q7+R7+T7+V7)"
    Set-Cell $wsCostos 16 17 "=N16+O16"

    Set-Cell $wsCostos 17 13 4
    Set-Cell $wsCostos 17 14 "=(N8+P8+S8+U8)+(N9+P9+S9+U9)"
    Set-Cell $wsCostos 17 15 "=(O8+Q8+R8+T8+V8)+(O9+Q9+R9+T9+V9)"
    Set-Cell $wsCostos 17 17 "=N17+O17"

    Set-Cell $wsCostos 18 13 "Total"
    Set-Cell $wsCostos 18 14 "=SUM(N14:N17)"
    Set-Cell $wsCostos 18 15 "=SUM(O14:O17)"
    Set-Cell $wsCostos 18 17 "=SUM(N18:O18)"
    $wsCostos.Range("N14:Q18").NumberFormat = '"S/." #,##0.00'

    # Estilos cabeceras Hoja de costos
    $wsCostos.Range("A3:W3").Font.Bold = $true
    $wsCostos.Range("A3:W3").Interior.Color = 0x2E7D32
    $wsCostos.Range("A3:W3").Font.Color = 0xFFFFFF
    $wsCostos.Range("A10:W10").Font.Bold = $true
    $wsCostos.Range("A10:W10").Interior.Color = 0xE8F5E9
    $wsCostos.Range("M12:Q12").Font.Bold = $true
    $wsCostos.Range("M12:Q12").Interior.Color = 0x1565C0
    $wsCostos.Range("M12:Q12").Font.Color = 0xFFFFFF
    $wsCostos.Range("M18:Q18").Font.Bold = $true

    Set-Borders $wsCostos "A3:W10"
    Set-Borders $wsCostos "M12:Q18"
    $wsCostos.Columns.AutoFit() | Out-Null

    # --------------------------------------------------------------------------
    # HOJA 2: Recursos de desarrollo
    # --------------------------------------------------------------------------
    Write-Host "  -> Configurando 'Recursos de desarrollo'..." -ForegroundColor Gray
    
    # 2.1 Hardware de desarrollo
    Set-Cell $wsRecursos 2 2 "2.1 Hardware de desarrollo (Desgaste 3 meses del proyecto)"
    $wsRecursos.Range("B2:K2").Font.Bold = $true

    $hwHeaders = @("Nombre", "Modelo", "Cantidad", "Depreciacion (mensual)", "Costo unit.", "Costo total", "Depreciacion Periodo (3m)", "", "Precio de venta residual")
    $hwCols = @(2, 3, 5, 6, 7, 8, 9, 10, 11)
    for ($i = 0; $i -lt $hwHeaders.Count; $i++) {
        if ($hwHeaders[$i] -ne "") {
            Set-Cell $wsRecursos 3 $hwCols[$i] $hwHeaders[$i]
        }
    }

    # Laptop Gamer Dev (Fila 4) - Depreciacion al 25% anual SUNAT para 3 meses del proyecto
    Set-Cell $wsRecursos 4 2 "Laptop Gamer Dev"
    Set-Cell $wsRecursos 4 3 "Asus/Lenovo Ryzen 7 Dev"
    Set-Cell $wsRecursos 4 5 2
    Set-Cell $wsRecursos 4 7 2500
    Set-Cell $wsRecursos 4 6 "=(G4*25%)/12"
    Set-Cell $wsRecursos 4 8 "=E4*G4"
    Set-Cell $wsRecursos 4 9 "=E4*F4*3"
    Set-Cell $wsRecursos 4 11 "=H4-I4"

    # Mouse Optico Dev (Fila 5)
    Set-Cell $wsRecursos 5 2 "Mouse Optico Dev"
    Set-Cell $wsRecursos 5 3 "Logitech M90 USB Dev"
    Set-Cell $wsRecursos 5 5 2
    Set-Cell $wsRecursos 5 7 25
    Set-Cell $wsRecursos 5 6 "=(G5*25%)/12"
    Set-Cell $wsRecursos 5 8 "=E5*G5"
    Set-Cell $wsRecursos 5 9 "=E5*F5*3"
    Set-Cell $wsRecursos 5 11 "=H5-I5"

    # Totales Hardware (Fila 17)
    Set-Cell $wsRecursos 17 2 "Total Hardware Dev"
    Set-Cell $wsRecursos 17 5 "=SUM(E4:E16)"
    Set-Cell $wsRecursos 17 6 "=SUM(F4:F16)"
    Set-Cell $wsRecursos 17 7 "=SUM(G4:G16)"
    Set-Cell $wsRecursos 17 8 "=SUM(H4:H16)"
    Set-Cell $wsRecursos 17 9 "=SUM(I4:I16)"
    Set-Cell $wsRecursos 17 11 "=SUM(K4:K16)"
    $wsRecursos.Range("F4:K17").NumberFormat = '"S/." #,##0.00'

    # 2.2 Software y Herramientas (Fila 19)
    Set-Cell $wsRecursos 19 2 "2.2 Software de herramientas (Licencias Comerciales Gratuitas S/. 0.00)"
    $wsRecursos.Range("B19").Font.Bold = $true
    $swItems = @("Visual Studio Code / Monorepo", "NestJS / Next.js Frameworks (MIT)", "PostgreSQL 16 Engine & Redis (Libre)", "Docker Engine Community", "Figma Free Plan")
    for ($si = 0; $si -lt $swItems.Count; $si++) {
        $rowSw = 21 + $si
        Set-Cell $wsRecursos $rowSw 2 $swItems[$si]
        Set-Cell $wsRecursos $rowSw 3 0
        Set-Cell $wsRecursos $rowSw 4 1
        Set-Cell $wsRecursos $rowSw 5 0
    }
    Set-Cell $wsRecursos 26 2 "TOTAL SOFTWARE"
    Set-Cell $wsRecursos 26 5 "=SUM(E21:E25)"

    # 2.3 Hardware de implementacion en local (Proyecto Llave en Mano - Equipos Polleria)
    Set-Cell $wsRecursos 28 2 "2.3 Hardware Operativo Fisico para la Polleria (Instalacion en Local - Llave en Mano)"
    $wsRecursos.Range("B28").Font.Bold = $true

    Set-Cell $wsRecursos 29 2 "Item"
    Set-Cell $wsRecursos 29 3 "Cant."
    Set-Cell $wsRecursos 29 5 "Costo Unit. (S/.)"
    Set-Cell $wsRecursos 29 7 "Costo Total (S/.)"

    Set-Cell $wsRecursos 30 2 "Equipos de Red, Servidor Local, Terminal Tactil, Ticketeras Buzzer y Tablet Mozo"
    Set-Cell $wsRecursos 30 3 1
    Set-Cell $wsRecursos 30 5 5100
    Set-Cell $wsRecursos 30 7 "=C30*E30"

    Set-Cell $wsRecursos 33 2 "Total Hardware de Implementacion Local"
    Set-Cell $wsRecursos 33 7 "=SUM(G30:G32)"
    $wsRecursos.Range("E30:G33").NumberFormat = '"S/." #,##0.00'

    # 2.4 Servicios y operatividad
    Set-Cell $wsRecursos 35 2 "2.4 Servicios y operatividad de desarrollo"
    $wsRecursos.Range("B35").Font.Bold = $true

    $servicios = @(
        @{ Row=37; Name="Internet Fibra y Datos Moviles Pruebas QR 4G/5G"; Mes=200; Tot=200 },
        @{ Row=38; Name="Servidor Cloud VPS DigitalOcean (Just-in-Time Fase 3: 2.3 meses)"; Mes=23; Tot=55 },
        @{ Row=39; Name="Energia Electrica Imputada Laptops Dev y Ticketeras"; Mes=150; Tot=150 },
        @{ Row=40; Name="Movilidad y Visitas Tecnicas de Campo (Puerto Maldonado)"; Mes=300; Tot=300 },
        @{ Row=41; Name="Agua y Servicios Higienicos (Dev Station)"; Mes=0; Tot=0 }
    )

    foreach ($s in $servicios) {
        Set-Cell $wsRecursos $s.Row 2 $s.Name
        Set-Cell $wsRecursos $s.Row 7 $s.Mes
        Set-Cell $wsRecursos $s.Row 8 $s.Tot
    }
    Set-Cell $wsRecursos 42 2 "Total de Servicios"
    Set-Cell $wsRecursos 42 7 "=SUM(G37:G41)"
    Set-Cell $wsRecursos 42 8 "=SUM(H37:H41)"
    $wsRecursos.Range("G37:H42").NumberFormat = '"S/." #,##0.00'

    # 2.5 Resumen y Costo Total de Recursos (D44:D49)
    Set-Cell $wsRecursos 44 2 "Resumen de Recursos y Equipamiento"
    $wsRecursos.Range("B44").Font.Bold = $true

    Set-Cell $wsRecursos 45 2 "1. Hardware Operativo Fisico para la Polleria (Llave en Mano)"
    Set-CellFormula $wsRecursos 45 4 "=G33"

    Set-Cell $wsRecursos 46 2 "2. Servicios Operativos Desarrollo (VPS JIT/Movilidad/Luz)"
    Set-CellFormula $wsRecursos 46 4 "=H42"

    Set-Cell $wsRecursos 47 2 "3. Depreciacion Activos Dev (2 Laptops 3 meses)"
    Set-CellFormula $wsRecursos 47 4 "=I17"

    Set-Cell $wsRecursos 48 2 "4. Mobiliario de Oficina (Eliminado - Estaciones propias)"
    Set-Cell $wsRecursos 48 4 0

    Set-Cell $wsRecursos 49 2 "Total Recursos de Desarrollo y Hardware Local"
    Set-CellFormula $wsRecursos 49 4 "=SUM(D45:D48)"

    $wsRecursos.Range("D45:D49").NumberFormat = '"S/." #,##0.00'
    $wsRecursos.Range("B49:D49").Font.Bold = $true
    $wsRecursos.Range("B49:D49").Interior.Color = 0xFFECB3

    Set-Borders $wsRecursos "B3:K17"
    Set-Borders $wsRecursos "B29:G33"
    Set-Borders $wsRecursos "B36:H42"
    Set-Borders $wsRecursos "B44:D49"
    $wsRecursos.Columns.AutoFit() | Out-Null

    # --------------------------------------------------------------------------
    # HOJA 3: TIR-VAN
    # --------------------------------------------------------------------------
    Write-Host "  -> Configurando 'TIR-VAN'..." -ForegroundColor Gray
    
    # Parametros base
    Set-Cell $wsTirVan 14 4 250 # D14 Operacion mensual
    Set-Cell $wsTirVan 15 4 "Operacion mensual"

    Set-Cell $wsTirVan 16 4 400 # D16 Mantenimiento mensual
    Set-Cell $wsTirVan 17 4 "Mantenimiento mensual"

    Set-Cell $wsTirVan 12 6 0.25 # F12 Tasa de descuento COK
    Set-Cell $wsTirVan 12 5 "Tasa (COK)"

    Set-Cell $wsTirVan 15 8 0.30 # H15 Margen 30%
    Set-Cell $wsTirVan 14 9 0.18 # I14 IGV 18%
    Set-Cell $wsTirVan 15 9 "IGV"

    Set-Cell $wsTirVan 16 9 80000 # I16 Ingreso Bruto Anual
    Set-Cell $wsTirVan 17 9 "Ingreso anual"

    Set-CellFormula $wsTirVan 14 5 "='Hoja de costos'!W10" # E14 Sueldo
    Set-Cell $wsTirVan 15 5 "Sueldo"

    Set-CellFormula $wsTirVan 14 6 "='Recursos de desarrollo'!D49" # F14 Recursos
    Set-Cell $wsTirVan 15 6 "Recursos"

    Set-CellFormula $wsTirVan 14 7 "=SUM(E14:F14)" # G14 Inversion Base
    Set-Cell $wsTirVan 15 7 "Inversion Base"

    Set-CellFormula $wsTirVan 14 8 "=G14*H15" # H14 Utilidad 30%

    Set-CellFormula $wsTirVan 16 7 "=G14+H14" # G16 Precio Normal
    Set-Cell $wsTirVan 17 7 "Precio normal"

    Set-CellFormula $wsTirVan 16 5 "=G16-G16*5%" # E16 Descuento 5%
    Set-Cell $wsTirVan 17 5 "Descuento del 5%"

    Set-CellFormula $wsTirVan 16 6 "=(G16+E16)/2" # F16 Precio Negociable I0
    Set-Cell $wsTirVan 17 6 "Precio negociable (I0)"

    Set-CellFormula $wsTirVan 16 8 "=I16-I16*I14" # H16 Ingresos netos
    Set-Cell $wsTirVan 17 8 "Ingresos netos"

    # Formatos de parametros
    $wsTirVan.Range("D14:G14").NumberFormat = '"S/." #,##0.00'
    $wsTirVan.Range("H14").NumberFormat = '"S/." #,##0.00'
    $wsTirVan.Range("H15").NumberFormat = '0.0%'
    $wsTirVan.Range("I14").NumberFormat = '0.0%'
    $wsTirVan.Range("D16:H16").NumberFormat = '"S/." #,##0.00'
    $wsTirVan.Range("I16").NumberFormat = '"S/." #,##0.00'
    $wsTirVan.Range("F12").NumberFormat = '0.0%'

    # Flujo de caja proyectado a 5 anos (C3:H10)
    Set-Cell $wsTirVan 3 2 "Concepto"
    $anios = @("Ano 0", "Ano 1", "Ano 2", "Ano 3", "Ano 4", "Ano 5")
    for ($a = 0; $a -lt $anios.Count; $a++) {
        Set-Cell $wsTirVan 3 (3 + $a) $anios[$a]
    }

    # Fila 7: Inversion Inicial
    Set-Cell $wsTirVan 7 2 "Inversion"
    Set-CellFormula $wsTirVan 7 3 "=F16"
    for ($c = 4; $c -le 8; $c++) { Set-Cell $wsTirVan 7 $c 0 }

    # Fila 8: Operacion Anual
    Set-Cell $wsTirVan 8 2 "Operacion"
    Set-Cell $wsTirVan 8 3 0
    for ($c = 4; $c -le 8; $c++) {
        Set-CellFormula $wsTirVan 8 $c "=`$D`$14*12+`$D`$16*12"
    }

    # Fila 9: Mantenimiento Anual
    Set-Cell $wsTirVan 9 2 "Mantenimiento"
    Set-Cell $wsTirVan 9 3 0
    for ($c = 4; $c -le 8; $c++) {
        Set-Cell $wsTirVan 9 $c 1000
    }

    # Fila 5: Ingresos Netos
    Set-Cell $wsTirVan 5 2 "Ingresos netos"
    Set-Cell $wsTirVan 5 3 0
    Set-CellFormula $wsTirVan 5 4 "=H16"
    Set-CellFormula $wsTirVan 5 5 "=D5+D5*6%"
    Set-CellFormula $wsTirVan 5 6 "=E5+E5*6%"
    Set-CellFormula $wsTirVan 5 7 "=F5+F5*6%"
    Set-CellFormula $wsTirVan 5 8 "=G5+G5*6%"

    # Fila 6: Egresos Totales
    Set-Cell $wsTirVan 6 2 "Egresos"
    Set-CellFormula $wsTirVan 6 3 "=F16"
    Set-CellFormula $wsTirVan 6 4 "=D8+D9"
    Set-CellFormula $wsTirVan 6 5 "=E8+E9"
    Set-CellFormula $wsTirVan 6 6 "=F8+F9"
    Set-CellFormula $wsTirVan 6 7 "=G8+G9"
    Set-CellFormula $wsTirVan 6 8 "=H8+H9"

    # Fila 10: Flujo Neto
    Set-Cell $wsTirVan 10 2 "Flujo neto"
    Set-CellFormula $wsTirVan 10 3 "=C5-C6-C8-C9"
    Set-CellFormula $wsTirVan 10 4 "=D5-D6"
    Set-CellFormula $wsTirVan 10 5 "=E5-E6"
    Set-CellFormula $wsTirVan 10 6 "=F5-F6"
    Set-CellFormula $wsTirVan 10 7 "=G5-G6"
    Set-CellFormula $wsTirVan 10 8 "=H5-H6"
    $wsTirVan.Range("C5:H10").NumberFormat = '"S/." #,##0.00'

    # Indicadores: VAN y TIR (C12:C13)
    Set-Cell $wsTirVan 12 2 "VAN"
    Set-CellFormula $wsTirVan 12 3 "=C10+NPV(F12,D10:H10)"
    $wsTirVan.Range("C12").NumberFormat = '"S/." #,##0.00'

    Set-Cell $wsTirVan 13 2 "TIR"
    Set-CellFormula $wsTirVan 13 3 "=IRR(C10:H10)"
    $wsTirVan.Range("C13").NumberFormat = '0.00%'

    # Flujo Acumulado Payback (C19:H27)
    Set-Cell $wsTirVan 19 2 "Recuperacion de la inversion (Flujo Acumulado)"
    for ($a = 0; $a -lt $anios.Count; $a++) {
        Set-Cell $wsTirVan 20 (3 + $a) $anios[$a]
    }
    Set-Cell $wsTirVan 27 2 "Flujo Acumulado"
    Set-CellFormula $wsTirVan 27 3 "=C10"
    Set-CellFormula $wsTirVan 27 4 "=C27+D10"
    Set-CellFormula $wsTirVan 27 5 "=D27+E10"
    Set-CellFormula $wsTirVan 27 6 "=E27+F10"
    Set-CellFormula $wsTirVan 27 7 "=F27+G10"
    Set-CellFormula $wsTirVan 27 8 "=G27+H10"
    $wsTirVan.Range("C27:H27").NumberFormat = '"S/." #,##0.00'

    # Estilos cabecera TIR-VAN
    $wsTirVan.Range("B3:H3").Font.Bold = $true
    $wsTirVan.Range("B3:H3").Interior.Color = 0x1B5E20
    $wsTirVan.Range("B3:H3").Font.Color = 0xFFFFFF
    $wsTirVan.Range("B10:H10").Font.Bold = $true
    $wsTirVan.Range("B10:H10").Interior.Color = 0xC8E6C9

    $wsTirVan.Range("B12:C13").Font.Bold = $true
    $wsTirVan.Range("B12:C12").Interior.Color = 0xBBDEFB
    $wsTirVan.Range("B13:C13").Interior.Color = 0xC8E6C9
    $wsTirVan.Range("B27:H27").Font.Bold = $true

    Set-Borders $wsTirVan "B3:H10"
    Set-Borders $wsTirVan "B12:C13"
    Set-Borders $wsTirVan "D14:I17"
    Set-Borders $wsTirVan "B20:H27"
    $wsTirVan.Columns.AutoFit() | Out-Null

    # Guardar Estudio_de_Factibilidad_Polleria.xlsx
    if (Test-Path $factPath) { Remove-Item $factPath -Force }
    $wbFact.SaveAs($factPath)
    $wbFact.Close($false)
    Write-Host "  -> Guardado exitosamente: $factPath" -ForegroundColor Green

    # --------------------------------------------------------------------------
    # ARCHIVO 2: Diagrama_de_Gantt_Polleria.xlsx
    # --------------------------------------------------------------------------
    $ganttPath = Join-Path $OutputDir "Diagrama_de_Gantt_Polleria.xlsx"
    Write-Host "Generando: $ganttPath" -ForegroundColor Yellow

    $wbGantt = $xl.Workbooks.Add()
    $wsG = $wbGantt.Worksheets.Item(1)
    $wsG.Name = "diagrama gantt 7"

    # Encabezados de Tareas (Columnas A a G)
    Set-Cell $wsG 3 1 "ID"
    Set-Cell $wsG 3 2 "Nombre de Tarea"
    Set-Cell $wsG 3 3 "Duracion"
    Set-Cell $wsG 3 4 "Comienzo"
    Set-Cell $wsG 3 5 "Fin"
    Set-Cell $wsG 3 6 "Predece"
    Set-Cell $wsG 3 7 "Responsables"

    # Extraer las 83 tareas parseadas del markdown
    $mdPath = "c:\Users\dell\proyectos\polleria\requerimientos\estudio_de_factibilidad_y_gantt.md"
    $lines = Get-Content $mdPath -Encoding UTF8
    $inTasks = $false
    $tasksList = @()

    foreach ($line in $lines) {
        if ($line -match 'Lista Detallada de Tareas') { $inTasks = $true; continue }
        if ($inTasks -and $line -match '^#\s+AP') { $inTasks = $false; break }
        if ($inTasks -and $line -match '^\|\s*(\*{0,2}\d+(\.\d+)?\*{0,2})\s*\|') {
            $parts = $line.Split('|') | ForEach-Object { $_.Trim() }
            if ($parts.Count -ge 8 -and $parts[1] -ne 'ID') {
                $id = $parts[1] -replace '\*',''
                $nombre = $parts[2] -replace '\*',''
                $duracion = $parts[3] -replace '\*',''
                $inicio = ($parts[4] -replace '\*','' -split ' ')[0]
                $fin = ($parts[5] -replace '\*','' -split ' ')[0]
                $predec = $parts[6] -replace '\*','' -replace '—',''
                $resp = $parts[7] -replace '\*',''
                $tasksList += [PSCustomObject]@{
                    ID = $id
                    Nombre = $nombre
                    Duracion = $duracion
                    Inicio = $inicio
                    Fin = $fin
                    Predec = $predec
                    Resp = $resp
                }
            }
        }
    }

    Write-Host "  -> Insertando $($tasksList.Count) tareas en el cronograma..." -ForegroundColor Gray

    # Insertar Tareas en Filas 4 a 86
    for ($t = 0; $t -lt $tasksList.Count; $t++) {
        $row = 4 + $t
        $item = $tasksList[$t]
        $isPhase = ($item.ID -match '^\d+$')

        Set-Cell $wsG $row 1 $item.ID
        Set-Cell $wsG $row 2 $item.Nombre
        Set-Cell $wsG $row 3 $item.Duracion

        # Convertir DD/MM/YYYY a Date
        $pStart = $item.Inicio.Split('/')
        $pEnd = $item.Fin.Split('/')
        $dStart = [datetime]"$($pStart[2])-$($pStart[1])-$($pStart[0])"
        $dEnd = [datetime]"$($pEnd[2])-$($pEnd[1])-$($pEnd[0])"

        Set-Cell $wsG $row 4 $dStart.ToString("yyyy-MM-dd")
        Set-Cell $wsG $row 5 $dEnd.ToString("yyyy-MM-dd")
        Set-Cell $wsG $row 6 $item.Predec
        Set-Cell $wsG $row 7 $item.Resp

        if ($isPhase) {
            $wsG.Range("A$row:G$row").Font.Bold = $true
            $wsG.Range("A$row:G$row").Interior.Color = 0xC8E6C9
        }
    }
    $wsG.Range("D4:E86").NumberFormat = 'yyyy-mm-dd'

    # Feriados en C108:D114
    Write-Host "  -> Insertando tabla de feriados en C108:D114..." -ForegroundColor Gray
    $feriados = @(
        @{ Date="2026-10-08"; Desc="Combate de Angamos (Nacional)" },
        @{ Date="2026-11-01"; Desc="Dia de Todos los Santos (Nacional)" },
        @{ Date="2026-12-08"; Desc="Inmaculada Concepcion (Nacional)" },
        @{ Date="2026-12-09"; Desc="Batalla de Ayacucho (Nacional)" },
        @{ Date="2026-12-25"; Desc="Navidad (Nacional)" }
    )

    Set-Cell $wsG 107 3 "Feriados No Laborables Excluidos (Puerto Maldonado):"
    $wsG.Range("C107:D107").Font.Bold = $true

    for ($fi = 0; $fi -lt $feriados.Count; $fi++) {
        $rFer = 108 + $fi
        Set-Cell $wsG $rFer 3 $feriados[$fi].Date
        Set-Cell $wsG $rFer 4 $feriados[$fi].Desc
    }
    $wsG.Range("C108:C112").NumberFormat = 'yyyy-mm-dd'

    # Calculo Total de Duracion en D100
    Set-Cell $wsG 100 2 "Duracion Total Efectiva:"
    Set-CellFormula $wsG 100 4 "=NETWORKDAYS(D4,E86,C108:C114)"
    $wsG.Range("B100:D100").Font.Bold = $true

    # Linea de Tiempo (Columnas H a BU = 66 dias laborables, cols 8 a 73)
    Write-Host "  -> Configurando linea de tiempo dinamica de Lunes a Viernes (66 dias)..." -ForegroundColor Gray
    
    # H3: primer dia habil = D4 (2026-09-21)
    Set-Cell $wsG 3 8 "=D4"
    Set-Cell $wsG 2 8 1
    
    # Columnas 9 a 73 (I a BU = dias 2 a 66)
    for ($col = 9; $col -le 73; $col++) {
        $prevCell = $wsG.Cells.Item(3, $col - 1).Address($false, $false)
        Set-Cell $wsG 3 $col "=WORKDAY($prevCell, 1, `$C`$108:`$C`$114)"
        Set-Cell $wsG 2 $col ($col - 7)
    }

    # Formatos de fecha y encabezados de mes (Hasta Columna BU = 73)
    $wsG.Range("H3:BU3").NumberFormat = 'dd/mm'
    $wsG.Range("H2:BU2").HorizontalAlignment = -4108
    $wsG.Range("H3:BU3").HorizontalAlignment = -4108

    # Agrupar meses en Fila 1
    # Setiembre: H1:O1 (Cols 8 a 15 = 8 dias habiles)
    $wsG.Range("H1:O1").Merge()
    Set-Cell $wsG 1 8 "SEPTIEMBRE 2026"
    $wsG.Range("H1:O1").HorizontalAlignment = -4108
    $wsG.Range("H1:O1").Font.Bold = $true
    $wsG.Range("H1:O1").Interior.Color = 0xE0E0E0

    # Octubre: P1:AJ1 (Cols 16 a 36 = 21 dias habiles)
    $wsG.Range("P1:AJ1").Merge()
    Set-Cell $wsG 1 16 "OCTUBRE 2026"
    $wsG.Range("P1:AJ1").HorizontalAlignment = -4108
    $wsG.Range("P1:AJ1").Font.Bold = $true
    $wsG.Range("P1:AJ1").Interior.Color = 0xD7CCC8

    # Noviembre: AK1:BE1 (Cols 37 a 57 = 21 dias habiles)
    $wsG.Range("AK1:BE1").Merge()
    Set-Cell $wsG 1 37 "NOVIEMBRE 2026"
    $wsG.Range("AK1:BE1").HorizontalAlignment = -4108
    $wsG.Range("AK1:BE1").Font.Bold = $true
    $wsG.Range("AK1:BE1").Interior.Color = 0xCFD8DC

    # Diciembre: BF1:BU1 (Cols 58 a 73 = 16 dias habiles)
    $wsG.Range("BF1:BU1").Merge()
    Set-Cell $wsG 1 58 "DICIEMBRE 2026"
    $wsG.Range("BF1:BU1").HorizontalAlignment = -4108
    $wsG.Range("BF1:BU1").Font.Bold = $true
    $wsG.Range("BF1:BU1").Interior.Color = 0xC8E6C9

    # Formato Condicional para pintar las barras del Gantt en H4:BU86
    Write-Host "  -> Aplicando formato condicional a las barras del Gantt (H4:BU86)..." -ForegroundColor Gray
    $ganttRange = $wsG.Range("H4:BU86")
    $cf = $ganttRange.FormatConditions.Add(2, [System.Type]::Missing, '=AND(H$3>=$D4, H$3<=$E4)')
    $cf.Interior.Color = 0x81C784 # Verde suave para tareas activas
    $cf.Font.Color = 0x1B5E20

    # Ajustes visuales
    $wsG.Range("A3:G3").Font.Bold = $true
    $wsG.Range("A3:G3").Interior.Color = 0x2E7D32
    $wsG.Range("A3:G3").Font.Color = 0xFFFFFF
    
    $wsG.Columns.Item(1).ColumnWidth = 6   # ID
    $wsG.Columns.Item(2).ColumnWidth = 48  # Nombre de tarea
    $wsG.Columns.Item(3).ColumnWidth = 10  # Duracion
    $wsG.Columns.Item(4).ColumnWidth = 12  # Inicio
    $wsG.Columns.Item(5).ColumnWidth = 12  # Fin
    $wsG.Columns.Item(6).ColumnWidth = 10  # Predecesora
    $wsG.Columns.Item(7).ColumnWidth = 20  # Responsables

    for ($c = 8; $c -le 73; $c++) {
        $wsG.Columns.Item($c).ColumnWidth = 5.5 # Ancho optimo para fechas dd/mm
    }

    Set-Borders $wsG "A3:BU86"

    # Guardar Diagrama_de_Gantt_Polleria.xlsx
    if (Test-Path $ganttPath) { Remove-Item $ganttPath -Force }
    $wbGantt.SaveAs($ganttPath)
    $wbGantt.Close($false)
    Write-Host "  -> Guardado exitosamente: $ganttPath" -ForegroundColor Green

    Write-Host "`nEXPORTACION COMPLETADA CON EXITO!" -ForegroundColor Cyan
    Write-Host "Archivos generados en '$OutputDir':"
    Write-Host "  1. Estudio_de_Factibilidad_Polleria.xlsx" -ForegroundColor White
    Write-Host "  2. Diagrama_de_Gantt_Polleria.xlsx" -ForegroundColor White

} catch {
    Write-Host "`nError durante la generacion de Excel: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkRed
} finally {
    $xl.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($xl) | Out-Null
    [System.GC]::Collect()
    [System.GC]::WaitForPendingFinalizers()
}
