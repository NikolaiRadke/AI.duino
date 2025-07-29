@echo off
REM AI.duino v1.1 - Windows - Easy Install
REM Copyright 2025 Monster Maker
REM Licensed under Apache License 2.0

setlocal enabledelayedexpansion

echo.
echo ===============================================
echo    AI.duino v1.1 - Windows Installer
echo ===============================================
echo.

REM Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Administrator-Rechte benoetigt!
    echo.
    echo Bitte Rechtsklick auf die Datei und
    echo "Als Administrator ausfuehren" waehlen.
    echo.
    pause
    exit /b 1
)

REM Find Arduino IDE installation
echo [1/4] Suche Arduino IDE 2.x Installation...

set "PLUGIN_DIR="
set "FOUND_PATH="

REM Check common installation paths
for %%p in (
    "%ProgramFiles%\Arduino IDE\resources\app\plugins"
    "%ProgramFiles(x86)%\Arduino IDE\resources\app\plugins"
    "%LocalAppData%\Programs\Arduino IDE\resources\app\plugins"
    "%LocalAppData%\Arduino IDE\resources\app\plugins"
    "C:\Program Files\Arduino IDE\resources\app\plugins"
    "D:\Program Files\Arduino IDE\resources\app\plugins"
) do (
    if exist "%%~p" (
        set "PLUGIN_DIR=%%~p"
        set "FOUND_PATH=%%~p"
        goto :found
    )
)

:notfound
echo.
echo [ERROR] Arduino IDE 2.x nicht gefunden!
echo.
echo Bitte installiere Arduino IDE 2.x von:
echo https://www.arduino.cc/en/software
echo.
echo Falls bereits installiert, kopiere das Plugin manuell nach:
echo [Arduino IDE]\resources\app\plugins\aiduino
echo.
pause
exit /b 1

:found
echo [OK] Arduino IDE gefunden in:
echo      %FOUND_PATH%
echo.

REM Create plugin directory
echo [2/4] Erstelle Plugin-Verzeichnis...
set "TARGET=%PLUGIN_DIR%\aiduino"

REM Remove old version if exists
if exist "%TARGET%" (
    echo      Entferne alte Version...
    rmdir /s /q "%TARGET%" 2>nul
)

REM Create directories
mkdir "%TARGET%" 2>nul
mkdir "%TARGET%\extension" 2>nul
mkdir "%TARGET%\extension\out" 2>nul

if %errorLevel% neq 0 (
    echo [ERROR] Konnte Verzeichnis nicht erstellen!
    echo        Pruefe Schreibrechte fuer: %TARGET%
    pause
    exit /b 1
)

echo [OK] Plugin-Verzeichnis erstellt
echo.

REM Create package.json
echo [3/4] Erstelle package.json...
(
REM ===== PACKAGE.JSON START =====
REM Hier package.json einfuegen
REM ===== PACKAGE.JSON END =====
) > "%TARGET%\extension\package.json"

echo [OK] package.json erstellt
echo.

REM Create extension.js
echo [4/4] Erstelle extension.js...
(
REM ===== EXTENSION.JS START =====
REM Hier extension.js einfuegen
REM ===== EXTENSION.JS END =====
) > "%TARGET%\extension\out\extension.js"

echo [OK] extension.js erstellt
echo.

REM Create manifest
(
echo ^<?xml version="1.0" encoding="utf-8"?^>
echo ^<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011"^>
echo   ^<Metadata^>
echo     ^<Identity Language="en-US" Id="aiduino" Version="1.1.0" Publisher="Monster Maker"/^>
echo     ^<DisplayName^>AI.duino^</DisplayName^>
echo     ^<Description xml:space="preserve"^>KI-Hilfe fuer Arduino mit Fehler-Erklaerung und Debug-Support^</Description^>
echo   ^</Metadata^>
echo   ^<Installation^>
echo     ^<InstallationTarget Id="Microsoft.VisualStudio.Code"/^>
echo   ^</Installation^>
echo   ^<Assets^>
echo     ^<Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/^>
echo   ^</Assets^>
echo ^</PackageManifest^>
) > "%TARGET%\extension.vsixmanifest"

REM Create LICENSE
(
echo                                  Apache License
echo                            Version 2.0, January 2004
echo                         http://www.apache.org/licenses/
echo.
echo    TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION
echo.
echo    1. Definitions.
echo.
echo       "License" shall mean the terms and conditions for use, reproduction,
echo       and distribution as defined by Sections 1 through 9 of this document.
echo.
echo       "Licensor" shall mean the copyright owner or entity authorized by
echo       the copyright owner that is granting the License.
echo.
echo       "Legal Entity" shall mean the union of the acting entity and all
echo       other entities that control, are controlled by, or are under common
echo       control with that entity. For the purposes of this definition,
echo       "control" means ^(i^) the power, direct or indirect, to cause the
echo       direction or management of such entity, whether by contract or
echo       otherwise, or ^(ii^) ownership of fifty percent ^(50%%^) or more of the
echo       outstanding shares, or ^(iii^) beneficial ownership of such entity.
echo.
echo       "You" ^(or "Your"^) shall mean an individual or Legal Entity
echo       exercising permissions granted by this License.
echo.
echo    [... Rest der Apache 2.0 Lizenz ...]
echo.
echo    Copyright 2025 Monster Maker
echo.
echo    Licensed under the Apache License, Version 2.0 ^(the "License"^);
echo    you may not use this file except in compliance with the License.
echo    You may obtain a copy of the License at
echo.
echo        http://www.apache.org/licenses/LICENSE-2.0
echo.
echo    Unless required by applicable law or agreed to in writing, software
echo    distributed under the License is distributed on an "AS IS" BASIS,
echo    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
echo    See the License for the specific language governing permissions and
echo    limitations under the License.
) > "%TARGET%\LICENSE"

echo.
echo ===============================================
echo    Installation erfolgreich!
echo ===============================================
echo.
echo AI.duino v1.1 wurde installiert!
echo.
echo Naechste Schritte:
echo 1. Arduino IDE neu starten
echo 2. Druecke Strg+Shift+C oder Rechtsklick -^> AI.duino
echo 3. Gib deinen Claude, ChatGPT oder Gemini API Key ein
echo.
echo Schnellstart: Markiere Code und druecke Strg+Shift+C!
echo.
echo API Keys:
echo    Claude: https://console.anthropic.com/api-keys
echo    ChatGPT: https://platform.openai.com/api-keys
echo.
echo Lizenz: Apache 2.0 - siehe %TARGET%\LICENSE
echo.
pause
