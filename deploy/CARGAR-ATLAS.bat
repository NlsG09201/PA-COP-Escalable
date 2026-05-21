@echo off
cd /d "%~dp0.."
echo === Carga MongoDB Atlas: sedes + admin + 15000 pacientes ===
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0cargar-atlas-completo.ps1"
echo.
pause
