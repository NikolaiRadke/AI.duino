# HELP
Some hints how to use AI.duino.  
More coming soon.

## Settings
There a several options that needs further explainations. The default values are okay and tested, but if you need some customization, here are some explanations.

### AI Behavior
* **Creativity (Temperature):** Controls randomness in AI responses. Lower values (0.0-0.3) produce more focused and deterministic answers, ideal for code generation. Higher values (0.7-1.0) increase creativity and variety. used in **Explain Code**, **Quick Question**, and **Chat (if enabled)**. Default: 0.7  
  
* **Code Temperature:** Code generation needs more precicion. Used in **all other features** and **inline completion**. Default: 0.3
  
* **Max. Tokens per Request:** Set the token limit for the AI answer in 4 steps. 2000 ist really short, 8000 is quite talkative. The selected step is shown in the tree beneath **Response length:**. More than 8000 may cause errors, so it's limited. Default: 4000

# FAQ

### "Groq? Really? AI.duino ist supporting Elon??"
➡️ **No.** **Groq** (with an **q** is an independent AI infrastructure company founded by former Google engineers. It has no connection to Elon Musk or X/Twitter. **Grok** (with a "k") is xAI's chatbot. AI.duino uses **Groq** for its fast API access to open-source models - a purely technical choice based on performance.

    
### "The browser chats have microphone input. Does AI.duino has it?"
➡️ **No.** Sorry. the IDE itself has no given permissions to access the microphone for security reasons. Use your OS voice input:
* Windows: Press WIN + H 
* macOS: Press Fn two times
* Linux: Use *IBus Typing Booster* with *Voice Input* or install *Nerd Dictation*. 

    
### "Where is the rigth-click context menu from the IDE in the output window?"
➡️ The IDE disabled right-click for security reasons. Because Copy&Paste is important, AI.duino uses a tricky own workaround menu.  

### "The Quick menu has an unpleasent position. Can it be moved?"
➡️ **No.** Quick menu is a part of IDE/Theia restricted elements. AI.duino can have this or nothing.  
