const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  fetchModel: (data) => ipcRenderer.invoke('fetch-model', data),
  saveModel: (data) => ipcRenderer.invoke('save-model', data),
  openFile: () => ipcRenderer.invoke('open-file'), 
  onMenuAction: (callback) => ipcRenderer.on('menu-action', (event, action, value) => callback(action, value))
});