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
3. Create a `.app` bundle and `.dmg` installer
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
- **Auto-start** - Can be configured to launch at login

## Distribution

The built app will be in the `dist/` directory:
- `Zoom MCP.app` - The macOS application
- `Zoom MCP.dmg` - The installer disk image

## Configuration

The app reads configuration from:
- `.env` file for Zoom credentials
- Claude Desktop MCP configuration

## Troubleshooting

### App won't start
- Ensure `.env` file has valid Zoom credentials
- Check `dist/Zoom MCP.app/Contents/Resources/app.asar` exists
- Try running with `npm run app:dev` to see detailed errors

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
├── main.js          # Electron main process
├── preload.js       # Security preload script
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
