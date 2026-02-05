#!/usr/bin/env bash
set -a
source .env
set +a
node index.js

# chmod +x get_zoom_token.sh run.sh
# ./get_zoom_token.sh    # generates & saves token to .env
# ./run.sh               # loads .env and starts the MCP server