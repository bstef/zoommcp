#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🍎 Zoom MCP - macOS App Builder${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  .env file not found${NC}"
    echo "Please create a .env file with your Zoom credentials first."
    echo "You can copy from .env.example:"
    echo "  cp .env.example .env"
    exit 1
fi

echo -e "${BLUE}📦 Installing dependencies...${NC}"
npm install || exit 1

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

echo -e "${BLUE}🔨 Building macOS app...${NC}"
npm run app:build:mac || exit 1

echo -e "${GREEN}✅ App built successfully!${NC}"
echo ""

echo -e "${BLUE}📂 App location: ./dist/Zoom MCP.app${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Open the app: open dist/Zoom\\ MCP.app"
echo "  2. Or install to Applications folder:"
echo "     open dist/Zoom\\ MCP.dmg"
echo ""

# Optionally install
read -p "Would you like to open the app now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    open dist/Zoom\ MCP.app
fi
