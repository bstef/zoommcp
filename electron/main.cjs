const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

console.log('=== Zoom MCP App Starting ===');
console.log('__dirname:', __dirname);
console.log('isDev:', process.argv.includes('--dev'));

let mainWindow;
let serverProcess;
let isDev = process.argv.includes('--dev');

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('Another instance is already running');
    app.quit();
} else {
    app.on('second-instance', () => {
        console.log('Second instance attempted');
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

function startServer() {
    try {
        console.log('Starting MCP server...');
        const projectRoot = path.join(__dirname, '..');
        const runScript = path.join(projectRoot, 'run-mcp.sh');

        console.log('Project root:', projectRoot);
        console.log('Run script:', runScript);
        console.log('Script exists:', fs.existsSync(runScript));

        if (!fs.existsSync(runScript)) {
            console.warn('run-mcp.sh not found, server will not start');
            if (mainWindow) {
                mainWindow.webContents.send('server-message', {
                    type: 'stderr',
                    message: 'Error: run-mcp.sh script not found',
                });
            }
            return;
        }

        serverProcess = spawn('bash', [runScript], {
            cwd: projectRoot,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        console.log('Server process spawned with PID:', serverProcess.pid);

        serverProcess.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (mainWindow) {
                mainWindow.webContents.send('server-message', { type: 'stdout', message });
            }
            console.log('[SERVER]', message);
        });

        serverProcess.stderr.on('data', (data) => {
            const message = data.toString().trim();
            if (mainWindow) {
                mainWindow.webContents.send('server-message', { type: 'stderr', message });
            }
            console.error('[SERVER ERROR]', message);
        });

        serverProcess.on('close', (code) => {
            console.log('Server process closed with code:', code);
            if (mainWindow) {
                mainWindow.webContents.send('server-message', {
                    type: 'close',
                    message: `Server exited with code ${code}`,
                });
            }
        });

        serverProcess.on('error', (err) => {
            console.error('Server process error:', err);
            if (mainWindow) {
                mainWindow.webContents.send('server-message', {
                    type: 'stderr',
                    message: `Server error: ${err.message}`,
                });
            }
        });
    } catch (err) {
        console.error('Error starting server:', err);
    }
}

function stopServer() {
    try {
        if (serverProcess && !serverProcess.killed) {
            console.log('Killing server process');
            serverProcess.kill();
        }
        serverProcess = null;
    } catch (err) {
        console.error('Error stopping server:', err);
    }
}

function createMenu() {
    try {
        console.log('Creating menu...');
        const template = [
            {
                label: 'Zoom MCP',
                submenu: [
                    { role: 'about' },
                    { type: 'separator' },
                    {
                        label: 'Preferences',
                        accelerator: 'CmdOrCtrl+,',
                        click: () => {
                            if (mainWindow) mainWindow.webContents.send('open-preferences');
                        },
                    },
                    { type: 'separator' },
                    { role: 'quit' },
                ],
            },
            {
                label: 'Edit',
                submenu: [
                    { role: 'undo' },
                    { role: 'redo' },
                    { type: 'separator' },
                    { role: 'cut' },
                    { role: 'copy' },
                    { role: 'paste' },
                ],
            },
            {
                label: 'View',
                submenu: [
                    { role: 'reload' },
                    { role: 'forceReload' },
                    { role: 'toggleDevTools' },
                ],
            },
            {
                label: 'Help',
                submenu: [
                    {
                        label: 'GitHub',
                        click: () => {
                            const { shell } = require('electron');
                            shell.openExternal('https://github.com/bstef/zoommcp').catch(err => {
                                console.error('Error opening GitHub:', err);
                            });
                        },
                    },
                ],
            },
        ];

        Menu.setApplicationMenu(Menu.buildFromTemplate(template));
        console.log('Menu created');
    } catch (err) {
        console.error('Error creating menu:', err);
    }
}

function createWindow() {
    try {
        console.log('Creating window...');

        const windowConfig = {
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.cjs'),
            },
        };

        console.log('Creating BrowserWindow...');
        mainWindow = new BrowserWindow(windowConfig);
        console.log('BrowserWindow created');

        const htmlPath = path.join(__dirname, 'index.html');
        const fileUrl = `file://${htmlPath}`;
        console.log('Loading:', fileUrl);

        mainWindow.loadURL(fileUrl);
        console.log('URL loaded');

        if (isDev) {
            mainWindow.webContents.openDevTools();
        }

        mainWindow.on('closed', () => {
            console.log('Main window closed');
            mainWindow = null;
            stopServer();
        });

    } catch (err) {
        console.error('Error in createWindow:', err);
        process.exit(1);
    }
}

// IPC handlers
ipcMain.on('start-server', () => {
    console.log('IPC: start-server received');
    startServer();
});

ipcMain.on('stop-server', () => {
    console.log('IPC: stop-server received');
    stopServer();
});

ipcMain.on('get-status', (event) => {
    const hasProcess = serverProcess !== null && !serverProcess.killed;
    console.log('IPC: get-status, process running:', hasProcess);
    event.reply('server-status', { running: hasProcess });
});

// App lifecycle
console.log('Setting up app event listeners...');

app.whenReady()
    .then(() => {
        console.log('App whenReady promise resolved');
        createWindow();
        createMenu();
    })
    .catch((err) => {
        console.error('Error in whenReady:', err);
        process.exit(1);
    });

app.on('window-all-closed', () => {
    console.log('All windows closed');
    if (process.platform !== 'darwin') {
        console.log('Quitting app (not macOS)');
        app.quit();
    }
});

app.on('activate', () => {
    console.log('App activated');
    if (mainWindow === null) {
        createWindow();
    }
});

app.on('error', (err) => {
    console.error('App error:', err);
});

app.on('before-quit', () => {
    console.log('App before-quit');
    stopServer();
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
    process.exit(1);
});

process.on('exit', () => {
    console.log('Process exit');
    stopServer();
});
