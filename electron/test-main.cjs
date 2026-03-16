const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('=== TEST: Minimal Electron App ===');

let mainWindow;

function createWindow() {
    console.log('TEST: Creating window');
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
    });

    console.log('TEST: Loading HTML');
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('closed', () => {
        console.log('TEST: Window closed');
        mainWindow = null;
    });
}

app.on('ready', () => {
    console.log('TEST: App ready');
    createWindow();
});

app.on('window-all-closed', () => {
    console.log('TEST: All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

console.log('TEST: Setup complete');
