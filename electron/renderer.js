// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const stopBtn = document.getElementById('stopBtn');
    const clearBtn = document.getElementById('clearBtn');
    const logsContainer = document.getElementById('logsContainer');
    const statusIndicator = document.getElementById('statusIndicator');

    if (!startBtn || !stopBtn || !clearBtn || !logsContainer || !statusIndicator) {
        console.error('Failed to find required DOM elements');
        return;
    }

    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('.status-text');

    let serverRunning = false;

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

    // Handle preferences
    window.electronAPI.onOpenPreferences(() => {
        logMessage('Preferences feature coming soon', 'info');
    });
});
