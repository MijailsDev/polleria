# =============================================================================
# Crea la base de datos "polleria" en el PostgreSQL instalado en esta PC.
#
# Uso (desde PowerShell, en esta carpeta):
#   powershell -ExecutionPolicy Bypass -File .\crear_base_de_datos.ps1
#
# Pide dos contraseñas (no se muestran al escribir):
#   1. La del usuario "postgres", la que elegiste al instalar PostgreSQL.
#   2. Una nueva para "polleria_app", el usuario con el que se conectará el sistema.
# =============================================================================
param(
  [string]$Servidor = 'localhost',
  [int]$Puerto = 5432
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$aqui = $PSScriptRoot

# Buscar psql.exe (la versión más reciente instalada)
$psql = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\psql.exe' -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.FullName -replace '.*PostgreSQL\\(\d+)\\.*', '$1') } -Descending |
        Select-Object -First 1 -ExpandProperty FullName
if (-not $psql) { throw 'No se encontró PostgreSQL en C:\Program Files\PostgreSQL. Instálalo primero.' }
Write-Host "PostgreSQL encontrado: $psql" -ForegroundColor Cyan

function Leer-Clave([string]$texto) {
  $s = Read-Host $texto -AsSecureString
  $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
}
function Ejecutar([string]$usuario, [string]$base, [string]$archivo) {
  Write-Host "`n-> $archivo" -ForegroundColor Yellow
  & $psql -h $Servidor -p $Puerto -U $usuario -d $base -v ON_ERROR_STOP=1 -q -f (Join-Path $aqui $archivo)
  if ($LASTEXITCODE -ne 0) { throw "Falló $archivo (código $LASTEXITCODE). Revisa el mensaje de arriba." }
}

$env:PGCLIENTENCODING = 'UTF8'
try {
  $superClave = Leer-Clave 'Contraseña del usuario postgres'
  $appClave = Leer-Clave 'Nueva contraseña para el usuario polleria_app (mínimo 8 caracteres)'
  if ($appClave.Length -lt 8) { throw 'La contraseña de polleria_app debe tener al menos 8 caracteres.' }

  # Paso 1: usuario y base (como postgres)
  $env:PGPASSWORD = $superClave
  $env:APP_PASS = $appClave
  Ejecutar 'postgres' 'postgres' '00_crear_usuario_y_base.sql'

  # ¿La base ya tiene las tablas? Entonces no se vuelve a crear el esquema
  $env:PGPASSWORD = $appClave
  $existe = & $psql -h $Servidor -p $Puerto -U polleria_app -d polleria -tAc "SELECT to_regclass('public.usuario') IS NOT NULL"
  if ($existe -eq 't') {
    Write-Host "`nLa base 'polleria' ya tiene las tablas creadas. No se modificó nada." -ForegroundColor Green
    Write-Host 'Si quieres empezar de cero, borra la base en pgAdmin y vuelve a ejecutar este script.'
  } else {
    # Pasos 2 a 4: esquema, comentarios y datos iniciales (como polleria_app)
    Ejecutar 'polleria_app' 'polleria' '01_esquema.sql'
    Ejecutar 'polleria_app' 'polleria' '02_comentarios.sql'
    Ejecutar 'polleria_app' 'polleria' '03_datos_iniciales.sql'
  }
  # Paso 5: ampliación (se puede repetir sin problema en una base ya creada)
  Ejecutar 'polleria_app' 'polleria' '05_ampliacion.sql'
  Ejecutar 'polleria_app' 'polleria' '04_verificar.sql'

  # Cadena de conexión para el backend (el archivo .env no se sube a GitHub)
  $url = "postgresql://polleria_app:$([uri]::EscapeDataString($appClave))@${Servidor}:$Puerto/polleria"
  [System.IO.File]::WriteAllText((Join-Path $aqui '.env'), "DATABASE_URL=$url`n", (New-Object System.Text.UTF8Encoding $false))
  Write-Host "`nListo. Base de datos 'polleria' creada en ${Servidor}:$Puerto." -ForegroundColor Green
  Write-Host "La cadena de conexión quedó en base_de_datos\.env (no se sube a GitHub)."
} finally {
  Remove-Item Env:PGPASSWORD, Env:APP_PASS -ErrorAction SilentlyContinue
}
