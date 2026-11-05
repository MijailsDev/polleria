# =============================================================================
# Restaurar un respaldo de la base de datos del Sistema para Pollerías
#
#   powershell -ExecutionPolicy Bypass -File .\restaurar.ps1 -Archivo respaldos\polleria_2026-11-04_2330.dump
#
# ATENCIÓN: reemplaza TODOS los datos actuales de la base por los del respaldo.
# Apaga primero la API (Ctrl + C en su terminal) para que nadie escriba mientras tanto.
# =============================================================================
param([Parameter(Mandatory = $true)][string]$Archivo)
$ErrorActionPreference = 'Stop'
$aqui = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path $Archivo)) { throw "No existe el archivo $Archivo" }

$linea = Select-String -Path (Join-Path $aqui '..\app\backend\.env') -Pattern '^DATABASE_URL=' | Select-Object -First 1
$url = [uri]($linea.Line -replace '^DATABASE_URL=', '').Trim('"')
$usuario, $clave = $url.UserInfo.Split(':', 2)
$base = $url.AbsolutePath.TrimStart('/')
$pgRestore = Get-ChildItem 'C:\Program Files\PostgreSQL\*\bin\pg_restore.exe' | Sort-Object FullName -Descending | Select-Object -First 1

Write-Host "Se reemplazarán los datos de la base '$base' con $Archivo." -ForegroundColor Yellow
$ok = Read-Host 'Escribe RESTAURAR para continuar'
if ($ok -ne 'RESTAURAR') { Write-Host 'Cancelado.'; return }

$env:PGPASSWORD = [uri]::UnescapeDataString($clave)
try {
  # --clean borra cada objeto antes de recrearlo; --if-exists evita errores si falta alguno
  & $pgRestore.FullName -h $url.Host -p $url.Port -U $usuario -d $base --clean --if-exists --no-owner $Archivo
  if ($LASTEXITCODE -ne 0) { Write-Host "pg_restore terminó con advertencias ($LASTEXITCODE). Revisa los mensajes de arriba." -ForegroundColor Yellow }
  else { Write-Host 'Respaldo restaurado. Vuelve a encender la API.' -ForegroundColor Green }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
}
