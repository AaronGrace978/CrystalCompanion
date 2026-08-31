const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('crystal', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  listModels: (provider, settings) => ipcRenderer.invoke('models:list', { provider, settings }),
  sendChat: (messages, settings) => ipcRenderer.invoke('chat:send', { messages, settings }),
  getSongPath: () => ipcRenderer.invoke('app:getSongPath'),
  getSongBuffer: () => ipcRenderer.invoke('app:getSongBuffer'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getGuide: () => ipcRenderer.invoke('app:getGuide')
});
