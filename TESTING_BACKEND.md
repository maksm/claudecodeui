# Backend Testing Guide

## Phase 1: AI-Powered Development Workflow Backend

This guide helps you test the newly implemented backend infrastructure for the
branch-to-PR workflow.

---

## 🎯 What We're Testing

### Components

1. **Test Runner Utility** - Executes CI tests locally
2. **CI Runner API** - HTTP endpoints for running tests
3. **Workflow Orchestrator** - Complete workflow automation
4. **WebSocket Integration** - Real-time progress updates

### API Endpoints

#### CI Runner (`/api/ci/*`)

- `POST /api/ci/run` - Run full CI suite
- `POST /api/ci/run-single` - Run single test
- `POST /api/ci/cancel/:runId` - Cancel test
- `GET /api/ci/status/:runId` - Get test status
- `GET /api/ci/history` - Get run history
- `GET /api/ci/active` - Get active runs

#### Workflow (`/api/workflow/*`)

- `POST /api/workflow/create-feature-branch` - Create branch
- `POST /api/workflow/auto-commit` - AI-powered commit
- `POST /api/workflow/create-pr` - Create GitHub PR
- `POST /api/workflow/run-complete` - Full workflow

---

## 🚀 Quick Start

### 1. Start the Server

```bash
# Terminal 1: Start backend server
npm run server

# Expected output:
# Server running on http://localhost:3001
# WebSocket server ready
```

### 2. Run Automated Tests

```bash
# Terminal 2: Run test suite
chmod +x test-backend-workflow.sh
./test-backend-workflow.sh
```

---

## 📋 Manual Testing Steps

### Test 1: Health Check ✅

```bash
curl http://localhost:3001/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-11-15T10:00:00.000Z"
# }
```

**✓ Success:** Status is "ok" **✗ Failure:** Server not responding → Check if
server is running

---

### Test 2: Run Single CI Test (Lint) ✅

```bash
curl -X POST http://localhost:3001/api/ci/run-single \
  -H "Content-Type: application/json" \
  -d '{
    "project": "claudecodeui",
    "test": "lint"
  }'

# Expected response:
# {
#   "runId": "ci-abc123...",
#   "status": "running",
#   "startedAt": "2025-11-15T10:00:00.000Z",
#   "test": "lint"
# }
```

**✓ Success:** Returns `runId` and status "running" **✗ Failure:** Check error
message

**Common Errors:**

- `"Project name is required"` → Add project name
- `"Script not found"` → Check package.json has `lint` script
- `401 Unauthorized` → Check authentication (platform mode should work)

---

### Test 3: Check CI Run Status ✅

```bash
# Use the runId from Test 2
RUN_ID="ci-abc123..."  # Replace with actual runId

curl http://localhost:3001/api/ci/status/$RUN_ID

# Expected response (completed):
# {
#   "runId": "ci-abc123...",
#   "status": "passed",
#   "startedAt": "...",
#   "completedAt": "...",
#   "results": {
#     "lint": {
#       "passed": true,
#       "duration": 2345,
#       "output": "..."
#     }
#   }
# }
```

**✓ Success:** Status changes from "running" → "passed"/"failed" **✗ Failure:**
Status stuck on "running" → Check logs

---

### Test 4: Run Full CI Suite ⚠️

```bash
# WARNING: This takes 1-2 minutes
curl -X POST http://localhost:3001/api/ci/run \
  -H "Content-Type: application/json" \
  -d '{
    "project": "claudecodeui"
  }'

# Expected response:
# {
#   "runId": "ci-def456...",
#   "status": "running",
#   "startedAt": "...",
#   "tests": ["lint", "audit", "build", "test:backend"]
# }
```

**What it does:**

1. Runs `npm run lint`
2. Runs `npm audit --audit-level high`
3. Runs `npm run build`
4. Runs `npm run test:backend`

**✓ Success:** All tests pass **⚠️ Warning:** Some tests fail → Check individual
test results **✗ Failure:** CI doesn't start → Check server logs

---

### Test 5: Create Feature Branch ✅

```bash
curl -X POST http://localhost:3001/api/workflow/create-feature-branch \
  -H "Content-Type: application/json" \
  -d '{
    "project": "claudecodeui",
    "branchName": "test/backend-workflow-123"
  }'

# Expected response:
# {
#   "success": true,
#   "branch": "test/backend-workflow-123",
#   "baseBranch": "claude/improve-ai-pairing-capabilities-...",
#   "created": true,
#   "checkedOut": true
# }
```

**✓ Success:** Branch created and checked out **✗ Failure:** "Branch already
exists" → Use different name

**Verify:**

```bash
git branch --show-current
# Should show: test/backend-workflow-123
```

---

### Test 6: Auto-Commit with AI Message ⚠️

**Prerequisites:**

- Make some changes to files first
- Anthropic API key configured

```bash
# First, make a change
echo "// Test comment" >> server/index.js

# Then auto-commit
curl -X POST http://localhost:3001/api/workflow/auto-commit \
  -H "Content-Type: application/json" \
  -d '{
    "project": "claudecodeui",
    "runCI": false
  }'

# Expected response:
# {
#   "success": true,
#   "ciPassed": null,
#   "commitHash": "abc1234",
#   "commitMessage": "chore: add test comment\n\nAdded test comment to server/index.js",
#   "filesCommitted": 1
# }
```

**✓ Success:** Commit created with AI-generated message **✗ Failure:** "No
changes to commit" → Make file changes first

**Verify:**

```bash
git log -1 --pretty=format:"%s"
# Should show AI-generated commit message
```

---

### Test 7: Create GitHub PR 🔧

**Prerequisites:**

- GitHub CLI (`gh`) installed and authenticated
- Branch pushed to remote
- Changes committed

```bash
# Check if gh CLI is installed
gh --version

# If not installed:
# macOS: brew install gh
# Linux: See https://cli.github.com/
# Windows: Download from https://cli.github.com/

# Authenticate
gh auth login

# Then create PR
curl -X POST http://localhost:3001/api/workflow/create-pr \
  -H "Content-Type: application/json" \
  -d '{
    "project": "claudecodeui",
    "baseBranch": "main"
  }'

# Expected response:
# {
#   "success": true,
#   "prUrl": "https://github.com/user/repo/pull/42",
#   "prNumber": 42,
#   "title": "Test: Backend Workflow 123",
#   "branchPushed": true
# }
```

**✓ Success:** PR created on GitHub **✗ Failure:** "GitHub CLI not installed" →
Install gh **✗ Failure:** "Permission denied" → Run `gh auth login`

---

### Test 8: WebSocket Real-Time Updates 📡

```bash
# In a separate terminal, run:
node test-websocket.js

# Expected output:
# 🧪 WebSocket Testing Script
# ═══════════════════════════════════════
# 📡 Connecting to WebSocket: ws://localhost:3001/ws
# ✅ WebSocket connected
# 🚀 Triggering CI run...
# ✅ CI run started: ci-xyz789
# 📊 Listening for WebSocket updates...
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 📨 Message Type: ci-output
# 🔍 Data: {
#   "type": "ci-output",
#   "runId": "ci-xyz789",
#   "testType": "lint",
#   "data": "Running ESLint...\n"
# }
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**✓ Success:** Real-time messages received **✗ Failure:** Connection refused →
Check server running

---

## 🧪 Test Results Checklist

After running all tests, verify:

- [ ] **Health check** responds with "ok"
- [ ] **Single test run** starts and completes
- [ ] **Status endpoint** shows test progress
- [ ] **Full CI suite** executes all tests
- [ ] **Branch creation** creates new branch
- [ ] **Branch validation** rejects invalid names
- [ ] **Auto-commit** generates AI message
- [ ] **PR creation** works (if gh CLI available)
- [ ] **WebSocket** sends real-time updates
- [ ] **Error handling** shows helpful messages

---

## 📊 Expected Test Coverage

| Feature        | Endpoint                                   | Status |
| -------------- | ------------------------------------------ | ------ |
| Health Check   | `GET /health`                              | ✅     |
| Single CI Test | `POST /api/ci/run-single`                  | ⏳     |
| Full CI Suite  | `POST /api/ci/run`                         | ⏳     |
| CI Status      | `GET /api/ci/status/:id`                   | ⏳     |
| CI History     | `GET /api/ci/history`                      | ⏳     |
| Create Branch  | `POST /api/workflow/create-feature-branch` | ⏳     |
| Auto-Commit    | `POST /api/workflow/auto-commit`           | ⏳     |
| Create PR      | `POST /api/workflow/create-pr`             | ⏳     |
| WebSocket      | `ws://localhost:3001/ws`                   | ⏳     |

Mark ✅ when tested successfully, ❌ if failed, ⏳ if not yet tested.

---

## 🐛 Troubleshooting

### Server won't start

```bash
# Check if port 3001 is already in use
lsof -i :3001

# Kill existing process
kill -9 <PID>

# Restart server
npm run server
```

### CI tests fail

```bash
# Run tests locally to see detailed errors
npm run lint
npm run build
npm run test:backend
```

### WebSocket not connecting

```bash
# Check server logs for WebSocket errors
# Look for: "WebSocket server ready"

# Test with simple ws client
npm install -g wscat
wscat -c ws://localhost:3001/ws
```

### Authentication errors (401)

```bash
# Check if running in platform mode
echo $VITE_IS_PLATFORM

# Should be: true (for development)

# If not, set it:
export VITE_IS_PLATFORM=true
npm run server
```

---

## 📝 Logging Test Results

Create a test report:

```bash
# Run tests and save output
./test-backend-workflow.sh > test-results.log 2>&1

# Review results
cat test-results.log

# Share results
# Add to git and commit, or share the file
```

---

## 🎯 Next Steps After Testing

Once all tests pass:

1. **Document Issues** - Note any failures or unexpected behavior
2. **Fix Bugs** - Address any issues found
3. **Frontend Development** - Build the React UI
4. **Integration Testing** - Test frontend + backend together
5. **Mobile Testing** - Test on mobile devices
6. **Create PR** - Merge Phase 1 backend

---

## 💡 Tips

- Use `jq` to format JSON responses: `curl ... | jq '.'`
- Monitor server logs in separate terminal
- Test one endpoint at a time
- Keep track of runIds for status checks
- Clean up test branches after testing

---

## 🆘 Need Help?

If you encounter issues:

1. Check server logs for errors
2. Verify all prerequisites are met
3. Run tests one at a time
4. Check API response error messages
5. Review this guide's troubleshooting section

**Common Issues:**

- Missing dependencies → Run `npm install`
- Port already in use → Kill process or change port
- Authentication errors → Check platform mode
- GitHub CLI errors → Run `gh auth login`
- Network timeouts → Check firewall/network

---

**Happy Testing! 🚀**
