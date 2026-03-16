# Zoom MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that integrates Zoom API with Claude Desktop. Manage meetings, users, and recordings directly from Claude with automatic token refresh and seamless setup.

## Branch Focus (main)

This is the stable Claude Desktop branch. It prioritizes the core stdio MCP workflow, reliable token lifecycle handling, and low-friction local setup.

## Features

- **9 Zoom API Tools**: Meeting management (list, create, update, delete), user management, participants, and recordings
- **Smart Token Management**: Refreshes only when token is expired (or when force mode is used); never redundantly re-fetches valid tokens
- **Enhanced User Experience**: Clear emoji-based status messages and time displayed in minutes for easy reading
- **Automatic Token Refresh**: When running, the MCP server monitors token expiration and automatically refreshes when expiring soon (within 5 minutes, configurable)
- **Anti-Infinite-Loop Safeguards**: 30-second cooldown between refresh attempts and max 3 failures before disabling auto-refresh (prevents restart loops)
- **Immediate Status Display**: Shows new token validity immediately after refresh (no 60-second wait)
- **Token Expiration Monitoring**: Periodic display in terminal showing when your access token expires with visual separators and color-coded status (updates every 60 seconds, configurable)
- **Reliable Claude App Detection**: Multi-method startup verification ensures Claude Desktop is fully running before server starts (up to 15 retries with multiple detection methods)
- **Automatic Claude Recovery**: If Claude closes while running, the monitor detects it and attempts to reopen it
- **One-Command Setup**: `./run.sh` keeps the banner UX and delegates unified startup to `run-mcp.sh`
- **Claude Launch Hardening**: `launch-mcp.js` avoids shell execution issues in Claude MCP environments on macOS/iCloud paths
- **Production Ready**: Comprehensive error handling, logging support, and cross-platform compatibility

## Prerequisites

- **Node.js** 18+ (check with `node --version`)
- **Zoom Account** with API access
- **Zoom Server-to-Server OAuth App** ([create one here](https://marketplace.zoom.us/))
  - Required scopes: `meeting:read`, `meeting:write`, `user:read`, `recording:read`
- **Claude Desktop** ([download](https://claude.ai/download))
- **python3** (for token validation, typically pre-installed on macOS/Linux)

## Quick Start

1. **Clone and install**
   ```bash
   git clone <your-repo-url>
   cd zoommcp
   npm install
   ```

2. **Configure Zoom credentials**
   ```bash
   cp .env.example .env
   # Edit .env and add your Zoom OAuth credentials:
   # ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID
   ```

3. **Run the server** (handles everything automatically)
   ```bash
   chmod +x *.sh  # Make scripts executable (first time only)
   ./run.sh       # Normal run - only refreshes if token expired
   ./run.sh -f    # Force new token fetch before starting
   ```
   
   **Options:**
   - `-f, --force` - Force fetch a new token even if current one is valid
   - `-h, --help`  - Show help message
   
  `./run.sh` will:
   - Open your Zoom upcoming meetings page in your default browser
  - Show startup banner and mode (normal vs force)
  - Ensure Claude Desktop is running (opens it when needed)
  - Refresh token only when expired (or force refresh with `-f`)
  - Start MCP server with periodic token/Claude status monitoring

### Sample Output

When you run `./run.sh`, you'll see output like this:

```
╔════════════════════════════════════════════════════════════════════╗
║                      ZOOM MCP SERVER                               ║
║               Connect Claude with Your Zoom Meetings               ║
╚════════════════════════════════════════════════════════════════════╝

════════════════════════════════════════════════════════════════════
🔧 Configuration: Smart token validation (only refresh if expired)
════════════════════════════════════════════════════════════════════

Opening Zoom meetings page...

📝 If you're not already signed in:
   → Sign in with your Google email (benjaminstef.com)
   → If already authenticated, page will load your current meetings

🚀 Starting Zoom MCP Server...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Claude Desktop is running
✅ Zoom token is still valid. No refresh needed.
🚀 Starting Zoom MCP server...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Zoom MCP Server is running on stdio
🔄 Token monitoring active - updates every 60 seconds
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Token Status: ✅ Expires in 57m 29s (at 1:51:23 PM)
```

Every 60 seconds, you'll see a periodic token status update with visual separators. The status indicator changes based on token expiration:
- **✅** Fresh token (>15 minutes remaining)
- **📊** Token expiring soon (5-15 minutes remaining)
- **⚠️** Token expiring very soon (<5 minutes) - auto-refresh triggers

The server is now running and Claude Desktop can access your Zoom account!

### Automatic Token Refresh Example

While the server is running, if your token expires or is expiring soon (within 5 minutes), you'll see an automatic refresh happen:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔑 Token Status: ⚠️ Expires in 2m 15s (at 2:58:31 PM)
⏳ Token expiring soon! Automatically refreshing...
📝 Running: get_zoom_token.sh
📋 Token fetched successfully
🔄 Loading new token from .env
✅ Token updated: eyJz...NTMz → eyJz...VjgT
⚙️  Running: update_claude_config.sh
🚀 Running: restart_claude_app.sh
✅ Token refresh complete! New token is now active.
🔑 Token Status: ✅ Expires in 59m 45s (at 3:58:05 PM)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

This automatic refresh happens seamlessly without any action needed on your part. The server continues running without interruption. New token validity is shown immediately after refresh (no waiting for next 60s cycle).

**Refresh Safety:**
- Token refresh is throttled with a 30-second cooldown between attempts
- If refresh fails 3 times consecutively, auto-refresh is disabled to prevent restart loops
- Manual recovery: `./scripts/get_zoom_token.sh -f` to fetch a fresh token

## Scripts Reference

All shell scripts are located in the `scripts/` folder for better organization.

| Script | Purpose |
|--------|---------|
| **`run.sh`** | Main user entrypoint (at root) with banner/UI. Opens Zoom upcoming meetings and delegates startup to `run-mcp.sh`. Supports `-f` |
| **`run-mcp.sh`** | Unified startup engine. Ensures Claude is running, refreshes token only if expired (or force), then starts MCP server |
| **`launch-mcp.js`** | Claude MCP-safe launcher (`node launch-mcp.js`) that loads `.env`/token and starts `index.js` without shell script execution |
| **`scripts/get_zoom_token.sh`** | Smart token fetcher that checks for existing valid tokens first. Only fetches from Zoom API if current token is expired/missing. Shows full token with enhanced visual feedback (🔄 🔍 ✅ ⚠️ ❌). Supports `-f` flag to skip validation and force fetch |
| **`scripts/check_zoom_token.sh`** | Validates current token by checking JWT expiration. Displays time remaining in minutes. Enhanced messaging with emojis for all statuses (✅ ⏰ ❌ 🔍) |
| **`scripts/update_claude_config.sh`** | Injects `ZOOM_ACCESS_TOKEN` into Claude Desktop config file and restarts Claude to force config reload |
| **`scripts/restart_claude_app.sh`** | Restarts Claude Desktop if running, or opens it if not running. Includes smart startup verification with multiple detection methods (up to 15 retries) to ensure Claude is fully running before proceeding |

### Token Validation Details

The token management system now includes smart validation:
- **`check_zoom_token.sh`**: Parses JWT payload and checks `exp` (expiration) claim
  - Displays remaining time in **minutes** for better readability
  - Enhanced status messages with emojis:
    - 🔍 Checking token
    - ✅ Token is valid (Xm remaining)
    - ⏰ Token expired
    - ⚠️ Token expires soon (within threshold)
    - ❌ Token missing or invalid
  - Refreshes token if expiring within 60 seconds (configurable via `ZOOM_TOKEN_THRESHOLD`)
  - Falls back to refresh if `python3` is unavailable for safety
  - Supports optional verbose logging to `./logs/zoom_token.log`

- **`get_zoom_token.sh`**: Smart fetcher that avoids unnecessary API calls
  - Checks for existing valid token **before** making API call
  - Only fetches new token if current one is expired/missing (>1 minute threshold)
  - Uses atomic file writes (temp file + move) for safe .env updates on iCloud Drive
  - Python token parsing with proper argument handling (no stdin shell interpolation issues)
  - Enhanced visual feedback:
    - 🔍 Checking existing token
    - ✅ Token still valid - using existing
    - 🔄 Requesting new token from API
    - 📋 Token fetched successfully
    - 💾 Token saved to .env
    - ❌ Clear error messages for all failure cases
  - Displays **full token** (not just preview) for easy copying
  - Shows token length for validation
  - Force mode (`-f`) bypasses validation and always fetches new token

### Environment Variables

**Required:**
```bash
ZOOM_CLIENT_ID          # Your Zoom OAuth app client ID
ZOOM_CLIENT_SECRET      # Your Zoom OAuth app client secret
ZOOM_ACCOUNT_ID         # Your Zoom account ID
```

**Optional:**
```bash
ZOOM_ACCESS_TOKEN           # Auto-populated by get_zoom_token.sh
CLAUDE_CONFIG_FILE          # Override Claude config path (default: macOS standard location)
CLAUDE_MCP_SERVER_NAME      # Override MCP server name (default: "zoom")
CLAUDE_ZOOM_ENV_KEY         # Override env variable name (default: "ZOOM_ACCESS_TOKEN")
ZOOM_TOKEN_THRESHOLD        # Token refresh threshold in seconds (default: 60)
ZOOM_AUTO_REFRESH_THRESHOLD # Seconds before token expires to auto-refresh (default: 300, or 5 minutes)
ZOOM_TOKEN_DISPLAY_INTERVAL # How often to display token status updates in seconds (default: 60)
ZOOM_CHECK_VERBOSE          # Enable verbose logging (set to any non-empty value)
ZOOM_CHECK_LOGFILE          # Log file path (default: ./logs/zoom_token.log)
ZOOM_APP_AUTOSTART          # Electron app only: auto-start MCP on launch (default: enabled)
ZOOM_ENV_FILE               # Optional explicit .env path for app startup token loading
```

**Customizing Token Monitoring:**
```bash
# Display token status every 30 seconds
ZOOM_TOKEN_DISPLAY_INTERVAL=30 ./run.sh

# Display token status every 2 minutes
ZOOM_TOKEN_DISPLAY_INTERVAL=120 ./run.sh
```

## Startup Modes

- **Interactive local startup**: use `./run.sh` (recommended)
  - Best for terminal-driven startup with banner and Zoom browser opening.
- **Engine-only startup**: use `./run-mcp.sh`
  - Same startup checks without banner/browser step.
- **Claude MCP startup**: configure Claude to run `node launch-mcp.js`
  - Avoids macOS shell execution restrictions from Claude log contexts.
- **Native macOS app startup**: run `npm run app` for dev or open `dist/mac-arm64/Zoom MCP.app` after build
  - Packaged app auto-starts MCP by default. Set `ZOOM_APP_AUTOSTART=0` to disable.

## Claude Desktop Configuration

The server integrates with Claude Desktop via the MCP configuration file.

**Default location on macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Example configuration:**
```json
{
  "mcpServers": {
    "zoom": {
      "command": "node",
      "args": ["/absolute/path/to/zoommcp/launch-mcp.js"]
    }
  }
}
```

`launch-mcp.js` loads token values from `.env` and Claude config when present, then starts `index.js`.

### Manual Setup (Alternative)

If you prefer manual setup:

1. Run the server directly:
   ```bash
   ZOOM_ACCESS_TOKEN="your_token" node index.js
   ```

2. Or use with Claude Desktop by manually editing the config file above.

## Development

### Running in Development Mode
```bash
npm run dev  # Runs with --watch flag for auto-restart on file changes
```

### Testing the Server Standalone
```bash
# Set environment variable and run
export ZOOM_ACCESS_TOKEN="your_token_here"
node index.js
```

The server communicates via stdio and will output:
```
✅ Zoom MCP Server is running on stdio
```

## Available Tools

### Meeting Management
- **`list_meetings`** - List scheduled, live, upcoming, or previous meetings
  - Parameters: `type` (scheduled|live|upcoming|previous_meetings), `page_size` (max 300)
  
- **`get_meeting`** - Get detailed information about a specific meeting
  - Parameters: `meeting_id` (required)
  
- **`create_meeting`** - Create a new Zoom meeting
  - Parameters: `topic` (required), `type`, `start_time`, `duration`, `timezone`, `agenda`, `password`, `settings`
  
- **`update_meeting`** - Update an existing meeting's settings
  - Parameters: `meeting_id` (required), `topic`, `start_time`, `duration`, `agenda`, `settings`
  
- **`delete_meeting`** - Delete a scheduled meeting
  - Parameters: `meeting_id` (required), `occurrence_id` (optional, for recurring meetings)

### User Management
- **`list_users`** - List users in your Zoom account
  - Parameters: `status` (active|inactive|pending), `page_size` (max 300)
  
- **`get_user`** - Get information about a specific user
  - Parameters: `user_id` (required, user ID or email)

### Recordings & Participants
- **`get_meeting_participants`** - Get participant list for a past meeting
  - Parameters: `meeting_id` (required), `page_size` (max 300)
  
- **`get_meeting_recordings`** - Get cloud recordings for a meeting
  - Parameters: `meeting_id` (required)

## Usage Examples in Claude

```
"Show me my upcoming Zoom meetings"

"Create a Zoom meeting titled 'Team Standup' for tomorrow at 10am EST, 30 minutes duration"

"Get the details for Zoom meeting ID 123456789"

"Update meeting 123456789 to start at 2pm instead"

"List all active users in my Zoom account"

"Cancel the Zoom meeting with ID 123456789"

"Show me the participants from meeting 987654321"

"Get the recording for meeting 456789123"
```

## Troubleshooting

### Token Issues
- **"❌ MISSING: ZOOM_ACCESS_TOKEN not found in .env file"**
  - Run `./scripts/get_zoom_token.sh` to fetch a new token
  - Ensure `.env` file exists with proper credentials (see `.env.example`)

- **"⏰ EXPIRED: Token expired at [time]"**
  - Run `./scripts/get_zoom_token.sh` to fetch a fresh token
  - The script will automatically check and only fetch if needed

- **Token expires quickly**
  - Zoom Server-to-Server OAuth tokens typically last 1 hour
  - The `run.sh` script automatically refreshes when needed
  - `get_zoom_token.sh` now checks existing tokens first (only fetches when expired)
  - Adjust `ZOOM_TOKEN_THRESHOLD` if you want earlier refresh warnings

### Claude Desktop Not Connecting
- Check that Claude Desktop config path is correct
- Verify the `args` path in config points to your `launch-mcp.js` file (use absolute path)
- Restart Claude Desktop after config changes
- Check Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log`

### Claude App Launch Behavior
- `./scripts/restart_claude_app.sh` now checks whether Claude is running first
- If Claude is running, it performs a restart
- If Claude is not running, it opens Claude automatically

### Token Expiration Countdown
- When the MCP server starts, it displays: `🔑 Zoom Token Status: Expires in XXm XXs at HH:MM:SS AM/PM`
- This countdown updates periodically (every 60 seconds by default)
- Customize the update frequency with `ZOOM_TOKEN_DISPLAY_INTERVAL=30` (in seconds)
- Use `ZOOM_TOKEN_DISPLAY_INTERVAL=0` to disable the periodic countdown display

### Automatic Token Refresh
- While the MCP server is running, it monitors token expiration in the background
- When the token is expiring within 5 minutes (configurable), the server automatically:
  1. Fetches a new token via `get_zoom_token.sh` (with iCloud-safe atomic writes)
  2. Loads the new token into memory from `.env` file
  3. Updates the Claude Desktop config JSON
  4. Restarts Claude Desktop to pick up new token
  5. Displays new token validity immediately (no 60-second wait)
  6. Continues serving with the new token (seamless to Claude)
- **Anti-Loop Protection:**
  - 30-second cooldown between refresh attempts (prevents rapid cycling)
  - Auto-refresh disabled after 3 consecutive failures
  - Manual recovery: `./scripts/get_zoom_token.sh -f`
- Watch the terminal for messages like:
  - `⏳ Token expiring soon! Automatically refreshing...`
  - `🔄 Loading new token from .env`
  - `✅ Token updated: [old_preview] → [new_preview]`
  - `🔑 Token Status: ✅ Expires in 59m 45s (at HH:MM:SS)`
- Customize the refresh threshold with `ZOOM_AUTO_REFRESH_THRESHOLD=600` (in seconds; default: 300 = 5 minutes)
- No manual intervention needed — this happens automatically while the server runs

### Permission Denied on Scripts
```bash
chmod +x *.sh  # Make all shell scripts executable
chmod +x scripts/*.sh  # Also for scripts subdirectory
```

### Token Not Updating in .env
- Fixed: `get_zoom_token.sh` now uses Python with proper argument handling
- Uses atomic writes (temp file → atomic move) for safe iCloud Drive updates
- Verify token was written: `grep ZOOM_ACCESS_TOKEN .env | wc -c` (should be >600 chars)
- If still not updating, check file permissions: `ls -l .env`

### Token Validation Fails
- **Issue**: `check_zoom_token.sh` shows token as expired even after refresh
- **Cause**: Old token still in environment or Python parsing issue
- **Fix**: `source .env && ./scripts/check_zoom_token.sh` (reload environment)
- Verify token in .env: `grep ZOOM_ACCESS_TOKEN .env | grep -o 'ey[A-Za-z0-9]*' | wc -c` (>100 chars)

### Stuck in Auto-Refresh Loop
- **Fixed**: Server now has 30-second cooldown and max 3 failures before disabling auto-refresh
- If stuck, look for: `CRITICAL: Max refresh failures reached. Auto-refresh disabled.`
- Manual fix: `./scripts/get_zoom_token.sh -f && bash scripts/update_claude_config.sh`

### Python3 Not Found
- macOS/Linux: Usually pre-installed, try `python3 --version`
- Install via Homebrew (macOS): `brew install python3`
- Alternatively, install `jq` for JSON parsing: `brew install jq`

## Architecture

```
┌─────────────────┐
│  Claude Desktop │
└────────┬────────┘
         │ (stdio)
         ▼
┌─────────────────┐      ┌──────────────┐
│  MCP Server     │─────▶│  Zoom API    │
│  (index.js)     │◀─────│  (REST)      │
└─────────────────┘      └──────────────┘
         │
         ▼
┌─────────────────┐
│  Token Manager  │
│  (*.sh scripts) │
└─────────────────┘
```

## Project Structure

```
zoommcp/
├── index.js                    # Main MCP server implementation
├── package.json                # Node.js dependencies
├── .env.example               # Environment variables template
├── run.sh                     # Main entry point script
├── logs/                      # Optional log directory
├── scripts/                   # Shell scripts for automation
│   ├── check_zoom_token.sh    # Token validator
│   ├── get_zoom_token.sh      # Token fetcher
│   ├── restart_claude_app.sh  # Claude app restarter
│   └── update_claude_config.sh # Claude config updater
└── docs/                      # Documentation and presentation materials
    ├── ABOUT.txt              # Project overview (quick reference)
    ├── PRESENTATION.md        # Full presentation deck for stakeholders
    ├── EXECUTIVE_SUMMARY.md   # One-page overview for executives
    ├── SPEAKER_NOTES.md       # Detailed presentation guidance
    ├── QUICK_REFERENCE.md     # Cheat sheet for demos
    ├── PRESENTATION_CHECKLIST.md  # Day-of presentation guide
    └── PRESENTATION_INDEX.md  # Documentation navigation guide
```

## Additional Documentation

For presentations, detailed guides, and executive summaries, see the **[docs/](docs/)** folder:

- **[docs/ABOUT.txt](docs/ABOUT.txt)** - Quick project overview with key concepts
- **[docs/PRESENTATION.md](docs/PRESENTATION.md)** - Complete slide deck for presenting to management
- **[docs/EXECUTIVE_SUMMARY.md](docs/EXECUTIVE_SUMMARY.md)** - One-page summary for executives
- **[docs/PRESENTATION_INDEX.md](docs/PRESENTATION_INDEX.md)** - Guide to using all presentation materials

Perfect for:
- 🎯 Presenting the project to stakeholders
- 📊 Executive briefings
- 🎤 Live demos and walkthroughs
- 📚 Team onboarding

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## License

MIT

## Related Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [Zoom API Reference](https://developers.zoom.us/docs/api/)
- [Claude Desktop](https://claude.ai/download)
- [Zoom Marketplace](https://marketplace.zoom.us/) (create OAuth apps here)
