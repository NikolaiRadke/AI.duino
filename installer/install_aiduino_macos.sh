#!/bin/bash
# ==============================================================================
# AI.duino - Universal macOS Offline Installer
# Copyright 2025 Monster Maker
# Licensed under Apache License 2.0
# ==============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
PLUGIN_NAME="aiduino"

# Banner
show_banner() {
    clear
    echo -e "${CYAN}================================================================${NC}"
    echo -e "${BOLD}🤖  AI.duino - Universal macOS Installer${NC}"
    echo -e "${CYAN}================================================================${NC}\n"
}

# Find Arduino IDE installation
find_arduino_ide() {
    echo -e "${BLUE}▶ Searching for Arduino IDE 2.x installation...${NC}"
    
    ARDUINO_PATHS=(
        "/Applications/Arduino IDE.app/Contents/Resources/app"
        "/Applications/Arduino.app/Contents/Resources/app"
        "$HOME/Applications/Arduino IDE.app/Contents/Resources/app"
        "$HOME/Applications/Arduino.app/Contents/Resources/app"
        "/System/Volumes/Data/Applications/Arduino IDE.app/Contents/Resources/app"
        "/opt/homebrew-cask/Caskroom/arduino-ide/latest/Arduino IDE.app/Contents/Resources/app"
        "/usr/local/Caskroom/arduino-ide/latest/Arduino IDE.app/Contents/Resources/app"
        "$HOME/Library/Application Support/arduino-ide/resources/app"
    )
    
    for path in "${ARDUINO_PATHS[@]}"; do
        if [ -d "$path/plugins" ]; then
            PLUGIN_DIR="$path/plugins"
            echo -e "${GREEN}✓${NC} Found Arduino IDE at: ${BOLD}$path${NC}"
            return 0
        fi
    done
    
    # Try to find Arduino IDE using mdfind (Spotlight)
    echo -e "${BLUE}  Using Spotlight to search for Arduino IDE...${NC}"
    SPOTLIGHT_RESULT=$(mdfind -name "Arduino IDE.app" 2>/dev/null | head -1)
    if [ ! -z "$SPOTLIGHT_RESULT" ]; then
        POTENTIAL_PATH="$SPOTLIGHT_RESULT/Contents/Resources/app"
        if [ -d "$POTENTIAL_PATH/plugins" ]; then
            PLUGIN_DIR="$POTENTIAL_PATH/plugins"
            echo -e "${GREEN}✓${NC} Found Arduino IDE via Spotlight at: ${BOLD}$POTENTIAL_PATH${NC}"
            return 0
        fi
    fi
    
    return 1
}

# Find plugin archive
find_plugin_archive() {
    echo -e "${BLUE}▶ Looking for AI.duino archive...${NC}"
    
    # Get script directory
    SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
    
    # Search locations in order of preference
    SEARCH_PATHS=(
        "$SCRIPT_DIR"
        "$(pwd)"
        "$HOME/Downloads"
        "$HOME/Desktop"
        "$HOME/Documents"
        "$HOME"
    )
    
    # Possible archive names (version independent)
    ARCHIVE_NAMES=(
        "aiduino-"*.zip
        "aiduino-"*.tar.gz
        "aiduino.zip"
        "aiduino.tar.gz"
        "AI.duino-"*.zip
        "AI.duino-"*.tar.gz
        "AI.duino.zip"
        "AI.duino.tar.gz"
    )
    
    for path in "${SEARCH_PATHS[@]}"; do
        for name in "${ARCHIVE_NAMES[@]}"; do
            # Use find to handle glob patterns properly
            for file in $(find "$path" -maxdepth 1 -name "$name" 2>/dev/null); do
                if [ -f "$file" ]; then
                    ARCHIVE_FILE="$file"
                    # Extract version from filename if possible
                    if [[ "$(basename "$file")" =~ ([0-9]+\.[0-9]+\.[0-9]+) ]]; then
                        VERSION="${BASH_REMATCH[1]}"
                        echo -e "${GREEN}✓${NC} Found archive: ${BOLD}$ARCHIVE_FILE${NC} (v${VERSION})"
                    else
                        echo -e "${GREEN}✓${NC} Found archive: ${BOLD}$ARCHIVE_FILE${NC}"
                    fi
                    return 0
                fi
            done
        done
    done
    
    return 1
}

# Check for existing installation
check_existing() {
    if [ -d "$PLUGIN_DIR/$PLUGIN_NAME" ]; then
        echo -e "${YELLOW}⚠ AI.duino is already installed.${NC}"
        
        # Try to detect installed version
        if [ -f "$PLUGIN_DIR/$PLUGIN_NAME/extension/package.json" ]; then
            INSTALLED_VERSION=$(grep -o '"version":[[:space:]]*"[^"]*"' "$PLUGIN_DIR/$PLUGIN_NAME/extension/package.json" | cut -d'"' -f4)
            echo -e "  Installed version: ${BOLD}v$INSTALLED_VERSION${NC}"
        fi
        
        # Show version to be installed if detected
        if [ ! -z "$VERSION" ]; then
            echo -e "  New version:       ${BOLD}v$VERSION${NC}"
        fi
        
        echo -n "Do you want to update/reinstall? (y/n): "
        read -r response
        if [[ ! "$response" =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}Installation cancelled.${NC}"
            exit 0
        fi
        
        # Backup old installation
        echo -e "${BLUE}▶ Creating backup...${NC}"
        mv "$PLUGIN_DIR/$PLUGIN_NAME" "$PLUGIN_DIR/${PLUGIN_NAME}_backup_$(date +%Y%m%d_%H%M%S)"
        echo -e "${GREEN}✓${NC} Backup created"
    fi
}

# Extract and install
install_plugin() {
    echo -e "${BLUE}▶ Installing AI.duino...${NC}"
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Extract based on file type
    echo -e "${BLUE}  Extracting archive...${NC}"
    case "$ARCHIVE_FILE" in
        *.zip)
            # macOS has unzip built-in
            unzip -q "$ARCHIVE_FILE"
            ;;
        *.tar.gz)
            tar -xzf "$ARCHIVE_FILE"
            ;;
        *)
            echo -e "${RED}✗ Unknown archive format${NC}"
            exit 1
            ;;
    esac
    
    # Find the plugin directory in extracted files
    if [ -d "aiduino" ]; then
        EXTRACT_DIR="aiduino"
    elif [ -d "AI.duino" ]; then
        EXTRACT_DIR="AI.duino"
    elif [ -d "extension" ]; then
        # Files extracted directly without parent folder
        mkdir aiduino
        mv * aiduino/ 2>/dev/null || true
        EXTRACT_DIR="aiduino"
    else
        echo -e "${RED}✗ Invalid archive structure${NC}"
        echo "  Expected structure:"
        echo "    aiduino/"
        echo "    ├── extension/"
        echo "    └── extension.vsixmanifest"
        exit 1
    fi
    
    # Validate structure
    if [ ! -f "$EXTRACT_DIR/extension/package.json" ]; then
        echo -e "${RED}✗ Missing extension/package.json${NC}"
        exit 1
    fi
    
    if [ ! -f "$EXTRACT_DIR/extension/out/extension.js" ]; then
        echo -e "${RED}✗ Missing extension/out/extension.js${NC}"
        exit 1
    fi
    
    # Count locales
    if [ -d "$EXTRACT_DIR/extension/locales" ]; then
        LOCALE_COUNT=$(ls -1 "$EXTRACT_DIR/extension/locales"/*.json 2>/dev/null | wc -l)
        if [ $LOCALE_COUNT -gt 0 ]; then
            echo -e "${GREEN}✓${NC} Found ${BOLD}$LOCALE_COUNT${NC} language(s):"
            for locale in "$EXTRACT_DIR/extension/locales"/*.json; do
                locale_name=$(basename "$locale" .json)
                echo "    • $locale_name"
            done
        fi
    fi
    
    # Copy to plugin directory
    echo -e "${BLUE}  Copying files...${NC}"
    mkdir -p "$PLUGIN_DIR/$PLUGIN_NAME"
    cp -r "$EXTRACT_DIR"/* "$PLUGIN_DIR/$PLUGIN_NAME/"
    
    # Set permissions
    chmod -R 755 "$PLUGIN_DIR/$PLUGIN_NAME"
    
    # macOS specific: Clear extended attributes that might cause issues
    xattr -cr "$PLUGIN_DIR/$PLUGIN_NAME" 2>/dev/null || true
    
    echo -e "${GREEN}✓${NC} AI.duino installed successfully!"
    
    # Cleanup
    cd - > /dev/null
    rm -rf "$TEMP_DIR"
}

# Setup API keys
setup_api_keys() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}API Key Setup (Optional)${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
    
    echo "AI.duino supports multiple AI providers:"
    echo -e "  ${BOLD}•${NC} Claude (Anthropic) - Best for code understanding"
    echo -e "  ${BOLD}•${NC} ChatGPT (OpenAI) - Most versatile"
    echo -e "  ${BOLD}•${NC} Gemini (Google) - Fast & affordable"
    echo -e "  ${BOLD}•${NC} Mistral - Good balance"
    echo ""
    echo -n "Do you want to set up API keys now? (y/n): "
    read -r response
    
    if [[ "$response" =~ ^[Yy]$ ]]; then
        setup_individual_keys
    else
        echo -e "${BLUE}ℹ You can set up API keys later in Arduino IDE${NC}"
        echo "  Right-click → 🤖 AI.duino → API Key"
    fi
}

# Setup individual API keys
setup_individual_keys() {
    echo ""
    echo "Enter your API keys (press Enter to skip):"
    echo ""
    
    # Claude
    echo -n "Claude API key (sk-ant-...): "
    read -rs claude_key
    echo ""
    if [ ! -z "$claude_key" ]; then
        if [[ "$claude_key" == sk-ant-* ]]; then
            echo "$claude_key" > "$HOME/.aiduino-claude-api-key"
            chmod 600 "$HOME/.aiduino-claude-api-key"
            echo -e "${GREEN}✓${NC} Claude API key saved"
        else
            echo -e "${YELLOW}⚠${NC} Invalid Claude key format (should start with sk-ant-)"
        fi
    fi
    
    # ChatGPT
    echo -n "OpenAI API key (sk-...): "
    read -rs openai_key
    echo ""
    if [ ! -z "$openai_key" ]; then
        if [[ "$openai_key" == sk-* ]]; then
            echo "$openai_key" > "$HOME/.aiduino-openai-api-key"
            chmod 600 "$HOME/.aiduino-openai-api-key"
            echo -e "${GREEN}✓${NC} OpenAI API key saved"
        else
            echo -e "${YELLOW}⚠${NC} Invalid OpenAI key format (should start with sk-)"
        fi
    fi
    
    # Gemini
    echo -n "Gemini API key (AIza...): "
    read -rs gemini_key
    echo ""
    if [ ! -z "$gemini_key" ]; then
        if [[ "$gemini_key" == AIza* ]]; then
            echo "$gemini_key" > "$HOME/.aiduino-gemini-api-key"
            chmod 600 "$HOME/.aiduino-gemini-api-key"
            echo -e "${GREEN}✓${NC} Gemini API key saved"
        else
            echo -e "${YELLOW}⚠${NC} Invalid Gemini key format (should start with AIza)"
        fi
    fi
    
    # Mistral
    echo -n "Mistral API key: "
    read -rs mistral_key
    echo ""
    if [ ! -z "$mistral_key" ]; then
        echo "$mistral_key" > "$HOME/.aiduino-mistral-api-key"
        chmod 600 "$HOME/.aiduino-mistral-api-key"
        echo -e "${GREEN}✓${NC} Mistral API key saved"
    fi
}

# Show success message
show_success() {
    echo -e "\n${GREEN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}       🎉 Installation Complete! 🎉${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}\n"
    
    echo -e "${BOLD}How to use AI.duino:${NC}"
    echo -e "  1. ${CYAN}Restart Arduino IDE${NC}"
    echo -e "  2. ${CYAN}Open any .ino file${NC}"
    echo -e "  3. ${CYAN}Select some code${NC}"
    echo -e "  4. Use one of these methods:"
    echo -e "     • ${CYAN}Right-click → 🤖 AI.duino${NC}"
    echo -e "     • ${CYAN}Press ⌘+Shift+C${NC}"
    echo -e "     • ${CYAN}Click AI.duino in status bar${NC}"
    echo ""
    
    if [ $LOCALE_COUNT -gt 0 ]; then
        echo -e "${BOLD}Language:${NC}"
        echo -e "  The plugin will automatically use your system language"
        echo -e "  Supported: ${LOCALE_COUNT} language(s)"
        echo ""
    fi
    
    echo -e "${BOLD}Get API Keys:${NC}"
    echo -e "  • Claude:  ${BLUE}https://console.anthropic.com${NC}"
    echo -e "  • ChatGPT: ${BLUE}https://platform.openai.com${NC}"
    echo -e "  • Gemini:  ${BLUE}https://makersuite.google.com${NC}"
    echo -e "  • Mistral: ${BLUE}https://console.mistral.ai${NC}"
    echo ""
    echo -e "${YELLOW}Tip:${NC} Start with Gemini - it's fast and has a free tier!"
    echo ""
}

# Error handler
handle_error() {
    echo -e "\n${RED}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${RED}       ✗ Installation Failed${NC}"
    echo -e "${RED}═══════════════════════════════════════════════════════════${NC}\n"
    
    echo -e "${YELLOW}Please check:${NC}"
    echo "  1. Arduino IDE 2.x is installed"
    echo "  2. Archive file exists and is valid"
    echo "  3. You have write permissions"
    echo ""
    echo -e "${YELLOW}Manual installation:${NC}"
    echo "  1. Extract the archive"
    echo "  2. Copy the 'aiduino' folder to:"
    echo "     /Applications/Arduino IDE.app/Contents/Resources/app/plugins/"
    echo ""
    exit 1
}

# Check for required tools
check_requirements() {
    # Check if running on macOS
    if [[ "$OSTYPE" != "darwin"* ]]; then
        echo -e "${RED}✗ This installer is for macOS only${NC}"
        echo "  Detected OS: $OSTYPE"
        echo "  Please use the Linux or Windows installer instead."
        exit 1
    fi
    
    # Check for required commands (should all be present on macOS)
    local missing_tools=()
    
    command -v unzip >/dev/null 2>&1 || missing_tools+=("unzip")
    command -v tar >/dev/null 2>&1 || missing_tools+=("tar")
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        echo -e "${RED}✗ Missing required tools:${NC}"
        for tool in "${missing_tools[@]}"; do
            echo "  • $tool"
        done
        echo ""
        echo "Please install them using Homebrew:"
        echo "  brew install ${missing_tools[*]}"
        exit 1
    fi
}

# Main installation flow
main() {
    # Trap errors
    trap handle_error ERR
    
    # Show banner
    show_banner
    
    # Check requirements
    check_requirements
    
    # Find plugin archive
    if ! find_plugin_archive; then
        echo -e "${RED}✗ AI.duino archive not found!${NC}\n"
        echo "Please place one of these files in the same directory as this installer:"
        echo -e "  • ${BOLD}aiduino-x.x.x.zip${NC} (recommended)"
        echo -e "  • ${BOLD}aiduino-x.x.x.tar.gz${NC}"
        echo -e "  • ${BOLD}aiduino.zip${NC}"
        echo ""
        echo "Searched in:"
        for path in "${SEARCH_PATHS[@]}"; do
            echo "  • $path"
        done
        exit 1
    fi
    
    # Check for Arduino IDE
    if ! find_arduino_ide; then
        echo -e "${RED}✗ Arduino IDE 2.x not found!${NC}\n"
        echo "Please install Arduino IDE 2.x from:"
        echo -e "${BLUE}https://www.arduino.cc/en/software${NC}\n"
        echo "Expected locations:"
        echo "  • /Applications/Arduino IDE.app"
        echo "  • ~/Applications/Arduino IDE.app"
        echo ""
        echo "If Arduino IDE is installed in a different location,"
        echo "please create a symbolic link or edit this script."
        exit 1
    fi
    
    # Check for existing installation
    check_existing
    
    # Install plugin
    install_plugin
    
    # Setup API keys
    setup_api_keys
    
    # Show success message
    show_success
}

# Run main function
main "$@"
