# Local CI Testing Plan & Resolution Strategy

**Branch:** `claude/review-ci-pipeline-015MsBxdfvtu2FABimS9ZJhq` **Date:**
2025-11-14 **Goal:** Test all CI components locally until passing, then push to
PR

---

## Strategy Overview

Since we've made significant CI changes, we need to validate everything locally
before relying on GitHub Actions. This ensures CI will pass when it runs
remotely.

---

## Phase 1: Core CI Pipeline Testing (ci.yml)

### 1.1 Lint Check

```bash
npm run lint
```

**Expected Result:** PASS with ≤ 400 warnings **Current Status:** ⚠️ 377
warnings (PASSED)

**Action Items:**

- ✅ Already passing
- Monitor: Should not exceed 400 warnings

### 1.2 Security Audit

```bash
npm audit --audit-level high
```

**Expected Result:** No HIGH or CRITICAL vulnerabilities **Current Status:** ⚠️
24 moderate/low vulnerabilities (PASSED)

**Action Items:**

- ✅ Passing (only moderate/low in dev dependencies)
- 🔄 Priority 2: Address with `npm audit fix`

### 1.3 Build Test

```bash
npm run build
```

**Expected Result:** Build succeeds, bundle < 500 KB **Current Status:** ✅
PASSED

- Main bundle: 477 KB (was 1,072 KB)
- Vendor chunks: Split intelligently
- Build time: ~13s

**Action Items:**

- ✅ Already passing

### 1.4 Backend Tests

```bash
npm run test:backend
```

**Expected Result:** All tests pass, 80%+ coverage **Current Status:** ✅ PASSED
(32/32 tests, 80.64% coverage)

**Action Items:**

- ✅ Already passing

---

## Phase 2: E2E Tests Validation (e2e-tests.yml)

**CRITICAL:** E2E tests require running server and take significant time.

### 2.1 Pre-flight Checks (No Server Required)

#### Test File Parsing

```bash
npx playwright test --list
```

**Expected Result:** All tests discovered, no import errors **Current Status:**
✅ PASSED - 104 tests per browser (520 total)

**Action Items:**

- ✅ Already passing

#### Install Playwright Browsers

```bash
npx playwright install --with-deps chromium
```

**Expected Result:** Chromium installed successfully **Current Status:** 🔄 NOT
TESTED YET

### 2.2 Smoke Test (With Server)

**Setup:**

```bash
# Terminal 1: Start server
npm run server

# Terminal 2: Run minimal tests
npx playwright test auth.e2e.js --project=chromium
```

**Expected Result:** Basic auth tests pass **Current Status:** 🔄 NOT TESTED YET

**Action Items:**

- [ ] Start server in background
- [ ] Run auth.e2e.js (5 tests)
- [ ] Verify tests can connect to localhost:3001
- [ ] Check for any runtime errors

### 2.3 Critical Test Suites

Run in order of dependency:

#### A. Authentication Tests (Foundation)

```bash
npx playwright test auth.e2e.js --project=chromium
```

**Tests:** 5 auth tests **Priority:** CRITICAL (other tests depend on login)

#### B. Basic E2E Tests

```bash
npx playwright test chat.e2e.js projects.e2e.js --project=chromium
```

**Tests:** 5 chat + 3 projects = 8 tests **Priority:** HIGH (verify app
functionality)

#### C. Performance Tests

```bash
npx playwright test performance.e2e.js --project=chromium --grep="@Performance"
```

**Tests:** 20 performance tests **Priority:** MEDIUM (tagged tests) **Note:**
May fail on slow systems; check thresholds

#### D. Accessibility Tests (Most Complex)

```bash
npx playwright test accessibility-comprehensive.e2e.js --project=chromium --max-failures=5
```

**Tests:** 36 accessibility tests **Priority:** HIGH (comprehensive WCAG checks)
**Note:** Uses AxeBuilder, may uncover real issues

#### E. Visual Regression Tests (Requires Baselines)

```bash
# First: Generate baselines
node scripts/generate-baselines.js

# Then: Run tests
npx playwright test visual-regression.e2e.js --project=chromium --max-failures=3
```

**Tests:** 36 visual tests **Priority:** MEDIUM (can run without baselines -
auto-creates) **Note:** First run will create baselines and skip comparisons

### 2.4 Full E2E Suite (If All Smoke Tests Pass)

```bash
npx playwright test --project=chromium
```

**Tests:** All 104 tests **Priority:** FULL VALIDATION **Time:** ~10-30 minutes
depending on machine

---

## Phase 3: Performance Workflow Testing (performance.yml)

### 3.1 Bundle Analysis

```bash
npm run build && du -sh dist/*
```

**Expected Result:** Bundle within limits **Current Status:** ✅ PASSED (already
tested)

### 3.2 Lighthouse CI (Requires Running Server)

```bash
# Terminal 1: Server
npm run server

# Terminal 2: Lighthouse
npm install -g @lhci/cli
lhci autorun --config=lighthouserc.json
```

**Expected Result:** Performance > 90, Accessibility > 95 **Current Status:** 🔄
NOT TESTED (new config)

**Action Items:**

- [ ] Install lighthouse CI
- [ ] Test lighthouserc.json config
- [ ] Verify scores meet thresholds
- [ ] Adjust budgets if needed

---

## Phase 4: Known Issues & Expected Failures

### Issues to Address Before CI

1. **Frontend Tests Not Running**
   - Lines 107-137 in ci.yml are commented out
   - Status: Intentional (Priority 2)
   - Action: Skip for now

2. **Docker Workflow Disabled**
   - Requires Docker Hub credentials
   - Status: Intentional (Priority 2)
   - Action: Manual trigger only

3. **Publish Workflow**
   - Only runs on tags
   - Status: Expected (won't run on branch)
   - Action: No testing needed

4. **E2E Tests May Uncover App Bugs**
   - Accessibility tests are very strict
   - Performance tests have tight thresholds
   - Visual tests require exact pixel matches
   - Status: Expected - may need fixes
   - Action: Document failures, prioritize fixes

---

## Local Testing Execution Plan

### Step 1: Core CI Validation (5 minutes)

```bash
# Run all core CI checks in sequence
echo "=== LINT CHECK ===" && npm run lint && \
echo "=== SECURITY AUDIT ===" && npm audit --audit-level high && \
echo "=== BUILD CHECK ===" && npm run build && \
echo "=== BACKEND TESTS ===" && npm run test:backend
```

**Decision Point:** All must pass before proceeding

### Step 2: Playwright Installation (2 minutes)

```bash
npx playwright install --with-deps chromium
```

### Step 3: Server Smoke Test (5 minutes)

```bash
# Terminal 1
npm run server &
SERVER_PID=$!
sleep 10

# Terminal 2
npx playwright test auth.e2e.js --project=chromium

# Cleanup
kill $SERVER_PID
```

**Decision Point:** If auth tests fail, fix before proceeding

### Step 4: Critical E2E Tests (15 minutes)

```bash
# Start server
npm run server &
SERVER_PID=$!
sleep 10

# Run critical tests
npx playwright test auth.e2e.js chat.e2e.js projects.e2e.js --project=chromium

# Cleanup
kill $SERVER_PID
```

**Decision Point:** Fix blocking issues before full suite

### Step 5: Extended E2E Tests (30 minutes)

```bash
# Start server
npm run server &
SERVER_PID=$!
sleep 10

# Run all non-visual tests (visual tests can auto-create baselines)
npx playwright test --project=chromium --grep-invert="Visual Regression"

# Cleanup
kill $SERVER_PID
```

**Decision Point:** Document failures for triage

### Step 6: Visual Tests with Baseline Generation (20 minutes)

```bash
# Generate baselines (requires server)
npm run server &
SERVER_PID=$!
sleep 10

node scripts/generate-baselines.js

# Run visual regression tests
npx playwright test visual-regression.e2e.js --project=chromium

kill $SERVER_PID
```

### Step 7: Lighthouse CI Test (Optional - 10 minutes)

```bash
npm install -g @lhci/cli
npm run server &
SERVER_PID=$!
sleep 15

lhci autorun --config=lighthouserc.json

kill $SERVER_PID
```

---

## Test Results Documentation

### Template for Test Results

```markdown
## Test Execution Results - [Date]

### Core CI (ci.yml)

- [ ] Lint: PASS/FAIL - Details:
- [ ] Security: PASS/FAIL - Details:
- [ ] Build: PASS/FAIL - Details:
- [ ] Backend Tests: PASS/FAIL - Details:

### E2E Tests (e2e-tests.yml)

- [ ] Playwright Install: PASS/FAIL
- [ ] Auth Tests (5): PASS/FAIL - X passed, Y failed
- [ ] Chat Tests (5): PASS/FAIL - X passed, Y failed
- [ ] Projects Tests (3): PASS/FAIL - X passed, Y failed
- [ ] Performance Tests (20): PASS/FAIL - X passed, Y failed
- [ ] Accessibility Tests (36): PASS/FAIL - X passed, Y failed
- [ ] Visual Regression (36): PASS/FAIL - X passed, Y failed

### Known Issues Found

1. [Issue description] - Severity: HIGH/MEDIUM/LOW
   - Test: [test name]
   - Error: [error message]
   - Fix needed: [description]

### Blockers

- [Blocker 1]
- [Blocker 2]

### Non-Blockers (Can fix later)

- [Issue 1]
- [Issue 2]
```

---

## Failure Triage & Resolution

### Common Expected Failures

#### 1. Accessibility Violations

**Symptoms:** axe-core reports violations **Severity:** MEDIUM to HIGH
**Action:**

- Document violations
- Create issues for each unique violation type
- May need app code fixes, not test fixes

#### 2. Performance Threshold Misses

**Symptoms:** Page load > 3s, metrics exceed limits **Severity:** LOW to MEDIUM
**Action:**

- Check if running on slow hardware (CI is fast)
- May need to adjust thresholds for CI environment
- Could indicate real performance issues

#### 3. Visual Regression Differences

**Symptoms:** Screenshots don't match baselines **Severity:** LOW **Action:**

- First run should create baselines (expected)
- Subsequent runs compare against baselines
- Differences may be legitimate or flaky

#### 4. Timeout Errors

**Symptoms:** Tests timeout waiting for elements **Severity:** MEDIUM to HIGH
**Action:**

- Check if server is running
- Verify port 3001 is accessible
- May indicate slow app startup

#### 5. Import/Module Errors

**Symptoms:** Cannot find module, syntax errors **Severity:** HIGH (BLOCKER)
**Action:**

- Fix immediately
- Usually wrong import paths or missing dependencies

---

## Resolution Strategy

### Blockers (Must Fix Before PR)

1. **Module/Import Errors** - Fix immediately, commit, test again
2. **Test Parsing Failures** - Fix test code, commit, test again
3. **Server Connection Failures** - Investigate port/startup issues
4. **Auth Test Failures** - Other tests depend on this, must fix

### Non-Blockers (Can Document & Fix Later)

1. **Some Accessibility Violations** - Create issues, don't block PR
2. **Performance Threshold Exceedances** - May need threshold adjustments
3. **Visual Regression Differences** - Expected on first run
4. **Flaky Tests** - Document, add to issue tracker

---

## Commit Strategy

### After Each Test Phase Passes

#### Phase 1 Pass (Core CI)

```bash
# Already committed - no action needed
```

#### Phase 2 Pass (E2E Smoke Tests)

```bash
# If fixes needed
git add [fixed-files]
git commit -m "fix: resolve E2E smoke test issues

- Fixed [specific issue]
- Tests passing: auth, chat, projects (13/13)"
git push
```

#### Phase 3 Pass (Full E2E Suite)

```bash
# If fixes needed
git add [fixed-files]
git commit -m "fix: resolve E2E test failures

- Fixed [issues found]
- All 104 tests passing in chromium
- Visual baselines generated"
git push
```

#### Phase 4 Pass (Lighthouse)

```bash
# If config adjustments needed
git add lighthouserc.json
git commit -m "chore: adjust Lighthouse thresholds based on local testing

- Performance score: X
- Accessibility score: Y
- All assertions passing"
git push
```

---

## Final Pre-PR Checklist

Before creating/updating PR, verify:

- [ ] All core CI checks pass locally
- [ ] Playwright tests parse without errors
- [ ] Auth tests pass (foundation for other tests)
- [ ] At least 80% of E2E tests pass
- [ ] Blockers documented with fix plan
- [ ] Non-blockers documented for future work
- [ ] All test fixes committed and pushed
- [ ] Branch is up to date with remote
- [ ] No uncommitted changes

---

## GitHub CI Monitoring (After Push)

Once tests pass locally and committed:

1. **Watch CI Run**

   ```bash
   gh run watch
   # OR visit: https://github.com/maksm/claudecodeui/actions
   ```

2. **Expected CI Behavior**
   - ci.yml: Should pass (we tested locally)
   - e2e-tests.yml: May fail on first run (baselines)
   - performance.yml: Only runs on schedule/manual
   - docker.yml: Only runs on tags/manual
   - publish.yml: Only runs on tags

3. **If CI Fails Despite Local Success**
   - Check for environment differences (Node version, OS)
   - Review CI logs for specific errors
   - May need CI-specific adjustments
   - Document in issue for investigation

---

## Time Estimates

- **Phase 1 (Core CI):** 5 minutes
- **Phase 2 (Smoke Tests):** 10 minutes
- **Phase 3 (Critical E2E):** 20 minutes
- **Phase 4 (Full E2E Suite):** 30-60 minutes
- **Phase 5 (Visual + Lighthouse):** 30 minutes
- **Total:** ~2-3 hours for complete validation

**Recommended Approach:**

- Run Phase 1-2 immediately (15 min)
- If passing, commit progress
- Run Phase 3-4 in one session (45-60 min)
- Visual tests can run separately if time-constrained

---

## Success Criteria for PR

### Minimum Requirements (Blockers Fixed)

- ✅ Core CI passes (lint, security, build, backend tests)
- ✅ Test files parse without errors (104 tests discovered)
- ✅ Auth tests pass (5/5)
- ✅ Basic E2E tests pass (auth, chat, projects - 13/13)
- ✅ No import/module errors
- ✅ Server starts and accepts connections

### Nice to Have (But Not Blockers)

- 🎯 80%+ of E2E tests pass
- 🎯 Performance tests mostly pass (may need threshold tuning)
- 🎯 Accessibility tests identify issues (expected)
- 🎯 Visual baselines generated
- 🎯 Lighthouse CI config validated

### Documentation Requirements

- 📝 Known issues documented in PR description
- 📝 Test results summary included
- 📝 Follow-up issues created for non-blockers
- 📝 Testing steps documented

---

**Next Steps:** Execute Phase 1 to validate core CI locally
