const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');

function isSteamHandheld() {
  const env = process.env;
  if (env.SteamDeck === '1' || env.STEAMDECK === '1') return true;
  if (env.GAMESCOPE_WAYLAND_DISPLAY) return true;
  try {
    return /steamos|steamdeck/i.test(fs.readFileSync('/etc/os-release', 'utf8'));
  } catch {
    return false;
  }
}

const steamDeck = isSteamHandheld();
const gamescope = Boolean(
  process.env.GAMESCOPE_WAYLAND_DISPLAY ||
    /gamescope/i.test(process.env.XDG_CURRENT_DESKTOP || '') ||
    /gamescope/i.test(process.env.DESKTOP_SESSION || '')
);

contextBridge.exposeInMainWorld('crystal', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  listModels: (provider, settings) => ipcRenderer.invoke('models:list', { provider, settings }),
  sendChat: (messages, settings) => ipcRenderer.invoke('chat:send', { messages, settings }),
  getSongPath: () => ipcRenderer.invoke('app:getSongPath'),
  getSongBuffer: () => ipcRenderer.invoke('app:getSongBuffer'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  getGuide: () => ipcRenderer.invoke('app:getGuide'),
  platform: { steamDeck, gamescope }
});
