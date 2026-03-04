# Zoom MCP Server

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that integrates Zoom API with Claude Desktop. Manage meetings, users, and recordings directly from Claude with automatic token refresh and seamless setup.

## Features

- **9 Zoom API Tools**: Meeting management (list, create, update, delete), user management, participants, and recordings
- **Smart Token Management**: Checks existing tokens before fetching new ones (avoids unnecessary API calls)
- **Enhanced User Experience**: Clear emoji-based status messages and time displayed in minutes for easy reading
- **Automatic Token Refresh**: When running, the MCP server monitors token expiration and automatically refreshes when expiring soon (within 5 minutes, configurable)
- **Token Expiration Countdown**: Periodic display in terminal showing when your access token expires (updates every 60 seconds, configurable)
- **One-Command Setup**: Single script handles token fetch, config update, Claude restart, and server startup
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
   
   This script will:
   - Open your Zoom upcoming meetings page in your default browser
   - Check if access token is expired (or skip if using `-f`)
   - Fetch a new token if needed (or force fetch with `-f`)
   - Update Claude Desktop config
   - Restart Claude Desktop app if running (or launch it if not running) when token/config changes
   - Ensure Claude Desktop is open before starting the MCP server

## Scripts Reference

| Script | Purpose |
|--------|---------|
| **`run.sh`** | Main entry point - opens Zoom upcoming meetings page, orchestrates token check, refresh, config update, Claude restart, and server startup. Supports `-f` flag to force new token fetch |
| **`get_zoom_token.sh`** | Smart token fetcher that checks for existing valid tokens first. Only fetches from Zoom API if current token is expired/missing. Shows full token with enhanced visual feedback (🔄 🔍 ✅ ⚠️ ❌). Supports `-f` flag to skip validation and force fetch |
| **`check_zoom_token.sh`** | Validates current token by checking JWT expiration. Displays time remaining in minutes. Enhanced messaging with emojis for all statuses (✅ ⏰ ❌ 🔍) |
| **`update_claude_config.sh`** | Injects `ZOOM_ACCESS_TOKEN` into Claude Desktop config file |
| **`restart_claude_app.sh`** | Restarts Claude Desktop if running, or opens it if not running (macOS) |

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
  - Enhanced visual feedback:
    - 🔍 Checking existing token
    - ✅ Token still valid - using existing
    - 🔄 Requesting new token from API
    - 💾 Token saved successfully
    - ❌ Clear error messages for all failure cases
  - Displays **full token** (not just preview) for easy copying
  - Shows token length for validation

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
ZOOM_TOKEN_DISPLAY_INTERVAL # How often to display token expiration countdown in seconds (default: 60)
ZOOM_CHECK_VERBOSE          # Enable verbose logging (set to any non-empty value)
ZOOM_CHECK_LOGFILE          # Log file path (default: ./logs/zoom_token.log)
```

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
      "args": ["/absolute/path/to/zoommcp/index.js"],
      "env": {
        "ZOOM_ACCESS_TOKEN": "your_access_token_here"
      }
    }
  }
}
```

The `update_claude_config.sh` script automatically updates this configuration with your current access token.

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
Zoom MCP Server running on stdio
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
  - Run `./get_zoom_token.sh` to fetch a new token
  - Ensure `.env` file exists with proper credentials (see `.env.example`)

- **"⏰ EXPIRED: Token expired at [time]"**
  - Run `./get_zoom_token.sh` to fetch a fresh token
  - The script will automatically check and only fetch if needed

- **Token expires quickly**
  - Zoom Server-to-Server OAuth tokens typically last 1 hour
  - The `run.sh` script automatically refreshes when needed
  - `get_zoom_token.sh` now checks existing tokens first (only fetches when expired)
  - Adjust `ZOOM_TOKEN_THRESHOLD` if you want earlier refresh warnings

### Claude Desktop Not Connecting
- Check that Claude Desktop config path is correct
- Verify the `args` path in config points to your `index.js` file (use absolute path)
- Restart Claude Desktop after config changes
- Check Claude Desktop logs: `~/Library/Logs/Claude/mcp*.log`

### Claude App Launch Behavior
- `./restart_claude_app.sh` now checks whether Claude is running first
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
  1. Fetches a new token via `get_zoom_token.sh`
  2. Updates the Claude Desktop config
  3. Restarts Claude Desktop
  4. Continues serving with the new token (seamless to Claude)
- Watch the terminal for messages like:
  - `⏳ Token expiring soon! Automatically refreshing...`
  - `✅ Token refresh complete! New token is now active.`
- Customize the refresh threshold with `ZOOM_AUTO_REFRESH_THRESHOLD=600` (in seconds; default: 300 = 5 minutes)
- No manual intervention needed — this happens automatically while the server runs

### Permission Denied on Scripts
```bash
chmod +x *.sh  # Make all shell scripts executable
```

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
├── run.sh                     # Main orchestration script
├── get_zoom_token.sh          # Token fetcher
├── check_zoom_token.sh        # Token validator
├── update_claude_config.sh    # Claude config updater
├── restart_claude_app.sh      # Claude app restarter
└── logs/                      # Optional log directory
```

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## License

MIT

## Related Resources

- [Model Context Protocol Documentation](https://modelcontextprotocol.io)
- [Zoom API Reference](https://developers.zoom.us/docs/api/)
- [Claude Desktop](https://claude.ai/download)
- [Zoom Marketplace](https://marketplace.zoom.us/) (create OAuth apps here)
