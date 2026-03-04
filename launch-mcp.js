#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadDotEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const raw = fs.readFileSync(envPath, "utf-8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const [key, ...rest] = trimmed.split("=");
    if (!key || rest.length === 0) continue;

    let value = rest.join("=").trim();
    value = value.replace(/^['\"]|['\"]$/g, "");
    process.env[key.trim()] = value;
  }
}

function loadTokenFromClaudeConfig() {
  if (process.env.ZOOM_ACCESS_TOKEN) return;

  const configPath = path.join(
    process.env.HOME || "",
    "Library/Application Support/Claude/claude_desktop_config.json"
  );

  if (!configPath || !fs.existsSync(configPath)) return;

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const token = config?.mcpServers?.zoom?.env?.ZOOM_ACCESS_TOKEN;
    if (token && typeof token === "string") {
      process.env.ZOOM_ACCESS_TOKEN = token;
    }
  } catch {
    // No-op: index.js will emit a clear token error if missing.
  }
}

loadDotEnv();
loadTokenFromClaudeConfig();

await import("./index.js");
