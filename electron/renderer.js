const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const logsContainer = document.getElementById('logsContainer');
const statusIndicator = document.getElementById('statusIndicator');
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

// Listen for server messages
window.electronAPI.onServerMessage((data) => {
  logMessage(data.message, data.type);

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
