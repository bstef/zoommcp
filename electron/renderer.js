// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const checkTokenBtn = document.getElementById('checkTokenBtn');
    const refreshTokenBtn = document.getElementById('refreshTokenBtn');
    const restartClaudeBtn = document.getElementById('restartClaudeBtn');
    const clearBtn = document.getElementById('clearBtn');
    const logsContainer = document.getElementById('logsContainer');
    const statusIndicator = document.getElementById('statusIndicator');
    const tokenContainer = document.getElementById('tokenContainer');
    const tokenSource = document.getElementById('tokenSource');

    if (!startBtn || !stopBtn || !checkTokenBtn || !refreshTokenBtn || !restartClaudeBtn || !clearBtn || !logsContainer || !statusIndicator || !tokenContainer || !tokenSource) {
        console.error('Failed to find required DOM elements');
        return;
    }

    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    let serverRunning = false;
    let tokenActionRunning = false;

    function updateTokenButtons() {
        checkTokenBtn.disabled = tokenActionRunning;
        refreshTokenBtn.disabled = tokenActionRunning;
        restartClaudeBtn.disabled = tokenActionRunning;
    }

    function updateTokenPanel(data) {
        if (!data || !data.token) {
            tokenContainer.textContent = 'No token found in .env or Claude config.';
            tokenSource.textContent = 'Source: not found';
            return;
        }

        tokenContainer.textContent = data.token;
        tokenSource.textContent = `Source: ${data.source || 'unknown'}`;
    }

    // Start server
    startBtn.addEventListener('click', () => {
        window.electronAPI.startServer();
        logMessage('Starting MCP server...', 'info');
    });

    // Stop server
    stopBtn.addEventListener('click', () => {
        window.electronAPI.stopServer();
        logMessage('Stopping MCP server...', 'info');
    });

    // Clear logs
    clearBtn.addEventListener('click', () => {
        logsContainer.innerHTML = '';
        logMessage('Logs cleared', 'info');
    });

    checkTokenBtn.addEventListener('click', () => {
        if (tokenActionRunning) return;
        window.electronAPI.checkToken();
    });

    refreshTokenBtn.addEventListener('click', () => {
        if (tokenActionRunning) return;
        window.electronAPI.refreshToken();
    });

    restartClaudeBtn.addEventListener('click', () => {
        if (tokenActionRunning) return;
        window.electronAPI.restartClaude();
    });

    // Status panel elements
    const statusPanel = document.getElementById('statusPanel');
    const statusClaudeVal = document.getElementById('statusClaudeVal');
    const statusTokenVal = document.getElementById('statusTokenVal');
    const statusMcpVal = document.getElementById('statusMcpVal');
    const statusActivity = document.getElementById('statusActivity');
    const statusActivityVal = document.getElementById('statusActivityVal');

    function updateStatusPanel(msg) {
        // Claude Desktop
        if (msg.includes('Claude Desktop is running')) {
            statusClaudeVal.textContent = '✅ Running';
            statusPanel.style.display = '';
        } else if (msg.includes('Claude Desktop is not running')) {
            statusClaudeVal.textContent = '⚠️ Not running';
            statusPanel.style.display = '';
        }

        // Token status
        const tokenMatch = msg.match(/🔑 Token Status: (.+)/);
        if (tokenMatch) {
            statusTokenVal.textContent = tokenMatch[1].trim();
            statusPanel.style.display = '';
        }
        if (msg.includes('Token refresh complete')) {
            statusTokenVal.textContent = '✅ Refreshed';
        }
        if (msg.includes('Token refreshed')) {
            const refreshMatch = msg.match(/Token refreshed - (.+)/);
            if (refreshMatch) statusTokenVal.textContent = '✅ ' + refreshMatch[1].trim();
        }
        const tokenValidMatch = msg.match(/✅ VALID: Token expires at (.+)/);
        if (tokenValidMatch) {
            statusTokenVal.textContent = '✅ ' + tokenValidMatch[1].trim();
            statusPanel.style.display = '';
        }
        if (msg.includes('EXPIRED: Token expired')) {
            statusTokenVal.textContent = '⏰ Expired';
            statusPanel.style.display = '';
        }
        if (msg.includes('MISSING: ZOOM_ACCESS_TOKEN')) {
            statusTokenVal.textContent = '❌ Missing token';
            statusPanel.style.display = '';
        }
        if (msg.includes('Token action complete: refresh token')) {
            statusTokenVal.textContent = '✅ Refreshed';
            statusPanel.style.display = '';
        }

        // MCP server
        if (msg.includes('Zoom MCP Server is running on stdio')) {
            statusMcpVal.textContent = '✅ Running';
            statusPanel.style.display = '';
        } else if (msg.includes('Server exited') || msg.includes('disconnected')) {
            statusMcpVal.textContent = '⛔ Stopped';
        }

        // Activity
        const activityPatterns = [
            /⏳ (.+)/,
            /📝 Running: (.+)/,
            /⚙️\s+Running: (.+)/,
            /🚀 Running: (.+)/,
            /🔄 (.+)/,
        ];
        for (const pattern of activityPatterns) {
            const m = msg.match(pattern);
            if (m) {
                statusActivityVal.textContent = m[0].trim();
                statusActivity.style.display = '';
                // Hide activity after 5 seconds
                clearTimeout(statusActivity._hideTimer);
                statusActivity._hideTimer = setTimeout(() => {
                    statusActivity.style.display = 'none';
                }, 5000);
                break;
            }
        }
    }

    // Listen for server messages
    window.electronAPI.onServerMessage((data) => {
        logMessage(data.message, data.type);
        updateStatusPanel(data.message);

        if (data.message.includes('Running token action:')) {
            tokenActionRunning = true;
            updateTokenButtons();
        }
        if (data.message.includes('Token action complete:') || data.message.includes('Token action failed')) {
            tokenActionRunning = false;
            updateTokenButtons();
            window.electronAPI.getCurrentToken();
        }

        // Update status based on messages
        if (data.message.includes('running on stdio')) {
            updateStatus(true);
        } else if (data.message.includes('disconnected') || data.message.includes('exited')) {
            updateStatus(false);
        }
    });

    // Listen for status updates
    window.electronAPI.onServerStatus((data) => {
        updateStatus(data.running);
    });

    window.electronAPI.onCurrentToken((data) => {
        updateTokenPanel(data);
    });

    // Log message helper
    function logMessage(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;

        // Add timestamp
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${message}`;

        logsContainer.appendChild(entry);
        logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    // Update status indicator
    function updateStatus(running) {
        serverRunning = running;
        startBtn.disabled = running;
        stopBtn.disabled = !running;

        if (running) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Server Running';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Server Offline';
        }
    }

    // Check initial status on load
    window.electronAPI.getStatus();
    window.electronAPI.checkToken();
    window.electronAPI.getCurrentToken();

    // Keep token status current while app is open.
    const tokenPollTimer = setInterval(() => {
        if (!tokenActionRunning) {
            window.electronAPI.checkToken();
            window.electronAPI.getCurrentToken();
        }
    }, 30000);

    window.addEventListener('beforeunload', () => {
        clearInterval(tokenPollTimer);
    });

    // Handle preferences
    window.electronAPI.onOpenPreferences(() => {
        logMessage('Preferences feature coming soon', 'info');
    });

    updateTokenButtons();
});
