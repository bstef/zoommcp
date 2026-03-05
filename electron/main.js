import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let serverProcess;
let isDev = process.argv.includes('--dev');

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

function createWindow() {
    const iconPath = path.join(__dirname, '../assets/icon.png');
    const iconExists = fs.existsSync(iconPath);

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        ...(iconExists && { icon: iconPath }),
    });

    const startUrl = isDev
        ? 'http://localhost:3000'
        : `file://${path.join(__dirname, 'index.html')}`;

    mainWindow.loadURL(startUrl).catch((err) => {
        console.error('Failed to load URL:', err);
    });

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        stopServer();
    });
}

function startServer() {
    const projectRoot = path.join(__dirname, '..');
    const runScript = path.join(projectRoot, 'run-mcp.sh');

    serverProcess = spawn('bash', [runScript], {
        cwd: projectRoot,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        if (mainWindow) {
            mainWindow.webContents.send('server-message', { type: 'stdout', message });
        }
        console.log(message);
    });

    serverProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (mainWindow) {
            mainWindow.webContents.send('server-message', { type: 'stderr', message });
        }
        console.error(message);
    });

    serverProcess.on('close', (code) => {
        if (mainWindow) {
            mainWindow.webContents.send('server-message', {
                type: 'close',
                message: `Server exited with code ${code}`,
            });
        }
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

function createMenu() {
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
                    click: async () => {
                        const { shell } = await import('electron');
                        shell.openExternal('https://github.com/bstef/zoommcp');
                    },
                },
            ],
        },
    ];

    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// IPC handlers
ipcMain.on('start-server', () => {
    startServer();
});

ipcMain.on('stop-server', () => {
    stopServer();
});

ipcMain.on('get-status', (event) => {
    const hasProcess = serverProcess !== null && !serverProcess.killed;
    event.reply('server-status', { running: hasProcess });
});

// App lifecycle
app.on('ready', () => {
    createWindow();
    createMenu();
    startServer();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

process.on('exit', () => {
    stopServer();
});
