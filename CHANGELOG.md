# Changelog
## V2.5.0-Make
AI.duino will appear in the German Make Magazine. This is the feature-freeze release related to the article. 

## Features
* Added agent import/export
* Added temperature and token settings for agents
* Added "Continue in Chat" button for agents
* Added aggregator service provider support: Hugging Face, OpenRouter, Fireworks and Together             
* Features use different temperatures, for example AddComments uses text temperature, ImproveCode uses code temperature 
* Text and code temperatures can be changed in the settings
* In ChatPanel you can switch between code and text generation temperature for the answer to each question 
* Response length can be set in four steps with a slider (2000, 4000, 6000 and 8000 tokens)  

## Bugfixes
* Fixed critical key generation bug.  
* All settings are now removed correctly when using the uninstall option
* Removed unused file 
* Removed debugging code
* Fixed temperature chat button bug
* Removed attachments in ChatPanel were now removed correctly
* Fixed some broken emojis
* Fixed wrong tree tooltips
* Added missing chat button for AskAI
* Added check for newer build-in providerConfig.js
* Better check for best cloud provider model (ChatGPT, Claude, ...)
* Fixed LM Studio wrong model selection bug
* Fixed load model on startup bug    
* Fixed addComments locale bug
* Updated Mistral key formation settings

## Other
* You can abort a feature by clicking outside prompt window
* Better Claude Code and Codex CLI session persistence
* Feature lazy loading for better startup performance 
* Removed Vertex. Vertex user don't need AI.duino :-) 
* Merged 2.5.0 to 2.5.0-Make and removed 2.5.0 release
<<<<<<< HEAD
* Changed logo and banner to avoid copyright issues  
=======
>>>>>>> 210ee420ad31b21feab21e61583d46af234743d8
