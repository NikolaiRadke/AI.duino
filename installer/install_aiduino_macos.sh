#!/bin/bash
# AI.duino Extension Installer

# Configuration
EXTENSIONS_DIR="$HOME/.arduinoIDE/extensions"
DEPLOYED_DIR="$HOME/.arduinoIDE/deployedPlugins"
SCRIPT_DIR="$(dirname "$0")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${BLUE}AI.duino Extension Installer${NC}"
echo "================================"
echo

# Find VSIX file (versioned or not)
VSIX_FILE=""
if [ -f "$SCRIPT_DIR/aiduino.vsix" ]; then
    VSIX_FILE="$SCRIPT_DIR/aiduino.vsix"
else
    # Look for versioned VSIX (e.g., aiduino-2.6.0.vsix)
    VSIX_FILE=$(ls "$SCRIPT_DIR"/aiduino-*.vsix 2>/dev/null | sort -V | tail -n 1)
fi

# Check if VSIX exists
if [ -z "$VSIX_FILE" ] || [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}Error: No aiduino*.vsix file found${NC}"
    echo "Looking for: aiduino.vsix or aiduino-*.vsix"
    exit 1
fi

VSIX_FILENAME=$(basename "$VSIX_FILE")
echo "Found: $VSIX_FILENAME"
echo

# Create extensions directory
if [ ! -d "$EXTENSIONS_DIR" ]; then
    echo "Creating extensions directory..."
    mkdir -p "$EXTENSIONS_DIR"
fi

# Clean up old installations (all versions)
echo "Cleaning up old installations..."
rm -f "$EXTENSIONS_DIR"/aiduino*.vsix 2>/dev/null
if ls "$DEPLOYED_DIR"/aiduino* 1> /dev/null 2>&1; then
    echo -e "${YELLOW}Removing old deployed extension(s)...${NC}"
    rm -rf "$DEPLOYED_DIR"/aiduino*
fi

# Copy new VSIX
echo "Installing AI.duino extension..."
cp "$VSIX_FILE" "$EXTENSIONS_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Extension installed successfully!${NC}"
    echo
    echo "File: $VSIX_FILENAME"
    echo "Location: $EXTENSIONS_DIR/"
    echo
    echo "Restart Arduino IDE to use the extension."
else
    echo -e "${RED}✗ Installation failed${NC}"
    exit 1
fi

echo
read -p "Press Enter to continue..."
