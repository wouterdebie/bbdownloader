# BB downloader

Chrome extension that downloads modules from Blackboard and creates a single HTML page that can be printed
or saved as a PDF. Some administrators don't allow for downloading of a whole module, so this extension
helps in creating full documents that can be read offline.

This extension expects the Beeline alternative format to be available for the module.

## Todo

- Make this work for other domains than ufl.infrastructure.com
- It seems that modules are only uploaded to Ally on request and if the page isn't available, the page will
  be in a pending state. This extension should check for this and show a message to the user or wait until
  the page is available before proceeding. Right now it just fails.
- Better user interface
- More configuration?
