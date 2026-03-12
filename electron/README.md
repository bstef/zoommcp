# Zoom MCP macOS App

This directory contains the Electron-based macOS application for Zoom MCP.

## Building the App

### Prerequisites
- Node.js 18+
- macOS 10.13+
- Your Zoom API credentials in `.env` file

### Quick Build

Run the build script:

```bash
./build-app.sh
```

This will:
1. Install dependencies
2. Build the macOS app
3. Create a single `.app` bundle output
4. Optionally open the built app

### Manual Build

If you prefer to build manually:

```bash
# Install dependencies
npm install

# Build the macOS app
npm run app:build:mac

# Run the app in development mode
npm run app:dev

# Or build for other platforms
npm run app:build  # All platforms
```

## App Features

- **Native macOS Application** - Runs as a `.app` bundle
- **Real-time Logs** - View server logs in the app window
- **Controls** - Start/stop the MCP server from the UI
- **Menu Bar Integration** - Access from macOS menu
- **MCP Auto-start on Launch** - Opening the app starts MCP automatically
- **Relaunch-safe Window Handling** - Reopening the app restores/focuses the window

## Distribution

The built app will be in the `dist/` directory:
- `mac*/Zoom MCP.app` - The macOS application bundle

## Configuration

The app reads configuration from:
- `.env` file for Zoom credentials (or `ZOOM_ENV_FILE` for an explicit path)
- Claude Desktop MCP configuration

Optional app env vars:
- `ZOOM_APP_AUTOSTART=0` disables MCP auto-start on launch
- `ZOOM_ENV_FILE=/absolute/path/to/.env` sets the token source file explicitly

## Troubleshooting

### App won't start
- Ensure `.env` file has valid Zoom credentials
- Check `dist/mac-arm64/Zoom MCP.app/Contents/Resources/app.asar` exists
- Try running with `npm run app:dev` to see detailed errors

### App icon appears but no window
- Fully quit any stale app process and relaunch:
	- `pkill -f "Zoom MCP.app/Contents/MacOS/Zoom MCP"`
	- `open "dist/mac-arm64/Zoom MCP.app"`

### Server won't connect
- Verify Claude Desktop is installed and running
- Check that your Zoom token is valid
- Review logs in the app window

### Build fails
- Run `npm clean-install` to reset dependencies
- Ensure you have macOS 10.13 or later
- Check that you have write permissions in the directory

## Development

### Project Structure
```
electron/
├── main.cjs         # Electron main process
├── preload.cjs      # Security preload script
├── renderer.js      # Frontend logic
├── index.html       # UI template
└── styles.css       # Styling
```

### Testing Locally

```bash
npm run app:dev
```

This runs the app in development mode with DevTools open.

## File Structure

```
project/
├── electron/              # Electron app files
├── dist/                  # Built app (after build)
├── build-app.sh          # Build script
└── package.json          # App config (includes build settings)
```
