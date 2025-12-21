# HELP  
Some hints on how to use AI.duino.  
More coming soon.

## Inline
Clicking Inline opens the settings where inline completion can be enabled or disabled. The AI provides code suggestions while typing, triggered by keywords like Serial. and in comments ending with :. Example: ``` // Blink the LED three times: ```. Press the **Tab key** to accept the suggestion. A different provider can be configured for inline completion. **Groq** is recommended – it's free within limits and extremely fast.

## Settings  
There are several options that need further explanation. The default values are tested and work fine, but if you need some customization, here are some details.

### AI Behavior  
* **Creativity (Temperature):** Controls randomness in AI responses. Lower values (0.0–0.3) produce more focused and deterministic answers, ideal for code generation. Higher values (0.7–1.0) increase creativity and variety. Used in **Explain Code**, **Quick Question**, and **Chat (if enabled)**. Default: 0.7  
  
* **Code Temperature:** Code generation requires more precision. Used in **all other features** and **inline completion**. Default: 0.3  

* **Max. Tokens per Request:** Set the token limit for the AI response in 4 steps. 2000 is really short; 8000 is quite talkative. The selected step is shown in the tree beneath **Response length**. More than 8000 may cause errors, so it is limited. Default: 4000  

# FAQ  

### "Groq? Really? AI.duino ist supporting Elon??"  
➡️ **No.** **Groq** (with a **q**) is an independent AI infrastructure company founded by former Google engineers. It has no connection to Elon Musk or X/Twitter. **Grok** (with a **k**) is xAI's chatbot. AI.duino uses **Groq** for fast API access to open-source models—a purely technical choice based on performance.

### "The browser chats have microphone input. Does AI.duino have it?"  
➡️ **No.** Sorry, the IDE itself has no permission to access the microphone for security reasons. Use your OS voice input:  
* Windows: Press WIN + H  
* macOS: Press Fn twice  
* Linux: Use *IBus Typing Booster* with *Voice Input* or install *Nerd Dictation*  

### "Where is the right-click context menu from the IDE in the output window?"  
➡️ The IDE disables right-click for security reasons. Since Copy & Paste is important, AI.duino provides its own workaround menu.  

### "The Quick menu has an unpleasant position. Can it be moved?"  
➡️ **No.** The Quick menu is part of IDE/Theia restricted elements. AI.duino can either have this menu or none at all.
