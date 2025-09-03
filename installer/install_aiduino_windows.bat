@echo off
REM ==============================================================================
REM AI.duino - Universal Windows Offline Installer
REM Copyright 2025 Monster Maker
REM Licensed under Apache License 2.0
REM ==============================================================================

setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1

REM Configuration
set "PLUGIN_NAME=aiduino"
set "VERSION="
set "ARCHIVE_FILE="
set "PLUGIN_DIR="
set "TEMP_DIR=%TEMP%\aiduino_install_%RANDOM%"

REM Colors (Windows 10+)
set "RED=[91m"
set "GREEN=[92m"
set "YELLOW=[93m"
set "BLUE=[94m"
set "CYAN=[96m"
set "BOLD=[1m"
set "NC=[0m"

REM Banner
:show_banner
cls
echo %CYAN%================================================================%NC%
echo %BOLD%🤖  AI.duino - Universal Offline Installer%NC%
echo %CYAN%================================================================%NC%
echo.
goto :eof

REM Main
call :show_banner

REM Find Arduino IDE
echo %BLUE%▶ Searching for Arduino IDE 2.x installation...%NC%
call :find_arduino_ide
if "!PLUGIN_DIR!"=="" (
    echo %RED%✗ Arduino IDE 2.x not found!%NC%
    echo.
    echo Please install Arduino IDE 2.x from:
    echo %BLUE%https://www.arduino.cc/en/software%NC%
    echo.
    echo Searched in:
    echo   • %PROGRAMFILES%\Arduino IDE
    echo   • %LOCALAPPDATA%\Programs\Arduino IDE
    echo   • %PROGRAMFILES(x86)%\Arduino IDE
    echo   • C:\Program Files\Arduino IDE
    echo.
    pause
    exit /b 1
)

REM Find archive
echo %BLUE%▶ Looking for AI.duino archive...%NC%
call :find_archive
if "!ARCHIVE_FILE!"=="" (
    echo %RED%✗ AI.duino archive not found!%NC%
    echo.
    echo Please place one of these files in the same directory as this installer:
    echo   • %BOLD%aiduino-x.x.x.zip%NC% ^(recommended^)
    echo   • %BOLD%aiduino.zip%NC%
    echo.
    echo Searched in:
    echo   • %~dp0
    echo   • %CD%
    echo   • %USERPROFILE%\Downloads
    echo   • %USERPROFILE%\Desktop
    echo.
    pause
    exit /b 1
)

REM Check existing installation
call :check_existing
if %ERRORLEVEL% neq 0 (
    echo %BLUE%Installation cancelled.%NC%
    pause
    exit /b 0
)

REM Install plugin
echo %BLUE%▶ Installing AI.duino...%NC%
call :install_plugin
if %ERRORLEVEL% neq 0 (
    echo %RED%✗ Installation failed!%NC%
    pause
    exit /b 1
)

REM Setup API keys
call :setup_api_keys

REM Success message
call :show_success
pause
exit /b 0

REM ========================================
REM Functions
REM ========================================

:find_arduino_ide
REM Check common installation paths
set "PATHS[0]=%PROGRAMFILES%\Arduino IDE\resources\app\plugins"
set "PATHS[1]=%LOCALAPPDATA%\Programs\Arduino IDE\resources\app\plugins"
set "PATHS[2]=%PROGRAMFILES(x86)%\Arduino IDE\resources\app\plugins"
set "PATHS[3]=C:\Program Files\Arduino IDE\resources\app\plugins"
set "PATHS[4]=%USERPROFILE%\AppData\Local\Programs\Arduino IDE\resources\app\plugins"

for /L %%i in (0,1,4) do (
    if exist "!PATHS[%%i]!" (
        set "PLUGIN_DIR=!PATHS[%%i]!"
        echo %GREEN%✓%NC% Found Arduino IDE at: %BOLD%!PATHS[%%i]:~0,-8!%NC%
        goto :eof
    )
)
goto :eof

:find_archive
REM Get script directory
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

REM Search for archives
set "SEARCH_PATHS=%SCRIPT_DIR%;%CD%;%USERPROFILE%\Downloads;%USERPROFILE%\Desktop"

for %%p in (%SEARCH_PATHS%) do (
    REM Check for versioned archives
    for %%f in ("%%p\aiduino-*.zip" "%%p\AI.duino-*.zip") do (
        if exist "%%f" (
            set "ARCHIVE_FILE=%%f"
            REM Extract version from filename
            for /f "tokens=2 delims=-" %%v in ("%%~nf") do (
                set "VERSION=%%v"
            )
            echo %GREEN%✓%NC% Found archive: %BOLD%%%f%NC%
            if not "!VERSION!"=="" echo   Version: %BOLD%v!VERSION!%NC%
            goto :eof
        )
    )
    REM Check for non-versioned archives
    for %%f in ("%%p\aiduino.zip" "%%p\AI.duino.zip") do (
        if exist "%%f" (
            set "ARCHIVE_FILE=%%f"
            echo %GREEN%✓%NC% Found archive: %BOLD%%%f%NC%
            goto :eof
        )
    )
)
goto :eof

:check_existing
if exist "%PLUGIN_DIR%\%PLUGIN_NAME%" (
    echo %YELLOW%⚠ AI.duino is already installed.%NC%
    
    REM Try to detect installed version
    if exist "%PLUGIN_DIR%\%PLUGIN_NAME%\extension\package.json" (
        for /f "tokens=2 delims=:," %%v in ('findstr /C:"\"version\"" "%PLUGIN_DIR%\%PLUGIN_NAME%\extension\package.json"') do (
            set "INSTALLED_VERSION=%%v"
            set "INSTALLED_VERSION=!INSTALLED_VERSION:"=!"
            set "INSTALLED_VERSION=!INSTALLED_VERSION: =!"
            echo   Installed version: %BOLD%v!INSTALLED_VERSION!%NC%
        )
    )
    
    REM Show version to be installed if detected
    if not "!VERSION!"=="" (
        echo   New version:       %BOLD%v!VERSION!%NC%
    )
    
    echo.
    set /p "RESPONSE=Do you want to update/reinstall? (y/n): "
    if /i not "!RESPONSE!"=="y" exit /b 1
    
    REM Backup old installation
    echo %BLUE%▶ Creating backup...%NC%
    set "BACKUP_NAME=%PLUGIN_NAME%_backup_%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
    set "BACKUP_NAME=!BACKUP_NAME: =0!"
    move "%PLUGIN_DIR%\%PLUGIN_NAME%" "%PLUGIN_DIR%\!BACKUP_NAME!" >nul 2>&1
    echo %GREEN%✓%NC% Backup created
)
exit /b 0

:install_plugin
REM Create temp directory
mkdir "%TEMP_DIR%" >nul 2>&1

REM Extract archive
echo   Extracting archive...
powershell -NoProfile -Command "Expand-Archive -Path '%ARCHIVE_FILE%' -DestinationPath '%TEMP_DIR%' -Force" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%✗ Failed to extract archive%NC%
    echo   Make sure the ZIP file is not corrupted
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
    exit /b 1
)

REM Find plugin directory in extracted files
if exist "%TEMP_DIR%\aiduino" (
    set "EXTRACT_DIR=%TEMP_DIR%\aiduino"
) else if exist "%TEMP_DIR%\AI.duino" (
    set "EXTRACT_DIR=%TEMP_DIR%\AI.duino"
) else (
    REM Files might be extracted directly
    for /d %%d in ("%TEMP_DIR%\*") do (
        if exist "%%d\extension\package.json" (
            set "EXTRACT_DIR=%%d"
            goto :found_extract
        )
    )
    REM Check if files are in root of temp dir
    if exist "%TEMP_DIR%\extension\package.json" (
        set "EXTRACT_DIR=%TEMP_DIR%"
    ) else (
        echo %RED%✗ Invalid archive structure%NC%
        rmdir /s /q "%TEMP_DIR%" >nul 2>&1
        exit /b 1
    )
)
:found_extract

REM Validate structure
if not exist "!EXTRACT_DIR!\extension\package.json" (
    echo %RED%✗ Missing extension/package.json%NC%
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
    exit /b 1
)

if not exist "!EXTRACT_DIR!\extension\out\extension.js" (
    echo %RED%✗ Missing extension/out/extension.js%NC%
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
    exit /b 1
)

REM Validate modular structure in out/
for %%d in (core utils features config) do (
    if not exist "!EXTRACT_DIR!\extension\out\%%d" (
        echo %RED%✗ Missing required directory: extension/out/%%d%NC%
        rmdir /s /q "%TEMP_DIR%" >nul 2>&1
        exit /b 1
    )
)

REM Count locales
set "LOCALE_COUNT=0"
if exist "!EXTRACT_DIR!\extension\locales" (
    for %%f in ("!EXTRACT_DIR!\extension\locales\*.json") do (
        set /a LOCALE_COUNT+=1
    )
    if !LOCALE_COUNT! gtr 0 (
        echo %GREEN%✓%NC% Found %BOLD%!LOCALE_COUNT!%NC% language^(s^):
        for %%f in ("!EXTRACT_DIR!\extension\locales\*.json") do (
            set "LOCALE_NAME=%%~nf"
            echo     • !LOCALE_NAME!
        )
    )
)

REM Copy to plugin directory
echo   Copying files...
xcopy "!EXTRACT_DIR!" "%PLUGIN_DIR%\%PLUGIN_NAME%" /E /I /Q /Y >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo %RED%✗ Failed to copy files%NC%
    echo   You may need to run this installer as Administrator
    rmdir /s /q "%TEMP_DIR%" >nul 2>&1
    exit /b 1
)

echo %GREEN%✓%NC% AI.duino installed successfully!

REM Cleanup
rmdir /s /q "%TEMP_DIR%" >nul 2>&1
exit /b 0

:setup_api_keys
echo.
echo %CYAN%================================================================%NC%
echo %BOLD%API Key Setup ^(Optional^)%NC%
echo %CYAN%================================================================%NC%
echo.
echo AI.duino supports multiple AI providers:
echo   • Claude ^(Anthropic^) - Best for code understanding
echo   • ChatGPT ^(OpenAI^) - Most versatile
echo   • Gemini ^(Google^) - Fast ^& affordable
echo   • Mistral - Good balance
echo   • Groq - Ultra-fast inference
echo   • Perplexity - Real-time web search
echo   • Cohere - Advanced text generation
echo   • Vertex AI ^(Google^) - Enterprise-grade AI
echo   • Hugging Face - Open-source models
echo.
set /p "SETUP_KEYS=Do you want to set up API keys now? (y/n): "
if /i not "!SETUP_KEYS!"=="y" (
    echo.
    echo %BLUE%ℹ You can set up API keys later in Arduino IDE%NC%
    echo   Right-click → 🤖 AI.duino → API Key
    goto :eof
)

echo.
echo Enter your API keys ^(press Enter to skip^):
echo.

REM Claude
set /p "CLAUDE_KEY=Claude API key (sk-ant-...): "
if not "!CLAUDE_KEY!"=="" (
    echo !CLAUDE_KEY!> "%USERPROFILE%\.aiduino-claude-api-key"
    echo %GREEN%✓%NC% Claude API key saved
)

REM ChatGPT
set /p "OPENAI_KEY=OpenAI API key (sk-...): "
if not "!OPENAI_KEY!"=="" (
    echo !OPENAI_KEY!> "%USERPROFILE%\.aiduino-openai-api-key"
    echo %GREEN%✓%NC% OpenAI API key saved
)

REM Gemini
set /p "GEMINI_KEY=Gemini API key (AIza...): "
if not "!GEMINI_KEY!"=="" (
    echo !GEMINI_KEY!> "%USERPROFILE%\.aiduino-gemini-api-key"
    echo %GREEN%✓%NC% Gemini API key saved
)

REM Mistral
set /p "MISTRAL_KEY=Mistral API key: "
if not "!MISTRAL_KEY!"=="" (
    echo !MISTRAL_KEY!> "%USERPROFILE%\.aiduino-mistral-api-key"
    echo %GREEN%✓%NC% Mistral API key saved
)

REM Groq
set /p "GROQ_KEY=Groq API key (gsk_...): "
if not "!GROQ_KEY!"=="" (
    echo !GROQ_KEY!> "%USERPROFILE%\.aiduino-groq-api-key"
    echo %GREEN%✓%NC% Groq API key saved
)

REM Perplexity
set /p "PERPLEXITY_KEY=Perplexity API key (pplx-...): "
if not "!PERPLEXITY_KEY!"=="" (
    echo !PERPLEXITY_KEY!> "%USERPROFILE%\.aiduino-perplexity-api-key"
    echo %GREEN%✓%NC% Perplexity API key saved
)

REM Cohere
set /p "COHERE_KEY=Cohere API key (co-...): "
if not "!COHERE_KEY!"=="" (
    echo !COHERE_KEY!> "%USERPROFILE%\.aiduino-cohere-api-key"
    echo %GREEN%✓%NC% Cohere API key saved
)

REM Vertex AI
set /p "VERTEX_KEY=Vertex AI API key: "
if not "!VERTEX_KEY!"=="" (
    echo !VERTEX_KEY!> "%USERPROFILE%\.aiduino-vertex-api-key"
    echo %GREEN%✓%NC% Vertex AI API key saved
)

REM Hugging Face
set /p "HUGGINGFACE_KEY=Hugging Face API key (hf_...): "
if not "!HUGGINGFACE_KEY!"=="" (
    echo !HUGGINGFACE_KEY!> "%USERPROFILE%\.aiduino-huggingface-api-key"
    echo %GREEN%✓%NC% Hugging Face API key saved
)
goto :eof

:show_success
echo.
echo %GREEN%================================================================%NC%
echo %GREEN%       🎉 Installation Complete! 🎉%NC%
echo %GREEN%================================================================%NC%
echo.
echo %BOLD%How to use AI.duino:%NC%
echo   1. %CYAN%Restart Arduino IDE%NC%
echo   2. %CYAN%Open any .ino file%NC%
echo   3. %CYAN%Select some code%NC%
echo   4. Use one of these methods:
echo      • %CYAN%Right-click → 🤖 AI.duino%NC%
echo      • %CYAN%Press Ctrl+Shift+C%NC%
echo      • %CYAN%Click AI.duino in status bar%NC%
echo.
if !LOCALE_COUNT! gtr 0 (
    echo %BOLD%Language:%NC%
    echo   The plugin will automatically use your system language
    echo   Supported: !LOCALE_COUNT! language^(s^)
    echo.
)
echo %BOLD%Get API Keys:%NC%
echo   • Claude:  %BLUE%https://console.anthropic.com%NC%
echo   • ChatGPT: %BLUE%https://platform.openai.com%NC%
echo   • Gemini:  %BLUE%https://makersuite.google.com%NC%
echo   • Mistral: %BLUE%https://console.mistral.ai%NC%
echo   • Groq:    %BLUE%https://console.groq.com%NC%
echo   • Perplexity: %BLUE%https://www.perplexity.ai/settings/api%NC%
echo   • Cohere:  %BLUE%https://dashboard.cohere.ai%NC%
echo.
echo %YELLOW%Tip:%NC% Start with Gemini - it's fast and has a free tier!
echo.
goto :eof
