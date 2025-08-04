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

### API Keys

- API keys are stored locally in your home directory
- Files are created with restricted permissions (0600)
- Keys are never transmitted except to their respective API endpoints
- No analytics or telemetry is collected

### Network Communication

AI.duino only communicates with:
- `api.anthropic.com` (Claude)
- `api.openai.com` (ChatGPT)  
- `generativelanguage.googleapis.com` (Gemini)
- `api.mistral.ai` (Mistral)

### Code Execution

- AI.duino does not execute any code automatically
- All code modifications require explicit user confirmation
- The plugin runs with the same permissions as Arduino IDE

## Response Time

I do my very best.
