const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  onLoadModel: (callback) => ipcRenderer.on('load-model', (_event, filePath) => callback(filePath)),
  onResetCamera: (callback) => ipcRenderer.on('reset-camera', () => callback()),
  onToggleWireframe: (callback) => ipcRenderer.on('toggle-wireframe', () => callback()),
  onToggleBackground: (callback) => ipcRenderer.on('toggle-background', () => callback()),
  getLanguage: () => ipcRenderer.invoke('get-language'),
  setLanguage: (lang) => ipcRenderer.invoke('set-language', lang),
  onSetLanguage: (callback) => ipcRenderer.on('set-language', (_event, lang) => callback(lang)),
});
