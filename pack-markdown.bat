@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0build\pack.ps1"
if errorlevel 1 (
  echo.
  echo Markdown package failed.
  pause
  exit /b 1
)
echo.
echo Package created in artifacts\release
pause
