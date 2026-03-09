const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

console.log('=== Zoom MCP App Starting ===');
console.log('__dirname:', __dirname);
console.log('isDev:', process.argv.includes('--dev'));

let mainWindow;
let serverProcess;
let tokenActionProcess;
let isDev = process.argv.includes('--dev');
const projectRoot = path.join(__dirname, '..');

function unquote(value) {
    const trimmed = value.trim();
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1);
    }
    return trimmed;
}

function readTokenFromEnv() {
    const envPath = path.join(projectRoot, '.env');
    if (!fs.existsSync(envPath)) return '';
    const content = fs.readFileSync(envPath, 'utf8');
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        if (!line.startsWith('ZOOM_ACCESS_TOKEN=')) continue;
        const value = line.slice('ZOOM_ACCESS_TOKEN='.length);
        return unquote(value);
    }
    return '';
}

function readTokenFromClaudeConfig() {
    const defaultPath = path.join(app.getPath('home'), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
    const configPath = process.env.CLAUDE_CONFIG_FILE || defaultPath;
    if (!fs.existsSync(configPath)) return '';

    try {
        const raw = fs.readFileSync(configPath, 'utf8');
        const parsed = JSON.parse(raw);
        return parsed?.mcpServers?.zoom?.env?.ZOOM_ACCESS_TOKEN || '';
    } catch (err) {
        console.error('Failed to parse Claude config for token:', err.message);
        return '';
    }
}

function getCurrentTokenInfo() {
    const tokenFromEnv = readTokenFromEnv();
    if (tokenFromEnv) return { token: tokenFromEnv, source: '.env' };

    const tokenFromConfig = readTokenFromClaudeConfig();
    if (tokenFromConfig) return { token: tokenFromConfig, source: 'Claude config' };

    return { token: '', source: 'not found' };
}

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
            stdio: ['pipe', 'pipe', 'pipe'],
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

function sendWindowMessage(type, message) {
    if (!mainWindow) return;
    mainWindow.webContents.send('server-message', { type, message });
}

function runTokenAction(scriptName, args, actionLabel) {
    if (tokenActionProcess && !tokenActionProcess.killed) {
        sendWindowMessage('info', '⚠️ Another token action is already running');
        return;
    }

    const scriptPath = path.join(projectRoot, 'scripts', scriptName);
    const scriptCwd = path.dirname(scriptPath);

    if (!fs.existsSync(scriptPath)) {
        sendWindowMessage('stderr', `❌ Missing script: ${scriptName}`);
        return;
    }

    sendWindowMessage('info', `⏳ Running token action: ${actionLabel}`);
    sendWindowMessage('info', `📝 Running: ${scriptName}`);

    tokenActionProcess = spawn('bash', [scriptPath, ...args], {
        cwd: scriptCwd,
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    tokenActionProcess.stdout.on('data', (data) => {
        const message = data.toString().trim();
        if (message) sendWindowMessage('stdout', message);
    });

    tokenActionProcess.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message) sendWindowMessage('stderr', message);
    });

    tokenActionProcess.on('close', (code) => {
        const success = code === 0;
        sendWindowMessage(success ? 'stdout' : 'close', success
            ? `✅ Token action complete: ${actionLabel}`
            : `❌ Token action failed (${actionLabel}) with code ${code}`);
        tokenActionProcess = null;
    });

    tokenActionProcess.on('error', (err) => {
        sendWindowMessage('stderr', `❌ Token action error (${actionLabel}): ${err.message}`);
        tokenActionProcess = null;
    });
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
    const hasProcess = serverProcess != null && !serverProcess.killed;
    console.log('IPC: get-status, process running:', hasProcess);
    event.reply('server-status', { running: hasProcess });
});

ipcMain.on('check-token', () => {
    console.log('IPC: check-token received');
    runTokenAction('check_zoom_token.sh', ['-v'], 'check token');
});

ipcMain.on('refresh-token', () => {
    console.log('IPC: refresh-token received');
    runTokenAction('get_zoom_token.sh', ['-f'], 'refresh token');
});

ipcMain.on('get-current-token', (event) => {
    const tokenInfo = getCurrentTokenInfo();
    event.reply('current-token', tokenInfo);
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
