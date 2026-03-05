import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    startServer: () => ipcRenderer.send('start-server'),
    stopServer: () => ipcRenderer.send('stop-server'),
    getStatus: () => ipcRenderer.send('get-status'),
    onServerMessage: (callback) => ipcRenderer.on('server-message', (event, data) => callback(data)),
    onServerStatus: (callback) => ipcRenderer.on('server-status', (event, data) => callback(data)),
    onOpenPreferences: (callback) => ipcRenderer.on('open-preferences', () => callback()),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
