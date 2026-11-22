const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopPet', {
  hitRegions: regions => ipcRenderer.send('hit-regions', regions),
  showControls: () => ipcRenderer.send('show-controls'),
  dragState: state => ipcRenderer.send('drag-state', state),
  onDragPosition: callback => { ipcRenderer.on('drag-position', (_event, point) => callback(point)); },
  onCursor: callback => { ipcRenderer.on('cursor', (_event, point) => callback(point)); },
  onSettings: callback => { ipcRenderer.on('settings', (_event, settings) => callback(settings)); },
  onVisible: callback => { ipcRenderer.on('visible', (_event, visible) => callback(visible)); },
  onReset: callback => { ipcRenderer.on('reset-position', () => callback()); }
});
