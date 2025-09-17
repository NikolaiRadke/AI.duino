#!/bin/bash
# AI.duino Extension Uninstaller

# Configuration
EXTENSIONS_DIR="$HOME/.arduinoIDE/extensions"
DEPLOYED_DIR="$HOME/.arduinoIDE/deployedPlugins"
CONFIG_DIR="$HOME/.aiduino"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m'

echo -e "${RED}AI.duino Extension Uninstaller${NC}"
echo "=================================="
echo

# Check what will be removed
echo -e "${YELLOW}The following will be removed:${NC}"
[ -f "$EXTENSIONS_DIR/aiduino.vsix" ] && echo "  • VSIX file: $EXTENSIONS_DIR/aiduino.vsix"
[ -d "$DEPLOYED_DIR/aiduino" ] && echo "  • Deployed extension: $DEPLOYED_DIR/aiduino"
[ -d "$CONFIG_DIR" ] && echo "  • Configuration directory: $CONFIG_DIR"
echo

# Confirm removal
read -p "Are you sure you want to uninstall AI.duino? (y/N): " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}Uninstallation cancelled.${NC}"
    exit 0
fi

echo
echo -e "${YELLOW}Uninstalling AI.duino...${NC}"

# Remove VSIX file
if [ -f "$EXTENSIONS_DIR/aiduino.vsix" ]; then
    echo "Removing VSIX file..."
    rm -f "$EXTENSIONS_DIR/aiduino.vsix"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ VSIX file removed${NC}"
    else
        echo -e "${RED}✗ Failed to remove VSIX file${NC}"
    fi
fi

# Remove deployed extension
if [ -d "$DEPLOYED_DIR/aiduino" ]; then
    echo "Removing deployed extension..."
    rm -rf "$DEPLOYED_DIR/aiduino"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Deployed extension removed${NC}"
    else
        echo -e "${RED}✗ Failed to remove deployed extension${NC}"
    fi
fi

# Remove configuration directory
if [ -d "$CONFIG_DIR" ]; then
    echo "Removing configuration directory..."
    rm -rf "$CONFIG_DIR"
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Configuration directory removed${NC}"
    else
        echo -e "${RED}✗ Failed to remove configuration directory${NC}"
    fi
fi

echo
echo -e "${GREEN}✓ AI.duino has been uninstalled!${NC}"
echo
echo -e "${BLUE}Restart Arduino IDE to complete the removal.${NC}"
echo
read -p "Press Enter to continue..."
