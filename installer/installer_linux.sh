#!/bin/bash
# AI.duino v1.1 - Linux - Easy Install
# Copyright 2025 Monster Maker
# Licensed under Apache License 2.0

echo ""
echo "==============================================="
echo "   AI.duino v1.1 - Linux Installer"
echo "==============================================="
echo ""

# Find Arduino IDE plugins directory
echo "[1/4] Suche Arduino IDE 2.x Installation..."

PLUGIN_DIR=""
FOUND_PATH=""

for dir in "/usr/share/arduino/resources/app/plugins" \
           "/opt/arduino-ide/resources/app/plugins" \
           "$HOME/.local/share/arduino-ide/resources/app/plugins" \
           "$HOME/.arduino-ide/resources/app/plugins" \
           "/usr/local/arduino-ide/resources/app/plugins" \
           "/snap/arduino/current/resources/app/plugins"; do
    if [ -d "$dir" ]; then
        PLUGIN_DIR="$dir"
        FOUND_PATH="$dir"
        break
    fi
done

if [ -z "$PLUGIN_DIR" ]; then
    echo ""
    echo "[ERROR] Arduino IDE 2.x nicht gefunden!"
    echo ""
    echo "Bitte installiere Arduino IDE 2.x von:"
    echo "https://www.arduino.cc/en/software"
    echo ""
    echo "Falls bereits installiert, kopiere das Plugin manuell nach:"
    echo "[Arduino IDE]/resources/app/plugins/aiduino"
    echo ""
    exit 1
fi

echo "[OK] Arduino IDE gefunden in:"
echo "     $FOUND_PATH"
echo ""

# Create plugin directory
echo "[2/4] Erstelle Plugin-Verzeichnis..."
TARGET="$PLUGIN_DIR/aiduino"

# Check if we need sudo
if [ -w "$PLUGIN_DIR" ]; then
    SUDO=""
else
    SUDO="sudo"
    echo "     Administrator-Rechte benötigt..."
fi

# Remove old version if exists
if [ -d "$TARGET" ]; then
    echo "     Entferne alte Version..."
    $SUDO rm -rf "$TARGET" 2>/dev/null
fi

# Create directories
$SUDO mkdir -p "$TARGET/extension/out"

if [ $? -ne 0 ]; then
    echo "[ERROR] Konnte Verzeichnis nicht erstellen!"
    echo "        Prüfe Schreibrechte für: $TARGET"
    exit 1
fi

echo "[OK] Plugin-Verzeichnis erstellt"
echo ""

# Create package.json
echo "[3/4] Erstelle package.json..."
$SUDO tee "$TARGET/extension/package.json" > /dev/null << 'PACKAGE_EOF'

# ------ Hier package.json einfügen und Zeile löschen ------ 

PACKAGE_EOF

echo "[OK] package.json erstellt"
echo ""

# Create extension.js
echo "[4/4] Erstelle extension.js..."
$SUDO tee "$TARGET/extension/out/extension.js" > /dev/null << 'EXTENSION_EOF'

# ------ Hier extension.js einfügen und Zeile löschen ------

EXTENSION_EOF

echo "[OK] extension.js erstellt"
echo ""

# Create manifest
$SUDO tee "$TARGET/extension.vsixmanifest" > /dev/null << 'EOF'
<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011">
  <Metadata>
    <Identity Language="en-US" Id="aiduino" Version="1.1.0" Publisher="Monster Maker"/>
    <DisplayName>AI.duino</DisplayName>
    <Description xml:space="preserve">KI-Hilfe für Arduino mit Fehler-Erklärung und Debug-Support</Description>
  </Metadata>
  <Installation>
    <InstallationTarget Id="Microsoft.VisualStudio.Code"/>
  </Installation>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
  </Assets>
</PackageManifest>
EOF

# Create LICENSE
$SUDO tee "$TARGET/LICENSE" > /dev/null << 'EOF'
                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      [... Rest der Apache 2.0 Lizenz ...]

   Copyright 2025 Monster Maker

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
EOF

# Set permissions
$SUDO chmod -R 755 "$TARGET"

echo ""
echo "==============================================="
echo "   Installation erfolgreich!"
echo "==============================================="
echo ""
echo "🤖 AI.duino v1.1 wurde installiert!"
echo ""
echo "📖 Nächste Schritte:"
echo "1. Arduino IDE neu starten"
echo "2. Drücke Strg+Shift+C oder Rechtsklick → AI.duino"
echo "3. Gib deinen Claude, ChatGPT oder Gemini API Key ein"
echo ""
echo "🎯 Schnellstart: Markiere Code und drücke Strg+Shift+C!"
echo ""
echo "🔑 API Keys:"
echo "   Claude: https://console.anthropic.com/api-keys"
echo "   ChatGPT: https://platform.openai.com/api-keys"
echo ""
echo "📜 Lizenz: Apache 2.0 - siehe $TARGET/LICENSE"
echo ""
