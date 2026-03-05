try {
    const { contextBridge, ipcRenderer } = require('electron');

    console.log('Preload: Setting up electronAPI');

    contextBridge.exposeInMainWorld('electronAPI', {
        startServer: () => {
            console.log('Preload: startServer called');
            ipcRenderer.send('start-server');
        },
        stopServer: () => {
            console.log('Preload: stopServer called');
            ipcRenderer.send('stop-server');
        },
        getStatus: () => {
            console.log('Preload: getStatus called');
            ipcRenderer.send('get-status');
        },
        onServerMessage: (callback) => {
            console.log('Preload: Setting up onServerMessage listener');
            ipcRenderer.on('server-message', (_event, data) => {
                console.log('Preload: Received server-message:', data);
                callback(data);
            });
        },
        onServerStatus: (callback) => {
            console.log('Preload: Setting up onServerStatus listener');
            ipcRenderer.on('server-status', (_event, data) => {
                console.log('Preload: Received server-status:', data);
                callback(data);
            });
        },
        onOpenPreferences: (callback) => {
            console.log('Preload: Setting up onOpenPreferences listener');
            ipcRenderer.on('open-preferences', () => {
                console.log('Preload: Received open-preferences');
                callback();
            });
        },
        removeAllListeners: (channel) => {
            ipcRenderer.removeAllListeners(channel);
        },
    });

    console.log('Preload: electronAPI setup complete');
} catch (err) {
    console.error('Preload error:', err);
    throw err;
}
