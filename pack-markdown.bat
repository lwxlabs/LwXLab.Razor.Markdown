@echo off
setlocal
cd /d "%~dp0"
if exist artifacts rmdir /s /q artifacts
dotnet pack "LwXLab.Markdown.csproj" -c Release -o artifacts
if errorlevel 1 (
  echo.
  echo Markdown package failed.
  pause
  exit /b 1
)
echo.
echo Created artifacts\LwXLab.Razor.Markdown.1.0.0-preview.3.nupkg
pause
