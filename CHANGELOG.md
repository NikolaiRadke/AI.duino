# Changelog

## 2.8.0
Last feature release. From now on AI.duino only gets provider updates; agentic work continues in [Agentuino](https://github.com/NikolaiRadke/Agentuino).
* Added custom semantic anchors: create, edit and delete them in the prompt editor
* Added semantic anchor "Texts in flash (F())"; built-in anchors tell the AI more precisely what is meant
* Added provider "OpenAI-compatible (local)" for Lemonade, llama.cpp, vLLM, LocalAI, Jan and others
* Added flash and RAM usage after a successful compile in agentic mode, with a warning when RAM runs low
* Added login detection for CLI agents: "Log in in a terminal" opens the agent's login in the system terminal
* Added weekly provider config check (GitHub workflow) with a tracking issue
* Changed compiling in agentic mode: runs asynchronously (the IDE no longer freezes), uses the IDE's arduino-cli config (libraries of a moved sketchbook are found) and stops on missing libraries
* Added safety net for agentic mode: before every run the sketch's code files are saved (~/.aiduino/backups); if the agent changed them, "Restore previous state" brings back the old state and removes the agent's new files
* Changed agentic mode: fixed rules (change files only when asked, never upload on its own, install libraries only after asking, stay in the sketch folder), retries keep the agent's session, changes in src/ are detected, other subfolders such as Agentuino's agentuino/ are ignored
* Changed: errors about retired endpoints or models offer a provider config update instead of reporting an invalid API key
* Fixed board detection after long IDE sessions (all IDE logs are scanned); sketch.yaml (default_fqbn) is used when present
* Fixed agentic compile loop retrying when no board is selected or arduino-cli is missing; the chat now says what is missing
* Fixed Codex CLI for current versions (sandbox option, sessions via resume)
* Fixed Mistral Vibe for version 3.x (tool approval, sessions)
* Fixed OpenCode: JSON output, sessions, prompt via stdin (long prompts on Windows)
* Fixed missing English labels for advanced semantic anchors
* Provider config 151126: Claude 5.5, GPT-6, Gemini 4 Argon and more

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
