#!/bin/bash

# Backend Workflow Testing Script
# Tests all Phase 1 backend endpoints

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="http://localhost:3001"
PROJECT_NAME="claudecodeui"  # Change this to your test project

# Get auth token (assumes platform mode or you have a token)
# In platform mode, authentication might be automatic
TOKEN=""  # Add your token here if needed

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Backend Workflow API Testing Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Helper function for API calls
api_call() {
    local method=$1
    local endpoint=$2
    local data=$3
    local description=$4

    echo -e "\n${YELLOW}➤ Testing:${NC} $description"
    echo -e "   ${BLUE}$method${NC} $endpoint"

    if [ -n "$data" ]; then
        if [ -n "$TOKEN" ]; then
            response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $TOKEN" \
                -d "$data")
        else
            response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data")
        fi
    else
        if [ -n "$TOKEN" ]; then
            response=$(curl -s -X "$method" "$BASE_URL$endpoint" \
                -H "Authorization: Bearer $TOKEN")
        else
            response=$(curl -s -X "$method" "$BASE_URL$endpoint")
        fi
    fi

    if echo "$response" | jq . > /dev/null 2>&1; then
        echo -e "   ${GREEN}✓ Response:${NC}"
        echo "$response" | jq '.' | head -20

        if echo "$response" | grep -q '"error"'; then
            echo -e "   ${RED}✗ Error detected in response${NC}"
            return 1
        else
            echo -e "   ${GREEN}✓ Success${NC}"
            return 0
        fi
    else
        echo -e "   ${RED}✗ Invalid JSON response${NC}"
        echo "$response"
        return 1
    fi
}

# Test 1: Health Check
echo -e "\n${GREEN}═══ Test 1: Server Health Check ═══${NC}"
api_call "GET" "/health" "" "Health check endpoint"

# Test 2: CI Runner - Get Active Runs
echo -e "\n${GREEN}═══ Test 2: CI Runner - Active Runs ═══${NC}"
api_call "GET" "/api/ci/active" "" "Get all active CI runs"

# Test 3: CI Runner - Get History
echo -e "\n${GREEN}═══ Test 3: CI Runner - History ═══${NC}"
api_call "GET" "/api/ci/history?limit=5" "" "Get CI run history"

# Test 4: CI Runner - Run Single Test (Lint)
echo -e "\n${GREEN}═══ Test 4: CI Runner - Run Single Test ═══${NC}"
TEST_DATA="{\"project\": \"$PROJECT_NAME\", \"test\": \"lint\"}"
if api_call "POST" "/api/ci/run-single" "$TEST_DATA" "Run lint test"; then
    RUN_ID=$(echo "$response" | jq -r '.runId')
    echo -e "   ${BLUE}Run ID:${NC} $RUN_ID"

    # Wait a bit and check status
    sleep 3
    echo -e "\n   ${YELLOW}Checking run status...${NC}"
    api_call "GET" "/api/ci/status/$RUN_ID" "" "Get CI run status"
fi

# Test 5: Workflow - Create Feature Branch
echo -e "\n${GREEN}═══ Test 5: Workflow - Create Feature Branch ═══${NC}"
BRANCH_NAME="test/backend-workflow-$(date +%s)"
BRANCH_DATA="{\"project\": \"$PROJECT_NAME\", \"branchName\": \"$BRANCH_NAME\"}"
api_call "POST" "/api/workflow/create-feature-branch" "$BRANCH_DATA" "Create feature branch"

# Test 6: Workflow - Branch Name Validation (Invalid)
echo -e "\n${GREEN}═══ Test 6: Workflow - Branch Name Validation ═══${NC}"
INVALID_BRANCH_DATA="{\"project\": \"$PROJECT_NAME\", \"branchName\": \"invalid branch name with spaces\"}"
echo -e "   ${YELLOW}Expected to fail:${NC} Testing invalid branch name"
api_call "POST" "/api/workflow/create-feature-branch" "$INVALID_BRANCH_DATA" "Create branch with invalid name" || echo -e "   ${GREEN}✓ Correctly rejected invalid branch name${NC}"

# Test 7: CI Runner - Run Full Suite (if you want to test)
echo -e "\n${GREEN}═══ Test 7: CI Runner - Full Suite (Optional) ═══${NC}"
echo -e "${YELLOW}⚠ Skipping full CI run (takes 1-2 minutes)${NC}"
echo -e "${BLUE}To run manually:${NC}"
echo -e "curl -X POST $BASE_URL/api/ci/run \\"
echo -e "  -H 'Content-Type: application/json' \\"
echo -e "  -d '{\"project\": \"$PROJECT_NAME\"}'"

# Test 8: Check for WebSocket endpoint
echo -e "\n${GREEN}═══ Test 8: WebSocket Endpoint Check ═══${NC}"
echo -e "${BLUE}WebSocket endpoints:${NC}"
echo -e "  • ws://localhost:3001/ws (chat)"
echo -e "  • ws://localhost:3001/shell (terminal)"
echo -e "${YELLOW}Note:${NC} WebSocket testing requires a WS client"

# Summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Testing Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo -e "1. Review the test output above"
echo -e "2. Test WebSocket updates (see test-websocket.js)"
echo -e "3. Test AI commit message generation"
echo -e "4. Test PR creation (requires GitHub CLI)"
echo ""
echo -e "${BLUE}Manual Testing Commands:${NC}"
echo -e ""
echo -e "${GREEN}# Run full CI suite:${NC}"
echo -e "curl -X POST $BASE_URL/api/ci/run \\"
echo -e "  -H 'Content-Type: application/json' \\"
echo -e "  -d '{\"project\": \"$PROJECT_NAME\"}'"
echo -e ""
echo -e "${GREEN}# Auto-commit with AI message:${NC}"
echo -e "curl -X POST $BASE_URL/api/workflow/auto-commit \\"
echo -e "  -H 'Content-Type: application/json' \\"
echo -e "  -d '{\"project\": \"$PROJECT_NAME\", \"runCI\": false}'"
echo -e ""
echo -e "${GREEN}# Create PR:${NC}"
echo -e "curl -X POST $BASE_URL/api/workflow/create-pr \\"
echo -e "  -H 'Content-Type: application/json' \\"
echo -e "  -d '{\"project\": \"$PROJECT_NAME\"}'"
echo ""
