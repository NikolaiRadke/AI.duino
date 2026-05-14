# 🤖 AI.duino — AI Assistant for Arduino & Embedded Development

AI.duino brings powerful AI assistance directly into your IDE — no browser switching, no copy-pasting. Works in both **Arduino IDE 2.x** and **VS Code** (including PlatformIO).

---

## Supported AI Providers

### Cloud Providers
**Claude, ChatGPT, Gemini, Mistral, Perplexity, Cohere, Groq**

### Aggregators
**OpenRouter, Hugging Face**

### Local Providers (no API key required)
**Ollama, LM Studio**

### Agentic Providers (require separate installation)
**Claude Code, Codex CLI, Mistral Vibe, OpenCode, Gemini CLI, Groq Code, Ollama Agentic**

> Groq is not Grok — AI.duino is Elon-free! 🤙

---

## Features

### ⚡ Code Optimization
Improves your code automatically. Converts blocking code to non-blocking variants, replaces `delay()` with `millis()`-based implementations, and more.

### 🔍 Code Explanation
Explains complex commands, hardware registers, and library functions in plain language — perfect for beginners and experts alike.

### 📝 Automatic Documentation
Adds meaningful comments to your existing code with a single click.

### 🔧 Error Analysis
Paste a compiler error and get a clear explanation plus a concrete fix. Works with Arduino IDE and VS Code diagnostics.

### ❓ Ask AI
Ask anything — with or without selected code. Follow-up questions keep the context alive.

### 🐛 Debug Help
- Serial Monitor output analysis
- Hardware diagnostics for common wiring problems
- Timing analysis (blocking vs. non-blocking)

### 💬 AI Chat
Multiple persistent chat sessions, just like in your browser — but right inside the IDE. Attach files, reference your sketch, and continue where you left off.

### 🤖 Custom Agents
Define your own AI workflows: error checking after compile, code review, documentation generation — with access to build output, sketch files, and external resources.

### 🚀 Agentic Coding
The AI reads, modifies, and writes your project files directly — no copy-pasting required. It can even compile and fix errors autonomously in a loop.

### 📊 Offline Code Analysis
Get structural information about your current file without any API call.

### ✨ Inline Completion
AI-powered code suggestions as you type (optional, configurable).

---

## Getting Started

1. Install AI.duino
2. Click the AI.duino icon in the Activity Bar
3. Select an AI provider and enter your API key
4. Open a source file and start coding with AI

No additional dependencies required for cloud and local HTTP providers.

---

## Supported Languages

AI.duino automatically uses your IDE language. Supported:
`bg, bs, cs, da, de, el, en, es, et, fi, fr, hr, hu, is, it, ja, ko, lt, lv, mk, mt, nl, no, pl, pt, ro, sk, sl, sq, sr, sv, tr, uk, zh`

You can add custom languages by placing a `xx.json` file in the `locales/` folder.

---

## Links

- [GitHub Repository](https://github.com/NikolaiRadke/AI.duino)
- [Wiki & Documentation](https://github.com/NikolaiRadke/AI.duino/wiki)
- [Report Issues](https://github.com/NikolaiRadke/AI.duino/issues)
- [News & Changelog](https://github.com/NikolaiRadke/AI.duino/blob/main/NEWS.md)
- [Support AI.duino on Ko-Fi ☕](https://ko-fi.com/nikolairadke)

---

## License

Apache License 2.0 — © Monster Maker
