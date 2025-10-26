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

REM Check if VSIX file exists
if not exist "%VSIX_FILE%" (
    echo [Error] aiduino.vsix was not found in folder:
    echo %~dp0
    echo Please make sure the file is in the same folder as this installer.
    echo.
    pause
    exit /b 1
)

REM Create folder if it doesn't exist
if not exist "%EXTENSIONS_DIR%" (
    echo Creating extension directory...
    mkdir "%EXTENSIONS_DIR%"
)

REM Remove old version
if exist "%EXTENSIONS_DIR%\aiduino.vsix" (
    echo Removing old extension...
    del "%EXTENSIONS_DIR%\aiduino.vsix"
)

if exist "%DEPLOYED_DIR%\aiduino" (
    echo Removing old installation...
    rmdir /s /q "%DEPLOYED_DIR%\aiduino"
)

REM Copy new file
echo Installing new extension...
copy "%VSIX_FILE%" "%EXTENSIONS_DIR%\" >nul

if %ERRORLEVEL% EQU 0 (
    echo
