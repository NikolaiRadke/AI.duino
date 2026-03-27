# Changelog

## V2.6.1
An urgent bugfix release.

## Bugfixes
* API keys are now stored correctly (V2.6.0 error)
* Added missing locale keys

## V2.6.0
This release focuses on new user-asked features but mainly on agentic coding. 

## Agentic Coding Features
* Added full agentic provider support (Claude Code, Codex CLI, Mistral Vibe, Gemini CLI, OpenCode, Groq Code CLI)
* Added complete local Ollama agentic support (Needs heavy hardware)
* Added process provider binary auto detection
* Added Node.js autodetection for Gemini CLI and Groq Code CLI 

## Other Features
* Added user model selection for every available model with recommendation for beginners
* Added uninstall.json for the Extension Manager extension and updated own uninstaller
* Added project notes
* Added continue in chat option
* Added estimated token limit warning
* Added project-bound chats - each chat is linked to its sketch

## Other
* Last chat can now be deleted
* Refactored huge chat panel to four files
* Forked Groq Code CLI for use with VS Code extensions 
* Cleaned About Panel and locales
* Chat now supports marked code

## Bugfixes
* Autorepairing wrong API key files
* Fixed wrong model name in status bar tooltip
