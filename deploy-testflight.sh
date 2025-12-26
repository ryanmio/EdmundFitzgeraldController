#!/bin/bash
# Boat Telemetry App - TestFlight Deployment Script
# This script builds and submits the app to TestFlight

set -e

echo "🚤 EDMUND FITZGERALD RC CONTROLLER - TestFlight Deployment"
echo "=========================================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Navigate to app directory
cd "$(dirname "$0")/boat-telemetry-app"

# Verify we're in the right place
if [ ! -f "app.json" ] || [ ! -f "eas.json" ]; then
    echo "❌ Error: app.json or eas.json not found!"
    echo "Please run this script from the project root."
    exit 1
fi

# Check EAS CLI is installed
if ! command -v eas &> /dev/null; then
    echo "❌ Error: EAS CLI not installed"
    echo "Install with: npm install -g eas-cli"
    exit 1
fi

# Verify logged in
echo -e "${BLUE}Checking EAS authentication...${NC}"
if ! eas whoami &> /dev/null; then
    echo "❌ Not authenticated with EAS. Please run: eas login"
    exit 1
fi
echo -e "${GREEN}✓ Authenticated${NC}"

# Show build info
echo ""
echo -e "${YELLOW}Build Configuration:${NC}"
echo "  App Name: Edmund Fitzgerald RC Controller"
echo "  Bundle ID: com.ryanmio.edmundfitzgerald"
echo "  Version: 1.0.0"
echo "  Platform: iOS"
echo "  Profile: production"
echo ""

# Ask for confirmation
echo -e "${YELLOW}⚠️  This will use 1 EAS build credit${NC}"
read -p "Continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo -e "${BLUE}Step 1: Building iOS app for App Store...${NC}"
eas build --platform ios --profile production

echo ""
echo -e "${BLUE}Step 2: Submitting to TestFlight...${NC}"
eas submit --platform ios --latest

echo ""
echo -e "${GREEN}✓ Build and submission complete!${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Go to https://appstoreconnect.apple.com"
echo "  2. Select 'Edmund Fitzgerald' app"
echo "  3. Navigate to TestFlight → iOS builds"
echo "  4. Wait for 'Processing' to complete (usually 5-10 min)"
echo "  5. Add testers and send invites"
echo ""

