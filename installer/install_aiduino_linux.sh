#!/bin/bash
# AI.duino Extension Installer

# Configuration
EXTENSIONS_DIR="$HOME/.arduinoIDE/extensions"
VSIX_FILE="$(dirname "$0")/aiduino.vsix"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
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

# Copy VSIX (overwrite existing)
echo "Installing AI.duino extension..."
cp -f "$VSIX_FILE" "$EXTENSIONS_DIR/"

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
