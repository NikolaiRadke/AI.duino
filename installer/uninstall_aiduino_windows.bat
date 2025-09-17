@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM Configuration
set "EXTENSIONS_DIR=%USERPROFILE%\.arduinoIDE\extensions"
set "DEPLOYED_DIR=%USERPROFILE%\.arduinoIDE\deployedPlugins"
set "CONFIG_DIR=%USERPROFILE%\.aiduino"

REM Colors
set "GREEN=[92m"
set "BLUE=[94m"
set "RED=[91m"
set "YELLOW=[93m"
set "NC=[0m"

echo %RED%AI.duino Extension Uninstaller%NC%
echo ==================================
echo.

REM Check what will be removed
echo %YELLOW%The following will be removed:%NC%
if exist "%EXTENSIONS_DIR%\aiduino.vsix" echo   • VSIX file: %EXTENSIONS_DIR%\aiduino.vsix
if exist "%DEPLOYED_DIR%\aiduino" echo   • Deployed extension: %DEPLOYED_DIR%\aiduino
if exist "%CONFIG_DIR%" echo   • Configuration directory: %CONFIG_DIR%
echo.

REM Confirm removal
set /p "CONFIRM=Are you sure you want to uninstall AI.duino? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo %BLUE%Uninstallation cancelled.%NC%
    pause
    exit /b 0
)

echo.
echo %YELLOW%Uninstalling AI.duino...%NC%

REM Remove VSIX file
if exist "%EXTENSIONS_DIR%\aiduino.vsix" (
    echo Removing VSIX file...
    del "%EXTENSIONS_DIR%\aiduino.vsix"
    if %ERRORLEVEL% equ 0 (
        echo %GREEN%✓ VSIX file removed%NC%
    ) else (
        echo %RED%✗ Failed to remove VSIX file%NC%
    )
)

REM Remove deployed extension
if exist "%DEPLOYED_DIR%\aiduino" (
    echo Removing deployed extension...
    rmdir /s /q "%DEPLOYED_DIR%\aiduino"
    if %ERRORLEVEL% equ 0 (
        echo %GREEN%✓ Deployed extension removed%NC%
    ) else (
        echo %RED%✗ Failed to remove deployed extension%NC%
    )
)

REM Remove configuration directory
if exist "%CONFIG_DIR%" (
    echo Removing configuration directory...
    rmdir /s /q "%CONFIG_DIR%"
    if %ERRORLEVEL% equ 0 (
        echo %GREEN%✓ Configuration directory removed%NC%
    ) else (
        echo %RED%✗ Failed to remove configuration directory%NC%
    )
)

echo.
echo %GREEN%✓ AI.duino has been uninstalled!%NC%
echo.
echo %BLUE%Restart Arduino IDE to complete the removal.%NC%
echo.
pause
