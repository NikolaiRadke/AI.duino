# Security Policy

AI.duino takes the security of your API keys and data seriously. This document 
outlines security practices and how to report potential vulnerabilities.

## Reporting a Vulnerability

If you discover a security vulnerability in AI.duino, please report it:

1. Create a GitHub issue at: https://github.com/NikolaiRadke/AI.duino/issues
2. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

## Security Considerations

### API Keys Storage

- API keys are stored locally in `~/.aiduino/` directory
- Files are created with restricted permissions (mode 0600 on Unix/Linux/macOS)
- Keys are never transmitted except to their respective API endpoints
- No analytics or telemetry is collected
- Keys are never logged or exposed in error messages

### Network Communication

AI.duino communicates with the following external services (depending on your selected AI provider):

**Remote AI Providers:**
- `api.anthropic.com` (Claude)
- `api.openai.com` (ChatGPT)
- `generativelanguage.googleapis.com` (Gemini)
- `api.mistral.ai` (Mistral)
- `api.groq.com` (Groq)
- `api.perplexity.ai` (Perplexity)
- `api.cohere.ai` (Cohere)
- `us-central1-aiplatform.googleapis.com` (Vertex AI)
- `api-inference.huggingface.co` (Hugging Face)

**Local AI Providers:**
- `localhost:11434` or `127.0.0.1:11434` (Ollama - if installed locally)
- Local Claude Code process (if installed)

**Update Checks:**
- `raw.githubusercontent.com` (provider configuration updates only)

### Data Privacy

- Your code is only sent to the AI provider you selected
- No code is stored on any external servers by AI.duino
- Chat history is stored locally in `~/.aiduino/.aiduino-chats/`
- Token usage statistics are stored locally in `~/.aiduino/.aiduino-token-usage.json`

### Code Execution

- AI.duino does not execute any code automatically
- All code modifications require explicit user confirmation
- The extension runs as part of Arduino IDE 2.x with your user permissions
- No elevated privileges are required or requested

### Local AI Providers

When using local providers (Ollama, Claude Code):
- Communication stays on your local machine
- No external network requests are made
- Your API keys and data never leave your computer

## Best Practices

1. **Never share your API keys** - Each user should have their own keys
2. **Rotate API keys regularly** - Especially if you suspect compromise
3. **Use environment-specific keys** - Don't use production keys for development
4. **Monitor API usage** - Check your provider dashboards for unusual activity
5. **Keep the extension updated** - Security fixes are delivered through updates

## Response Time

Security reports are prioritized and will be addressed as quickly as possible. 
I do my very best.

## Supported Versions

Security updates are provided for the latest version of AI.duino. 
Please ensure you're running the most recent release.
