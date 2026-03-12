# Zoom MCP Server

Power Claude and ChatGPT with Zoom. This MCP server wires Claude Desktop and ChatGPT Apps to the Zoom API for meetings, users, and recordings — with a clean token-refresh flow, a one-command run sequence, and full streaming HTTP support for ChatGPT.

## What You Get

- MCP server with Zoom meeting, user, and recording tools
- **Claude Desktop** support via `stdio` transport
- **ChatGPT Apps** support via `StreamableHTTP` transport
- OpenAI API key helper tool
- Token fetch + persistence in `.env`
- Claude Desktop config updater
- One-command run scripts that refresh the token only when expired

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Node.js 18+ | ESM modules required |
| Zoom account with API access | Free or paid |
| Zoom Server-to-Server OAuth app | Create in [Zoom App Marketplace](https://marketplace.zoom.us/) |
| Python 3 | Used for JWT expiry check in shell scripts |
| ngrok (ChatGPT only) | For tunneling local HTTP to public HTTPS |

### Create a Zoom Server-to-Server OAuth App

1. Go to [marketplace.zoom.us](https://marketplace.zoom.us/) → **Develop** → **Build App**
2. Choose **Server-to-Server OAuth**
3. Fill in the app name and description
4. Under **Scopes**, add: `meeting:read:admin`, `meeting:write:admin`, `user:read:admin`, `recording:read:admin`
5. Note your **Client ID**, **Client Secret**, and **Account ID**

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Add credentials to `.env`

```bash
ZOOM_CLIENT_ID="your_client_id"
ZOOM_CLIENT_SECRET="your_client_secret"
ZOOM_ACCOUNT_ID="your_account_id"
OPENAI_API_KEY="your_openai_key"   # optional — only needed for create_openai_api_key tool
```

### 3a. Run for Claude Desktop (stdio)

```bash
./run.sh
```

Sample output:

```
Token is still valid.
Claude config updated.
Restarting Claude app...
Zoom MCP server started (stdio).
```

### 3b. Run for ChatGPT (HTTP)

```bash
./run_chatgpt.sh
```

Sample output:

```
Refreshing Zoom token...
Starting Zoom MCP HTTP server on port 8787 (path: /mcp)...
Zoom MCP HTTP server listening on http://localhost:8787/mcp
```

---

## Scripts Reference

| Script | Purpose |
|---|---|
| `run.sh` | Full orchestration for Claude Desktop: refresh token if expired, update Claude config, restart Claude, start stdio server |
| `run_chatgpt.sh` | Orchestration for ChatGPT: refresh token if expired, start HTTP server on port 8787 |
| `get_zoom_token.sh` | Fetch a fresh Zoom access token via Server-to-Server OAuth and write it to `.env` |
| `update_claude_config.sh` | Inject `ZOOM_ACCESS_TOKEN` into Claude Desktop's `claude_desktop_config.json` |
| `restart_claude_app.sh` | Gracefully restart the macOS Claude Desktop app |

### Token Validation Details

The token expiry check in `run.sh` and `run_chatgpt.sh` uses an inline Python 3 script to decode the JWT `exp` claim from `ZOOM_ACCESS_TOKEN`. The token is treated as expired if:

- `ZOOM_ACCESS_TOKEN` is unset or empty
- The JWT is malformed
- `exp` is within 60 seconds of the current time
- `python3` is not available (fails safe — treated as expired)

This avoids unnecessary token refreshes while ensuring stale tokens are never used.

---

## Environment Variables

### Required

| Variable | Description |
|---|---|
| `ZOOM_CLIENT_ID` | Zoom Server-to-Server OAuth client ID |
| `ZOOM_CLIENT_SECRET` | Zoom Server-to-Server OAuth client secret |
| `ZOOM_ACCOUNT_ID` | Zoom account ID |

### Auto-managed

| Variable | Description |
|---|---|
| `ZOOM_ACCESS_TOKEN` | Written to `.env` by `get_zoom_token.sh`; refreshed automatically |

### Optional

| Variable | Default | Description |
|---|---|---|
| `OPENAI_API_KEY` | — | Only needed for `create_openai_api_key` tool guidance |
| `MCP_TRANSPORT` | `stdio` | Transport mode: `stdio`, `http`, or `both` |
| `MCP_HTTP_PORT` | `8787` | HTTP listen port |
| `MCP_HTTP_PATH` | `/mcp` | HTTP endpoint path |

---

## Claude Desktop Setup

Default config location on macOS:
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

Example config entry:

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

The `update_claude_config.sh` script patches this file automatically. It targets:

| Variable | Default |
|---|---|
| `CLAUDE_CONFIG_FILE` | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| `CLAUDE_MCP_SERVER_NAME` | `zoom` |
| `CLAUDE_ZOOM_ENV_KEY` | `ZOOM_ACCESS_TOKEN` |

After running `./run.sh`, Claude Desktop restarts and picks up the fresh token immediately.

---

## ChatGPT Apps (HTTP)

ChatGPT connects to MCP servers over streaming HTTP. This branch uses `StreamableHTTPServerTransport` in **stateless mode** (a fresh transport and server instance per request), which is required for ChatGPT compatibility.

### Step 1 — Start the HTTP server

```bash
./run_chatgpt.sh
```

Or manually:

```bash
MCP_TRANSPORT=http MCP_HTTP_PORT=8787 node index.js
```

The server listens at `http://localhost:8787/mcp`.

### Step 2 — Expose via ngrok

ChatGPT requires a **public HTTPS URL**. Use ngrok to tunnel your local port.

#### Install ngrok

```bash
brew install ngrok/ngrok/ngrok          # macOS via Homebrew
# or download from https://ngrok.com/download
```

#### Add your auth token

```bash
ngrok config add-authtoken <your_token>
```

#### Start the tunnel

For a **free static domain** (so your URL never changes):

```bash
ngrok http --domain=charitably-noniconoclastic-dagmar.ngrok-free.dev 8787
```

Sample output:

```
Session Status   online
Account          your@email.com (Plan: Free)
Region           United States (us)
Forwarding       https://charitably-noniconoclastic-dagmar.ngrok-free.dev -> http://localhost:8787
```

Your public MCP endpoint is:

```
https://charitably-noniconoclastic-dagmar.ngrok-free.dev/mcp
```

> **Why a static domain?** ChatGPT Apps connector URLs cannot be changed without deleting and recreating the connector. A static ngrok domain means you only configure ChatGPT once.

> **Keep both terminals open**: the `run_chatgpt.sh` terminal and the ngrok terminal must both be running for ChatGPT to reach your server.

### Step 3 — Add the connector in ChatGPT

1. Open ChatGPT → **Settings** (gear icon, bottom-left)
2. Go to **Apps & Connectors** → **Advanced**
3. Enable **Developer mode** (toggle)
4. Click **Create a connector**
5. Fill in the form:
   - **Name**: `Zoom`
   - **Description**: `Zoom meetings, users, and recordings`
   - **Connection type**: `Streaming HTTP`
   - **URL**: `https://charitably-noniconoclastic-dagmar.ngrok-free.dev/mcp`
   - **Authentication**: `None` (the server handles Zoom auth internally)
6. Click **Save**

ChatGPT will verify the endpoint. Once connected, the Zoom tools appear in your ChatGPT session.

### Step 4 — Use it

In ChatGPT, try:

```
Show me my upcoming Zoom meetings
```

```
Create a Zoom meeting called "Team Sync" for tomorrow at 2pm EST, 45 minutes
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Zoom MCP Server                          │
│                         (index.js)                              │
│                                                                 │
│  ┌──────────────────────┐    ┌──────────────────────────────┐   │
│  │   stdio transport    │    │  StreamableHTTP transport    │   │
│  │  (Claude Desktop)    │    │    (ChatGPT Apps)            │   │
│  └──────────┬───────────┘    └──────────────┬───────────────┘   │
│             │                               │                   │
│             └───────────┬───────────────────┘                   │
│                         ▼                                       │
│                  ┌─────────────┐                                │
│                  │  MCP Tools  │                                │
│                  └──────┬──────┘                                │
│                         │                                       │
│                         ▼                                       │
│                  ┌─────────────┐                                │
│                  │  Zoom API   │                                │
│                  │  (REST)     │                                │
│                  └─────────────┘                                │
└─────────────────────────────────────────────────────────────────┘

Claude Desktop ──stdio──► index.js ──► Zoom API
                                  ◄── results

ChatGPT ──HTTPS──► ngrok tunnel ──HTTP──► index.js ──► Zoom API
                                                   ◄── results (streamed)
```

---

## Project Structure

```
zoommcp/
├── index.js                  # MCP server — stdio + StreamableHTTP transports
├── run.sh                    # Claude Desktop orchestration (token + config + restart)
├── run_chatgpt.sh            # ChatGPT HTTP orchestration (token + HTTP server)
├── get_zoom_token.sh         # Fetch + persist Zoom access token
├── update_claude_config.sh   # Patch Claude Desktop config with token
├── restart_claude_app.sh     # Restart macOS Claude Desktop app
├── package.json              # ESM, dependencies
├── .env                      # Credentials (gitignored)
└── README.md                 # This file
```

---

## Available Tools

### Meeting Tools

#### `list_meetings`
List meetings for the authenticated user.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `type` | string | No | `scheduled`, `live`, `upcoming`, `upcoming_meetings`, `previous_meetings` |
| `page_size` | number | No | Results per page (max 300) |

#### `get_meeting`
Get details for a specific meeting.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `meeting_id` | string | Yes | Zoom meeting ID |

#### `create_meeting`
Schedule a new meeting.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `topic` | string | Yes | Meeting title |
| `type` | number | No | `1` (instant), `2` (scheduled), `3` (recurring no fixed time), `8` (recurring fixed time) |
| `start_time` | string | No | ISO 8601 start time, e.g. `2026-03-15T14:00:00Z` |
| `duration` | number | No | Duration in minutes |
| `timezone` | string | No | IANA timezone, e.g. `America/New_York` |
| `agenda` | string | No | Meeting description |
| `password` | string | No | Meeting passcode |
| `settings` | object | No | Advanced settings (auto-record, waiting room, etc.) |

#### `update_meeting`
Update an existing meeting.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `meeting_id` | string | Yes | Zoom meeting ID |
| `topic` | string | No | New title |
| `start_time` | string | No | New start time (ISO 8601) |
| `duration` | number | No | New duration in minutes |
| `agenda` | string | No | New description |
| `settings` | object | No | Updated settings |

#### `delete_meeting`
Cancel and delete a meeting.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `meeting_id` | string | Yes | Zoom meeting ID |
| `occurrence_id` | string | No | Specific occurrence ID for recurring meetings |

### User Tools

#### `list_users`
List users in the account.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `status` | string | No | `active`, `inactive`, `pending` |
| `page_size` | number | No | Results per page (max 300) |

#### `get_user`
Get details for a specific user.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `user_id` | string | Yes | User ID or email address |

### Recording Tools

#### `get_meeting_recordings`
Get cloud recordings for a meeting.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `meeting_id` | string | Yes | Zoom meeting ID |

#### `get_meeting_participants`
Get participants for a past meeting.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `meeting_id` | string | Yes | Zoom meeting ID |

### Utility Tools

#### `create_openai_api_key`
Returns step-by-step instructions for creating an OpenAI API key. No parameters.

---

## Usage Examples

```
"Show me my upcoming Zoom meetings"
"List all scheduled meetings"
"Create a Zoom meeting titled 'Team Standup' for tomorrow at 10am EST, 30 minutes"
"Get the details for Zoom meeting ID 123456789"
"Update meeting 123456789 to start at 2pm instead"
"Cancel the Zoom meeting with ID 123456789"
"List all active users in my Zoom account"
"Get recordings for meeting 123456789"
"Who attended meeting 987654321?"
```

---

## Troubleshooting

### Claude Desktop Issues

#### ❌ `ZOOM_ACCESS_TOKEN is missing`
Run `./run.sh` to fetch a fresh token and update the config. If `get_zoom_token.sh` fails, check that `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, and `ZOOM_ACCOUNT_ID` are set in `.env`.

#### ❌ `python3: command not found`
The token is treated as expired and a refresh is triggered on every run. Install Python 3 to enable proper JWT expiry checking:
```bash
brew install python3
```

#### ❌ Claude Desktop shows no Zoom tools
1. Verify Claude Desktop config at `~/Library/Application Support/Claude/claude_desktop_config.json`
2. Confirm the `args` path points to the correct absolute path of `index.js`
3. Restart Claude Desktop manually

### ChatGPT / HTTP Transport Issues

#### ❌ ChatGPT connector shows "Unable to connect"
- Confirm `./run_chatgpt.sh` is still running
- Confirm ngrok tunnel is still running in a separate terminal
- Test the endpoint directly:
  ```bash
  curl -X POST https://charitably-noniconoclastic-dagmar.ngrok-free.dev/mcp \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
  ```

#### ❌ `EADDRINUSE: address already in use :::8787`
Another process is using port 8787. Find and stop it:
```bash
lsof -i :8787
kill -9 <PID>
```
Or use a different port:
```bash
MCP_HTTP_PORT=8788 ./run_chatgpt.sh
```

#### ❌ ngrok `ERR_NGROK_15013` (tunnel not found)
Your static domain isn't registered to your account. Start ngrok with your static domain:
```bash
ngrok http --domain=charitably-noniconoclastic-dagmar.ngrok-free.dev 8787
```

#### ❌ ChatGPT returns "No tools available"
The connector may need to be deleted and re-added after a server restart. In ChatGPT Settings, remove the Zoom connector and re-add it with the same URL.

#### ❌ HTTP 401 from Zoom API
The access token has expired. Stop the server, run:
```bash
./get_zoom_token.sh
```
Then restart `./run_chatgpt.sh`.

### General

#### ❌ `npm install` fails
Ensure Node.js 18+ is installed:
```bash
node --version   # should be v18.x or higher
```

#### ❌ Zoom API returns 403 Forbidden
Your Zoom Server-to-Server OAuth app is missing required scopes. In the Zoom App Marketplace, add:
- `meeting:read:admin`
- `meeting:write:admin`
- `user:read:admin`
- `recording:read:admin`

---

## Requirements

- Node.js 18+
- Zoom account with API access
- Zoom Server-to-Server OAuth credentials
- Python 3 (for JWT expiry detection in shell scripts)
- ngrok (for ChatGPT HTTP transport only)

---

## Notes

- The access token refresh check is based on the JWT `exp` claim with a 60-second buffer.
- If `python3` is missing, the token is treated as expired on every run (safe default).
- `StreamableHTTPServerTransport` is instantiated per-request (stateless mode) for ChatGPT compatibility. Each request gets a fresh transport and server instance.
- The `both` transport mode starts both stdio and HTTP simultaneously, useful for development.
