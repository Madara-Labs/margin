const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  openPdfDialog: () => ipcRenderer.invoke('dialog:open-pdf'),
  getVersion: () => ipcRenderer.invoke('app:get-version'),
});
