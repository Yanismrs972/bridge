@echo off
rem Lance Bridge v1 (mode SIMULATION) sous le modele de permissions de Node :
rem lecture du dossier Bridge, ecriture limitee a .bridge-data, aucun processus enfant.
setlocal
set "BRIDGE_DIR=%~dp0"
if not exist "%BRIDGE_DIR%dist\src\cli.js" (
  echo [Bridge] Pas encore compile. Lancez d'abord : npm install puis npm run build
  exit /b 2
)
if not exist "%BRIDGE_DIR%.bridge-data" mkdir "%BRIDGE_DIR%.bridge-data"
node --permission --allow-fs-read="%BRIDGE_DIR%*" --allow-fs-write="%BRIDGE_DIR%.bridge-data" --allow-fs-write="%BRIDGE_DIR%.bridge-data\*" --disallow-code-generation-from-strings "%BRIDGE_DIR%dist\src\cli.js" %*
exit /b %ERRORLEVEL%
