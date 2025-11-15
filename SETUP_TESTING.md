# 🚀 Quick Setup for Backend Testing

## Prerequisites

You need an **Anthropic API key** to test the backend (for AI-powered commit
messages and PR descriptions).

---

## Step 1: Set Up API Key

### Option A: Create .env file (Recommended)

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API key
nano .env  # or use your preferred editor
```

Add this line to `.env`:

```bash
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Option B: Export Environment Variable

```bash
# Set for current terminal session
export ANTHROPIC_API_KEY="sk-ant-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

**Get your API key:**

- Visit: https://console.anthropic.com/
- Go to: Settings → API Keys
- Create a new key

---

## Step 2: Start the Server

```bash
npm run server
```

**Expected output:**

```
PORT from env: 3001
Server running on http://localhost:3001
WebSocket server ready
Database initialized
```

✅ If you see this, the server is running!

❌ If you see errors:

- `ANTHROPIC_API_KEY not set` → Set API key (Step 1)
- `Port 3001 already in use` → Kill existing process: `lsof -i :3001`

---

## Step 3: Run Tests (New Terminal)

### Quick Automated Test

```bash
# Open a NEW terminal (keep server running in first terminal)
./test-backend-workflow.sh
```

This will test:

- ✅ Health check
- ✅ CI Runner endpoints
- ✅ Workflow endpoints
- ✅ Error handling

### Test Individual Endpoints

```bash
# Test 1: Health check
curl http://localhost:3001/health

# Test 2: Run lint test
curl -X POST http://localhost:3001/api/ci/run-single \
  -H "Content-Type: application/json" \
  -d '{"project": "claudecodeui", "test": "lint"}'

# Test 3: Create a test branch
curl -X POST http://localhost:3001/api/workflow/create-feature-branch \
  -H "Content-Type: application/json" \
  -d '{"project": "claudecodeui", "branchName": "test/backend-test"}'
```

### Test WebSocket Updates

```bash
# In a third terminal
node test-websocket.js
```

This will:

- Connect to WebSocket
- Trigger a CI run
- Show real-time progress updates
- Display test results

---

## Step 4: Test AI Features

### Test AI Commit Message Generation

```bash
# 1. Make a change
echo "// Test change" >> server/index.js

# 2. Auto-commit with AI-generated message
curl -X POST http://localhost:3001/api/workflow/auto-commit \
  -H "Content-Type: application/json" \
  -d '{"project": "claudecodeui", "runCI": false}'

# 3. Check the commit message
git log -1
```

### Test PR Creation (Optional)

**Prerequisites:**

- GitHub CLI installed: `brew install gh` (macOS) or see https://cli.github.com/
- Authenticated: `gh auth login`

```bash
curl -X POST http://localhost:3001/api/workflow/create-pr \
  -H "Content-Type: application/json" \
  -d '{"project": "claudecodeui"}'
```

---

## 📋 Test Checklist

After running tests, check off each item:

### Basic Functionality

- [ ] Server starts without errors
- [ ] Health endpoint responds
- [ ] Can run single CI test (lint)
- [ ] Can check CI test status
- [ ] Can view CI history
- [ ] WebSocket connects and sends updates

### Workflow Features

- [ ] Can create feature branch
- [ ] Branch name validation works
- [ ] AI commit message generation works
- [ ] PR creation works (if gh CLI available)

### Error Handling

- [ ] Invalid branch names rejected
- [ ] No changes to commit handled gracefully
- [ ] Missing gh CLI shows helpful error
- [ ] Concurrent CI runs prevented

---

## 🐛 Troubleshooting

### Server won't start

**Error:** `ANTHROPIC_API_KEY not set`

```bash
# Solution: Set API key in .env file or environment
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
npm run server
```

**Error:** `Port 3001 already in use`

```bash
# Find and kill process using port 3001
lsof -i :3001
kill -9 <PID>
npm run server
```

### Tests fail

**Error:** `Connection refused`

```bash
# Make sure server is running
curl http://localhost:3001/health
```

**Error:** `401 Unauthorized`

```bash
# Check if VITE_IS_PLATFORM is set
echo $VITE_IS_PLATFORM
# Should be "true" for local development
export VITE_IS_PLATFORM=true
```

### CI tests timeout

```bash
# Increase timeout or test individual scripts
npm run lint        # Test lint directly
npm run build       # Test build directly
npm run test:backend  # Test backend tests directly
```

---

## 📊 What to Report

After testing, please note:

### ✅ What Works

- List all passing tests
- Note performance (test duration)
- Any warnings (non-critical)

### ❌ What Fails

- Exact error messages
- Steps to reproduce
- Server logs around the error

### 💡 Suggestions

- Missing features you'd like
- UX improvements
- Performance issues

---

## 🎯 Quick Commands Reference

```bash
# Start server
npm run server

# Run all tests
./test-backend-workflow.sh

# Run WebSocket test
node test-websocket.js

# Test specific endpoint
curl -X POST http://localhost:3001/api/ci/run-single \
  -H "Content-Type: application/json" \
  -d '{"project": "claudecodeui", "test": "lint"}'

# Check server logs
# (Watch the terminal where npm run server is running)

# Kill server
# Ctrl+C in the server terminal
# Or: pkill -f "node server/index.js"
```

---

## 📚 Additional Resources

- **Full Testing Guide**: `TESTING_BACKEND.md`
- **API Documentation**: See `TESTING_BACKEND.md` for all endpoints
- **Troubleshooting**: See `TESTING_BACKEND.md` → Troubleshooting section

---

**Ready to start?** Run `npm run server` and then `./test-backend-workflow.sh`!
🚀
