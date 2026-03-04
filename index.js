#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import axios from "axios";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of the current module (ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Zoom API configuration
const ZOOM_API_BASE = "https://api.zoom.us/v2";
let accessToken = null;
let tokenRefreshInProgress = false;
let tokenCheckInterval = null;

// Initialize access token from environment
function getAccessToken() {
  if (!accessToken) {
    accessToken = process.env.ZOOM_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("ZOOM_ACCESS_TOKEN environment variable is required");
    }
  }
  return accessToken;
}

// Parse JWT token to extract expiration time
function parseTokenExpiration(token) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }
    
    // Decode the payload
    const payload = parts[1];
    const padding = "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = Buffer.from(payload + padding, "base64").toString("utf-8");
    const claims = JSON.parse(decoded);
    
    return claims.exp ? claims.exp * 1000 : null; // Convert to milliseconds
  } catch (error) {
    console.error("Failed to parse token expiration:", error.message);
    return null;
  }
}

// Format time remaining in human-readable format
function formatTimeRemaining(expirationMs) {
  const now = Date.now();
  const remaining = Math.max(0, expirationMs - now);
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((remaining % (1000 * 60)) / 1000);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

// Display token expiration status
function displayTokenStatus() {
  try {
    const token = getAccessToken();
    const expirationMs = parseTokenExpiration(token);
    
    if (!expirationMs) {
      console.error("⚠️  Could not determine token expiration time");
      return;
    }
    
    const expirationDate = new Date(expirationMs);
    const timeRemaining = formatTimeRemaining(expirationMs);
    const now = new Date();
    
    console.error(`🔑 Zoom Token Status: Expires in ${timeRemaining} at ${expirationDate.toLocaleTimeString()}`);
  } catch (error) {
    console.error("Error displaying token status:", error.message);
  }
}

// Check if token needs automatic refresh (expiring within threshold)
function tokenNeedsRefresh() {
  try {
    const token = getAccessToken();
    const expirationMs = parseTokenExpiration(token);
    
    if (!expirationMs) {
      return false;
    }
    
    // Check if token expires within the threshold (default: 5 minutes)
    const refreshThresholdMs = (parseInt(process.env.ZOOM_AUTO_REFRESH_THRESHOLD || "300")) * 1000;
    const now = Date.now();
    
    return (expirationMs - now) < refreshThresholdMs;
  } catch (error) {
    return false;
  }
}

// Automatically refresh token, update config, and restart Claude
async function performAutoTokenRefresh() {
  if (tokenRefreshInProgress) {
    return; // Prevent concurrent refresh attempts
  }
  
  tokenRefreshInProgress = true;
  
  try {
    console.error("⏳ Token expiring soon! Automatically refreshing...");
    console.error("📝 Running: get_zoom_token.sh");
    
    // Run get_zoom_token.sh with absolute path
    const getTokenScript = path.join(__dirname, "get_zoom_token.sh");
    try {
      const output = execSync(`bash "${getTokenScript}"`, {
        cwd: __dirname,
        encoding: 'utf-8',
        env: process.env,
        maxBuffer: 10 * 1024 * 1024
      });
      console.error("📋 Token fetched successfully");
    } catch (error) {
      console.error("⚠️  Failed to get new token:");
      console.error("   Error:", error.message);
      if (error.stdout) console.error("   Output:", error.stdout.toString().trim());
      if (error.stderr) console.error("   Stderr:", error.stderr.toString().trim());
      tokenRefreshInProgress = false;
      return;
    }
    
    // Reload token from .env
    console.error("🔄 Loading new token from .env");
    loadEnvFile();
    accessToken = null; // Clear cached token to force reload
    
    console.error("⚙️  Running: update_claude_config.sh");
    
    // Run update_claude_config.sh with absolute path
    const updateConfigScript = path.join(__dirname, "update_claude_config.sh");
    try {
      execSync(`bash "${updateConfigScript}"`, {
        cwd: __dirname,
        encoding: 'utf-8',
        env: process.env
      });
    } catch (error) {
      console.error("⚠️  Failed to update Claude config:", error.message);
    }
    
    console.error("🚀 Running: restart_claude_app.sh");
    
    // Run restart_claude_app.sh with absolute path
    const restartClaudeScript = path.join(__dirname, "restart_claude_app.sh");
    try {
      execSync(`bash "${restartClaudeScript}"`, {
        cwd: __dirname,
        encoding: 'utf-8',
        env: process.env
      });
    } catch (error) {
      console.error("⚠️  Failed to restart Claude:", error.message);
    }
    
    console.error("✅ Token refresh complete! New token is now active.");
    displayTokenStatus();
  } catch (error) {
    console.error("❌ Error during token refresh:", error.message);
  } finally {
    tokenRefreshInProgress = false;
  }
}

// Load environment variables from .env file
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const lines = envContent.split("\n");
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const [key, ...valueParts] = trimmed.split("=");
          let value = valueParts.join("=");
          if (key && value) {
            // Remove quotes if present
            value = value.trim().replace(/^["']|["']$/g, "");
            process.env[key.trim()] = value;
          }
        }
      }
    }
  } catch (error) {
    console.error("Error loading .env file:", error.message);
  }
}

// Helper function to make Zoom API requests
async function makeZoomRequest(method, endpoint, data = null) {
  const token = getAccessToken();
  const config = {
    method,
    url: `${ZOOM_API_BASE}${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(
        `Zoom API Error: ${error.response.status} - ${
          error.response.data.message || JSON.stringify(error.response.data)
        }`
      );
    }
    throw error;
  }
}

// Create MCP server instance
const server = new Server(
  {
    name: "zoom-mcp-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_meetings",
        description:
          "List all scheduled meetings for the authenticated user. Returns upcoming, live, and previous meetings.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["scheduled", "live", "upcoming", "upcoming_meetings", "previous_meetings"],
              description: "The meeting types: scheduled, live, upcoming, upcoming_meetings, or previous_meetings",
              default: "upcoming",
            },
            page_size: {
              type: "number",
              description: "Number of records per page (max 300)",
              default: 30,
            },
          },
        },
      },
      {
        name: "get_meeting",
        description:
          "Get detailed information about a specific meeting by meeting ID",
        inputSchema: {
          type: "object",
          properties: {
            meeting_id: {
              type: "string",
              description: "The meeting ID or meeting UUID",
            },
          },
          required: ["meeting_id"],
        },
      },
      {
        name: "create_meeting",
        description:
          "Create a new Zoom meeting with specified settings",
        inputSchema: {
          type: "object",
          properties: {
            topic: {
              type: "string",
              description: "Meeting topic/title",
            },
            type: {
              type: "number",
              description: "Meeting type: 1 (instant), 2 (scheduled), 3 (recurring no fixed time), 8 (recurring fixed time)",
              default: 2,
            },
            start_time: {
              type: "string",
              description: "Meeting start time in ISO 8601 format (e.g., 2023-03-22T07:32:55Z)",
            },
            duration: {
              type: "number",
              description: "Meeting duration in minutes",
            },
            timezone: {
              type: "string",
              description: "Timezone for the meeting (e.g., America/New_York)",
            },
            agenda: {
              type: "string",
              description: "Meeting description/agenda",
            },
            password: {
              type: "string",
              description: "Meeting password",
            },
            settings: {
              type: "object",
              description: "Additional meeting settings",
              properties: {
                host_video: {
                  type: "boolean",
                  description: "Start video when host joins",
                },
                participant_video: {
                  type: "boolean",
                  description: "Start video when participants join",
                },
                join_before_host: {
                  type: "boolean",
                  description: "Allow participants to join before host",
                },
                mute_upon_entry: {
                  type: "boolean",
                  description: "Mute participants upon entry",
                },
                waiting_room: {
                  type: "boolean",
                  description: "Enable waiting room",
                },
                audio: {
                  type: "string",
                  enum: ["both", "telephony", "voip"],
                  description: "Audio options",
                },
              },
            },
          },
          required: ["topic"],
        },
      },
      {
        name: "update_meeting",
        description:
          "Update an existing meeting's settings",
        inputSchema: {
          type: "object",
          properties: {
            meeting_id: {
              type: "string",
              description: "The meeting ID to update",
            },
            topic: {
              type: "string",
              description: "Updated meeting topic",
            },
            start_time: {
              type: "string",
              description: "Updated start time in ISO 8601 format",
            },
            duration: {
              type: "number",
              description: "Updated duration in minutes",
            },
            agenda: {
              type: "string",
              description: "Updated meeting agenda",
            },
            settings: {
              type: "object",
              description: "Updated meeting settings",
            },
          },
          required: ["meeting_id"],
        },
      },
      {
        name: "delete_meeting",
        description:
          "Delete a scheduled meeting",
        inputSchema: {
          type: "object",
          properties: {
            meeting_id: {
              type: "string",
              description: "The meeting ID to delete",
            },
            occurrence_id: {
              type: "string",
              description: "The meeting occurrence ID for recurring meetings",
            },
          },
          required: ["meeting_id"],
        },
      },
      {
        name: "list_users",
        description:
          "List users in your Zoom account",
        inputSchema: {
          type: "object",
          properties: {
            status: {
              type: "string",
              enum: ["active", "inactive", "pending"],
              description: "User status filter",
              default: "active",
            },
            page_size: {
              type: "number",
              description: "Number of records per page (max 300)",
              default: 30,
            },
          },
        },
      },
      {
        name: "get_user",
        description:
          "Get information about a specific user",
        inputSchema: {
          type: "object",
          properties: {
            user_id: {
              type: "string",
              description: "User ID or email address",
            },
          },
          required: ["user_id"],
        },
      },
      {
        name: "get_meeting_participants",
        description:
          "Get list of participants for a past meeting",
        inputSchema: {
          type: "object",
          properties: {
            meeting_id: {
              type: "string",
              description: "The meeting ID or UUID",
            },
            page_size: {
              type: "number",
              description: "Number of records per page (max 300)",
              default: 30,
            },
          },
          required: ["meeting_id"],
        },
      },
      {
        name: "get_meeting_recordings",
        description:
          "Get cloud recordings for a meeting",
        inputSchema: {
          type: "object",
          properties: {
            meeting_id: {
              type: "string",
              description: "The meeting ID or UUID",
            },
          },
          required: ["meeting_id"],
        },
      },
    ],
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_meetings": {
        const type = args.type || "upcoming";
        const pageSize = args.page_size || 30;
        const data = await makeZoomRequest(
          "GET",
          `/users/me/meetings?type=${type}&page_size=${pageSize}`
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_meeting": {
        const data = await makeZoomRequest("GET", `/meetings/${args.meeting_id}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "create_meeting": {
        const meetingData = {
          topic: args.topic,
          type: args.type || 2,
          start_time: args.start_time,
          duration: args.duration,
          timezone: args.timezone,
          agenda: args.agenda,
          password: args.password,
          settings: args.settings || {},
        };
        const data = await makeZoomRequest("POST", "/users/me/meetings", meetingData);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "update_meeting": {
        const { meeting_id, ...updateData } = args;
        const data = await makeZoomRequest(
          "PATCH",
          `/meetings/${meeting_id}`,
          updateData
        );
        return {
          content: [
            {
              type: "text",
              text: `Meeting ${meeting_id} updated successfully`,
            },
          ],
        };
      }

      case "delete_meeting": {
        const occurrenceParam = args.occurrence_id
          ? `?occurrence_id=${args.occurrence_id}`
          : "";
        await makeZoomRequest("DELETE", `/meetings/${args.meeting_id}${occurrenceParam}`);
        return {
          content: [
            {
              type: "text",
              text: `Meeting ${args.meeting_id} deleted successfully`,
            },
          ],
        };
      }

      case "list_users": {
        const status = args.status || "active";
        const pageSize = args.page_size || 30;
        const data = await makeZoomRequest(
          "GET",
          `/users?status=${status}&page_size=${pageSize}`
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_user": {
        const data = await makeZoomRequest("GET", `/users/${args.user_id}`);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_meeting_participants": {
        const pageSize = args.page_size || 30;
        const data = await makeZoomRequest(
          "GET",
          `/past_meetings/${args.meeting_id}/participants?page_size=${pageSize}`
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      case "get_meeting_recordings": {
        const data = await makeZoomRequest(
          "GET",
          `/meetings/${args.meeting_id}/recordings`
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  
  // Display initial token status
  displayTokenStatus();
  
  // Set up periodic token status display (every 60 seconds, configurable via env)
  const updateInterval = parseInt(process.env.ZOOM_TOKEN_DISPLAY_INTERVAL || "60") * 1000;
  const tokenDisplayTimer = setInterval(async () => {
    displayTokenStatus();
    
    // Check if token needs refresh and trigger auto-refresh if so
    if (tokenNeedsRefresh()) {
      await performAutoTokenRefresh();
    }
  }, updateInterval);
  
  // Ensure timer doesn't prevent process from exiting
  tokenDisplayTimer.unref();
  
  await server.connect(transport);
  console.error("Zoom MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
