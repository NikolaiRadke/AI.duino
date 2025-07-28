![AI.duino](http://www.nikolairadke.de/aiduino/aiduino_back.png)
# 🤖 AI.duino - AI Assistant for Arduino IDE

AI.duino integrates Claude and ChatGPT directly into the Arduino IDE for intelligent code assistance.

*Oje, Englisch? Kann ich nicht. Schnell [hier hin](https://github.com/NikolaiRadke/AI.duino/wiki)*.  

🆕 What's new?  
* **28.07.2025** Pushed all needed files. Ready to test!  
    -- More news? Check the [newsblog](https://github.com/NikolaiRadke/AI.duino/tree/main/NEWS.md).
   
## Features

### Code Optimization
Converts blocking code into non-blocking variants. Example: `delay()` is replaced with `millis()`-based implementations.

### Code Explanation
Explains complex Arduino commands and hardware registers in plain language.

### Automatic Documentation
Adds meaningful comments to existing code.

### Error Analysis
Explains compiler error messages and provides concrete solutions.
When using this feature, you copy the error message from the Arduino output window.

### Debug Support
- Analysis of Serial Monitor output
- Hardware diagnostics for common problems
- Timing analysis

## Installation

### Automatic (recommended)

#### Windows
```
Run aiduino_windows.bat as Administrator
```

#### Linux
```bash
chmod +x aiduino_linux.sh
./aiduino_linux.sh
```
#### macOS
```bash
chmod +x aiduino_macos.sh
./aiduino_macos.sh
```

### Manual installation

Copy the prepared `aiduino` folder to the Arduino IDE plugin directory:

#### Windows
```
C:\Program Files\Arduino IDE\resources\app\plugins\
```

#### macOS
```
/Applications/Arduino IDE.app/Contents/Resources/app/plugins/
```

#### Linux
```
/usr/share/arduino/resources/app/plugins/
# or
~/.local/share/arduino-ide/resources/app/plugins/
```

The `aiduino` folder must have the following structure:
```
aiduino/
├── extension/
│   ├── package.json
│   └── out/
│       └── extension.js
├── extension.vsixmanifest
└── LICENSE
```

## Usage

1. Select code in Arduino IDE
2. Right-click → `AI.duino` → Choose function
3. Alternative: `Ctrl+Shift+C` (Windows/Linux) or `Cmd+Shift+C` (Mac) or press the `Ai.duino` button below  

### Explain Error
1. Compile code and find error message in output window
2. Place cursor near the error
3. Run "Explain Error"
4. Copy error message (red line with "error:") into input field

## API Keys

Required: An API key from either:
- Claude: https://console.anthropic.com/api-keys
- ChatGPT: https://platform.openai.com/api-keys

The key is stored locally and not transmitted.
