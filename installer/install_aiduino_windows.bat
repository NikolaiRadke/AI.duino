@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

echo ================================
echo AI.duino Extension Installer
echo ================================
echo.

set "EXTENSIONS_DIR=%USERPROFILE%\.arduinoIDE\extensions"
set "DEPLOYED_DIR=%USERPROFILE%\.arduinoIDE\deployedPlugins"
set "VSIX_FILE=%~dp0aiduino.vsix"

REM Prüfen, ob die VSIX-Datei vorhanden ist
if not exist "%VSIX_FILE%" (
    echo [Fehler] aiduino.vsix wurde nicht gefunden im Ordner:
    echo %~dp0
    echo Bitte stelle sicher, dass die Datei im gleichen Ordner wie dieses Installationsprogramm liegt.
    echo.
    pause
    exit /b 1
)

REM Ordner erstellen, falls nicht vorhanden
if not exist "%EXTENSIONS_DIR%" (
    echo Erstelle Erweiterungsverzeichnis...
    mkdir "%EXTENSIONS_DIR%"
)

REM Alte Version entfernen
if exist "%EXTENSIONS_DIR%\aiduino.vsix" (
    echo Entferne alte Erweiterung...
    del "%EXTENSIONS_DIR%\aiduino.vsix"
)

if exist "%DEPLOYED_DIR%\aiduino" (
    echo Entferne alte Installation...
    rmdir /s /q "%DEPLOYED_DIR%\aiduino"
)

REM Neue Datei kopieren
echo Installiere neue Erweiterung...
copy "%VSIX_FILE%" "%EXTENSIONS_DIR%\" >nul

if %ERRORLEVEL% EQU 0 (
    echo

