param([switch]$SoloAplicar)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if ((git branch --show-current) -ne 'main') { throw 'Cambia a main antes de actualizar.' }
if (!$SoloAplicar) {
    git -c core.hooksPath=.git/hooks-omitidos pull --ff-only origin main
    if ($LASTEXITCODE) { throw 'Git no pudo actualizar main. Revisa los cambios locales.' }
}
$php = (Get-Command php -ErrorAction SilentlyContinue).Source
if (!$php) { $php = Get-ChildItem 'C:\wamp64\bin\php\php8.4*\php.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName }
Set-Location frontend
npm.cmd ci
if ($LASTEXITCODE) { throw 'Falló la instalación del frontend.' }
npm.cmd run build
if ($LASTEXITCODE) { throw 'Falló la compilación.' }
Set-Location ../backend
& $php artisan migrate --no-interaction
if ($LASTEXITCODE) { throw 'Falló la actualización de la base local.' }
Set-Location $PSScriptRoot
if (!$SoloAplicar) {
    $hooks = git config --get core.hooksPath
    if (!$hooks -or $hooks -eq '.githooks') {
        git config --local core.hooksPath .githooks
    } else {
        Write-Warning 'Ya existe una configuración de hooks. Usa actualizar.ps1 para las siguientes actualizaciones.'
    }
}
Write-Output 'Código, frontend y base local actualizados.'
