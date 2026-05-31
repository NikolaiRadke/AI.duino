# Changelog

## 2.7.0
* Added Semantic Anchor feature
* Changed update check from package.json to releases for less (annoying) update notifications.

## 2.6.9
* Fixed npm-based providers (Codex CLI, Gemini CLI, OpenCode, Groq Code CLI) not working on Windows — .cmd files can now be launched correctly
* Provider test now recognizes binaries installed at a custom path

## 2.6.8
* Added "CLI Default" model option for Claude Code, Codex CLI and Gemini CLI — omits --model flag so the CLI uses its own default
* Removed misleading model lists for Mistral Vibe, Groq Code CLI and OpenCode; these providers do not support model selection via CLI parameters
* Fixed Codex CLI stdin handling in processProvider.js (options.input was never written to stdin)
* Fixed handleProcessClose to prioritize stdout over stderr warnings (e.g. Node.js deprecation notices)
ls

## 2.6.7
* Added necessary VS Code meta data
* Fixed extension update notifyer button

## 2.6.6
* Fixed stale session error for agentic providers
* Fixed process provider flickering in Windows
* AI.duino runs now in VS Code

## V2.6.5
* Fixed uninstaller bug. Extension now uninstalls from the button in the setting
* Project notes are now disabled by default (Too anoying)
* Extension updates notifications can now be ignored for this version

## V2.6.4
* Added provider test button in settings

## V2.6.3
* Fixed Codex CLI ENAMETOOLONG bug (fix by Casket Pizza)

## V2.6.2
* Fixed Claude Code for Windows bug

## V2.6.1
An urgent bugfix release.

## Bugfixes
* API keys are now stored correctly (V2.6.0 error)
* Added missing locale keys

## V2.6.0
This release focuses on new user-asked features but mainly on agentic coding. 

### Agentic Coding Features
* Added full agentic provider support (Claude Code, Codex CLI, Mistral Vibe, Gemini CLI, OpenCode, Groq Code CLI)
* Added complete local Ollama agentic support (Needs heavy hardware)
* Added process provider binary auto detection
* Added Node.js autodetection for Gemini CLI and Groq Code CLI 

### Other Features
* Added user model selection for every available model with recommendation for beginners
* Added uninstall.json for the Extension Manager extension and updated own uninstaller
* Added project notes
* Added continue in chat option
* Added estimated token limit warning
* Added project-bound chats - each chat is linked to its sketch

### Other
* Last chat can now be deleted
* Refactored huge chat panel to four files
* Forked Groq Code CLI for use with VS Code extensions 
* Cleaned About Panel and locales
* Chat now supports marked code

### Bugfixes
* Autorepairing wrong API key files
* Fixed wrong model name in status bar tooltip
