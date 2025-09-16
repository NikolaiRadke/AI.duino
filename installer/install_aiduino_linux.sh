#!/bin/bash
# AI.duino Extension Installer

# Configuration
EXTENSIONS_DIR="$HOME/.arduinoIDE/extensions"
DEPLOYED_DIR="$HOME/.arduinoIDE/deployedPlugins"
VSIX_FILE="$(dirname "$0")/aiduino.vsix"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${BLUE}AI.duino Extension Installer${NC}"
echo "================================"
echo

# Check if VSIX exists
if [ ! -f "$VSIX_FILE" ]; then
    echo -e "${RED}Error: aiduino.vsix not found${NC}"
    exit 1
fi

# Create extensions directory
if [ ! -d "$EXTENSIONS_DIR" ]; then
    echo "Creating extensions directory..."
    mkdir -p "$EXTENSIONS_DIR"
fi

# Clean up old installations
if [ -f "$EXTENSIONS_DIR/aiduino.vsix" ]; then
    echo -e "${YELLOW}Removing old VSIX...${NC}"
    rm -f "$EXTENSIONS_DIR/aiduino.vsix"
fi

if [ -d "$DEPLOYED_DIR/aiduino" ]; then
    echo -e "${YELLOW}Removing old deployed extension...${NC}"
    rm -rf "$DEPLOYED_DIR/aiduino"
fi

# Copy new VSIX
echo "Installing AI.duino extension..."
cp "$VSIX_FILE" "$EXTENSIONS_DIR/"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Extension installed successfully!${NC}"
    echo
    echo "Location: $EXTENSIONS_DIR/aiduino.vsix"
    echo
    echo "Restart Arduino IDE to use the extension."
else
    echo -e "${RED}✗ Installation failed${NC}"
fi

echo
read -p "Press Enter to continue..."
