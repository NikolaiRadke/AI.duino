@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM Configuration
set "EXTENSIONS_DIR=%USERPROFILE%\.arduinoIDE\extensions"
set "VSIX_FILE=%~dp0aiduino.vsix"

REM Colors
set "GREEN=[92m"
set "BLUE=[94m"
set "RED=[91m"
set "NC=[0m"

echo %BLUE%AI.duino Extension Installer%NC%
echo ================================
echo.

REM Check if VSIX exists
if not exist "%VSIX_FILE%" (
    echo %RED%Error: aiduino.vsix not found%NC%
    pause
    exit /b 1
)

REM Create extensions directory
if not exist "%EXTENSIONS_DIR%" (
    echo Creating extensions directory...
    mkdir "%EXTENSIONS_DIR%"
)

REM Copy VSIX (overwrite existing)
echo Installing AI.duino extension...
copy /Y "%VSIX_FILE%" "%EXTENSIONS_DIR%\" >nul

if %ERRORLEVEL% equ 0 (
    echo %GREEN%✓ Extension installed successfully!%NC%
    echo.
    echo Location: %EXTENSIONS_DIR%\aiduino.vsix
    echo.
    echo Restart Arduino IDE to use the extension.
) else (
    echo %RED%✗ Installation failed%NC%
)

echo.
pause
