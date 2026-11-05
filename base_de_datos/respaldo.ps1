# =============================================================================
# Respaldo de la base de datos del Sistema para Pollerías
#
#   powershell -ExecutionPolicy Bypass -File .\respaldo.ps1
#       Crea un respaldo ahora en la carpeta respaldos\ y borra los más antiguos.
#
#   powershell -ExecutionPolicy Bypass -File .\respaldo.ps1 -Programar
#       Además programa un respaldo diario a las 23:30 (Programador de tareas de
#       Windows, con tu usuario). Ejecútalo una sola vez.
#
#   powershell -ExecutionPolicy Bypass -File .\respaldo.ps1 -Quitar
#       Quita la tarea programada.
#
#   powershell -ExecutionPolicy Bypass -File .\respaldo.ps1 -Conexion "postgresql://usuario:clave@servidor:5432/postgres"
#       Respalda la base de la nube (Supabase o Neon) en lugar de la local, con
#       conexión cifrada. Úsalo antes de cada demostración. El archivo empieza con «nube_».
#
# La contraseña se lee de app\backend\.env (DATABASE_URL); no se escribe en ningún otro lado.
# Para restaurar un respaldo: .\restaurar.ps1 -Archivo respaldos\polleria_AAAA-MM-DD_HHMM.dump
# =============================================================================
param(
  [switch]$Programar,
  [switch]$Quitar,
  [int]$Conservar = 14,
  [string]$Hora = '23:30',
  [string]$Conexion = ''
)
$ErrorActionPreference = 'Stop'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
$tarea = 'Respaldo Pollería'

if ($Quitar) {
  Unregister-ScheduledTask -TaskName $tarea -Confirm:$false -ErrorAction SilentlyContinue
  Write-Host "Tarea '$tarea' quitada." -ForegroundColor Yellow
  return
}

# Datos de conexión: los de -Conexion (base en la nube) o los del .env del backend
if ($Conexion) {
  $url = [uri]($Conexion -replace '\?.*$', '')
} else {
  $env_ = Join-Path $aqui '..\app\backend\.env'
  if (-not (Test-Path $env_)) { throw "No se encontró $env_. Copia .env.example como .env y escribe la contraseña." }
  $linea = Select-String -Path $env_ -Pattern '^DATABASE_URL=' | Select-Object -First 1
  if (-not $linea) { throw 'El .env no tiene DATABASE_URL.' }
  $url = [uri]($linea.Line -replace '^DATABASE_URL=', '').Trim('"')
}
$usuario, $clave = $url.UserInfo.Split(':', 2)
$base = $url.AbsolutePath.TrimStart('/')

$pgDump = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_dump.exe' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
if (-not $pgDump) { throw 'No se encontró pg_dump.exe en C:\Program Files\PostgreSQL.' }

$carpeta = Join-Path $aqui 'respaldos'
New-Item -ItemType Directory -Force $carpeta | Out-Null
$prefijo = if ($Conexion) { "nube_$base" } else { $base }
$archivo = Join-Path $carpeta ("{0}_{1:yyyy-MM-dd_HHmm}.dump" -f $prefijo, (Get-Date))
# La base en la nube exige conexión cifrada
if ($Conexion -and $url.Host -notin @('localhost', '127.0.0.1')) { $env:PGSSLMODE = 'require' }

$env:PGPASSWORD = [uri]::UnescapeDataString($clave)
try {
  # Formato personalizado (-Fc): comprimido y restaurable tabla por tabla con pg_restore
  & $pgDump.FullName -h $url.Host -p $url.Port -U $usuario -d $base -Fc -f $archivo
  if ($LASTEXITCODE -ne 0) { throw "pg_dump terminó con error $LASTEXITCODE" }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:PGSSLMODE -ErrorAction SilentlyContinue
}
$tamano = [math]::Round((Get-Item $archivo).Length / 1KB)
Write-Host "Respaldo creado: $archivo ($tamano KB)" -ForegroundColor Green

# Rotación: se conservan los últimos $Conservar respaldos
$viejos = Get-ChildItem $carpeta -Filter "$prefijo`_*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip $Conservar
foreach ($v in $viejos) { Remove-Item $v.FullName; Write-Host "Borrado por antigüedad: $($v.Name)" }

if ($Programar) {
  $accion = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$($MyInvocation.MyCommand.Path)`""
  $disparador = New-ScheduledTaskTrigger -Daily -At $Hora
  $ajustes = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopIfGoingOnBatteries -AllowStartIfOnBatteries
  Register-ScheduledTask -TaskName $tarea -Action $accion -Trigger $disparador -Settings $ajustes -Description 'Respaldo diario de la base de datos de la pollería' -Force | Out-Null
  Write-Host "Respaldo diario programado a las $Hora (tarea '$tarea')." -ForegroundColor Cyan
  Write-Host 'Copia de vez en cuando la carpeta respaldos a un USB o a la nube: un respaldo en la misma PC no protege si el disco se daña.'
}
