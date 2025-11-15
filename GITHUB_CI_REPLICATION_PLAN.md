# GitHub CI Analysis & Local Replication Plan

**Branch:** `claude/review-ci-pipeline-015MsBxdfvtu2FABimS9ZJhq` **Date:**
2025-11-14

## Current Situation

### GitHub CI Status

**No workflows are currently running** because our branch
`claude/review-ci-pipeline-015MsBxdfvtu2FABimS9ZJhq` is a feature branch and
workflows only trigger on:

- `ci.yml`: Push to `main` or PRs to `main`
- `e2e-tests.yml`: Push to `main`/`develop` or PRs to `main`
- Other workflows: Scheduled or manual triggers only

**CI will start running when we create a PR to main.**

---

## What Will Happen When PR is Created

### Workflows That Will Trigger

#### 1. **ci.yml** (Main CI Pipeline)

**Trigger:** `pull_request` to `main`

Jobs that will run:

- `lint` - Lint and format check
- `security` - Security audit
- `build` - Build application
- `test-backend` - Backend tests
- `performance` - Bundle size analysis
- `status-check` - Overall status

#### 2. **e2e-tests.yml** (E2E Testing)

**Trigger:** `pull_request` to `main`

Jobs that will run:

- `build` - Build application
- `e2e-tests` - E2E tests (chromium, firefox, webkit)
- `e2e-tests-mobile` - Mobile E2E tests (Pixel 5, iPhone 12)
- `generate-baselines` - Visual baselines (conditional)
- `visual-regression` - Visual regression tests
- `performance-tests` - Performance tests
- `accessibility-tests` - Accessibility tests (chromium/firefox ×
  desktop/mobile)
- `generate-reports` - Aggregate test reports
- `test-summary` - Summary and PR comment
- `cleanup` - Artifact cleanup
- `notify` - Failure notifications

---

## Local CI Replication Strategy

### Goal

Run **exactly** the same commands that GitHub CI will run, in the same
environment (Node 20, Ubuntu).

---

## Phase 1: Replicate ci.yml Locally

### 1.1 Lint Job

```bash
# Exact CI commands
npm ci
npm run lint
```

**Expected:** PASS with ≤400 warnings **Current Status:** ✅ PASS (377 warnings)

### 1.2 Security Job

```bash
# Exact CI commands
npm ci
npm audit --audit-level high
```

**Expected:** No HIGH/CRITICAL vulnerabilities **Current Status:** ✅ PASS (0
high/critical)

### 1.3 Build Job

```bash
# Exact CI commands
npm ci
npm run build
```

**Expected:** Build succeeds, main bundle < 500 KB **Current Status:** ✅ PASS
(477 KB main bundle)

**CI will also:**

- Upload build artifacts to `actions/upload-artifact@v4`
- Store in `dist/` for 7 days

### 1.4 Backend Tests Job

```bash
# Exact CI commands
npm ci
npm run test:backend
```

**Expected:** All tests pass, coverage uploaded **Current Status:** ✅ PASS
(32/32 tests, 80.64% coverage)

### 1.5 Performance Job

```bash
# Exact CI commands (after build job)
# Downloads build artifacts first
du -sh dist/*

# Check bundle size limits
TOTAL_SIZE=$(du -sb dist | cut -f1)
MAX_SIZE=10485760  # 10MB
if [ "$TOTAL_SIZE" -gt "$MAX_SIZE" ]; then
  echo "Warning: Bundle size exceeds limit"
fi
```

**Expected:** Bundle < 10MB **Current Status:** ✅ PASS (~2.3 MB total)

---

## Phase 2: Replicate e2e-tests.yml Locally

### Critical Differences from Local Testing

**GitHub CI Environment:**

- Clean Ubuntu runner (no previous state)
- Node 20
- Fresh npm ci install
- Playwright browsers installed fresh
- Server started via `npm run server`
- Base URL: `http://localhost:3001`
- Headless mode
- No display

### 2.1 Build Job (E2E)

```bash
npm ci
npm run build
# Uploads: dist/, public/, node_modules/ as artifacts
```

### 2.2 E2E Tests Job (Per Browser)

```bash
# Downloads build artifacts
npm ci
npx playwright install --with-deps

# For each browser: chromium, firefox, webkit
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```

**Expected Issues:**

- ❌ Pre-existing tests will fail (chat, some auth/projects)
- ✅ New tests (accessibility, performance, visual) - unknown status

### 2.3 Mobile E2E Tests Job

```bash
npx playwright test --project=Mobile\ Chrome --grep="Mobile"
```

**Expected Issues:**

- Need tests tagged with "Mobile"
- Only accessibility tests have @Mobile tags

### 2.4 Visual Regression Job

```bash
# Depends on generate-baselines job
npm run server &
npx playwright test visual-regression.e2e.js
```

**Expected Issues:**

- ⚠️ First run: Baselines won't exist, will auto-create and skip
- ⚠️ Second run: Will compare against baselines

### 2.5 Performance Tests Job

```bash
npx playwright test --grep="Performance|Load\ time"
```

**Expected:**

- ✅ Should find our 20 performance tests

### 2.6 Accessibility Tests Job

```bash
# For each browser × device combination
npx playwright test accessibility-comprehensive.e2e.js --project=chromium
npx playwright test accessibility-comprehensive.e2e.js --project=firefox

# With --grep="Mobile" for mobile variants
```

**Expected:**

- ✅ Should find our 36 accessibility tests
- ⚠️ May find real accessibility violations in app

---

## Issues That Will Cause CI Failure

### Critical Issues (CI Will Fail)

#### 1. Pre-existing Test Failures

**Location:** `tests/e2e/auth.e2e.js`, `chat.e2e.js`, `projects.e2e.js`
**Impact:** 8/13 pre-existing tests failing (62%) **Failures:**

- 1/4 auth test fails (element not found)
- 5/5 chat tests fail (element selectors wrong)
- 2/4 projects tests fail (CSS selector syntax error)

**CI Behavior:**

- `e2e-tests` job will report failures
- `test-summary` job will show failures
- `notify` job will trigger (if enabled)
- **PR will show failing checks ❌**

#### 2. New Test Files May Have Runtime Issues

**Location:** `visual-regression.e2e.js`, `accessibility-comprehensive.e2e.js`,
`performance.e2e.js` **Impact:** 92 new tests, untested **Risk:**

- Helper functions may have bugs
- Selectors may not match actual UI
- Performance thresholds may be too strict
- Accessibility tests may find violations

**CI Behavior:**

- Unknown - never been run
- Could cause massive test failures

#### 3. Generate Baselines Script May Fail

**Location:** `scripts/generate-baselines.js` **Impact:** Visual regression
tests depend on this **Risk:**

- Script references helpers that may have issues
- Requires running server
- May timeout or fail

### Non-Critical Issues (CI Won't Fail)

#### 1. Frontend Tests Commented Out

**Status:** Intentionally disabled **Impact:** No frontend tests run **CI
Behavior:** Job doesn't exist, no failure

#### 2. Lighthouse Not Configured in Workflow

**Status:** Config created but not integrated in workflow **Impact:**
Performance workflow doesn't use it yet **CI Behavior:** No impact (performance
workflow only runs on schedule)

---

## Local Replication Commands

### Exact CI Simulation

```bash
# Clean environment (simulate fresh CI runner)
rm -rf node_modules package-lock.json
npm install

# Run ci.yml jobs
echo "=== CI.YML SIMULATION ==="

# Lint job
npm ci
npm run lint

# Security job
npm ci
npm audit --audit-level high

# Build job
npm ci
npm run build

# Backend tests job
npm ci
npm run test:backend

# Performance job (uses build artifacts)
du -sh dist/*
TOTAL_SIZE=$(du -sb dist | cut -f1)
MAX_SIZE=10485760
if [ "$TOTAL_SIZE" -gt "$MAX_SIZE" ]; then
  echo "⚠️ Warning: Bundle size ($TOTAL_SIZE bytes) exceeds recommended limit ($MAX_SIZE bytes)"
else
  echo "✅ Bundle size within recommended limits"
fi

echo "=== E2E-TESTS.YML SIMULATION ==="

# Install Playwright
npx playwright install --with-deps chromium firefox webkit

# Start server (background)
npm run server &
SERVER_PID=$!
sleep 15

# E2E tests - chromium
npx playwright test --project=chromium

# E2E tests - firefox (if chromium passes)
# npx playwright test --project=firefox

# E2E tests - webkit (if others pass)
# npx playwright test --project=webkit

# Mobile tests
npx playwright test --project="Mobile Chrome" --grep="Mobile"

# Performance tests
npx playwright test --grep="Performance|Load\ time"

# Accessibility tests
npx playwright test accessibility-comprehensive.e2e.js --project=chromium

# Visual regression (will create baselines on first run)
npx playwright test visual-regression.e2e.js --project=chromium

# Cleanup
kill $SERVER_PID
```

---

## Resolution Plan

### Strategy: Fix Blockers, Document Non-Blockers

#### Phase A: Fix Pre-existing Test Issues (OPTIONAL - Can defer)

**Time:** 2-3 hours **Impact:** High (CI will show green)

1. **Fix chat.e2e.js selectors**
   - Inspect actual UI to find correct selectors
   - Update test to use correct data-testid or elements
   - Retest until all 5 pass

2. **Fix projects.e2e.js CSS selector**
   - Line 21: Fix regex selector syntax
   - Should be: `.locator('[data-testid="empty-state"]')`
   - Or: `.locator('text=/no projects/i')`
   - Not mixed

3. **Fix auth.e2e.js interface detection**
   - Update selectors to match actual UI
   - May need to add data-testid to app

**Decision:** Document these as known issues, fix post-PR

#### Phase B: Test New E2E Files (REQUIRED)

**Time:** 30-60 minutes **Impact:** High (unknown status)

1. **Run accessibility tests**

   ```bash
   npx playwright test accessibility-comprehensive.e2e.js --project=chromium --max-failures=5
   ```

   - May find real accessibility issues
   - Document violations for post-PR fixes

2. **Run performance tests**

   ```bash
   npx playwright test performance.e2e.js --project=chromium --max-failures=5
   ```

   - May need to adjust thresholds
   - Check if tests are too strict

3. **Run visual regression tests**

   ```bash
   npx playwright test visual-regression.e2e.js --project=chromium --max-failures=5
   ```

   - First run will create baselines (expected)
   - Document baseline creation

#### Phase C: Document Expected CI Behavior

**Time:** 15 minutes **Impact:** Sets expectations

Create PR description that states:

- ✅ Core CI will pass (lint, security, build, backend tests)
- ⚠️ E2E tests have 8/13 pre-existing failures (documented)
- 🔄 New E2E tests (92 tests) - status to be determined by CI
- 📝 Known issues documented for follow-up

---

## Pre-PR Checklist

### Must Complete

- [ ] Run full ci.yml simulation locally
- [ ] Verify all ci.yml jobs pass
- [ ] Run sample of new E2E tests (accessibility, performance, visual)
- [ ] Document any new test failures found
- [ ] Commit any emergency fixes needed
- [ ] Create TEST_RESULTS_UPDATED.md with final results

### Nice to Have

- [ ] Fix pre-existing test failures (or defer to post-PR)
- [ ] Run full e2e-tests.yml simulation (all browsers)
- [ ] Generate visual baselines
- [ ] Test on all 3 browsers (chromium, firefox, webkit)

### Documentation

- [ ] Update TEST_RESULTS.md with final local test results
- [ ] Create PR description with:
  - Priority 1 achievements
  - Test results summary
  - Known issues (pre-existing + new)
  - Follow-up plan
- [ ] Create issues for:
  - Pre-existing test failures
  - Any new test issues found
  - Accessibility violations found
  - Performance threshold adjustments needed

---

## Expected CI Outcome

### ci.yml Workflow

**Prediction:** ✅ ALL JOBS PASS

- Lint: PASS (377 warnings < 400)
- Security: PASS (0 high/critical)
- Build: PASS (477 KB < 500 KB)
- Backend: PASS (32/32 tests)
- Performance: PASS (bundle < 10MB)
- Status: PASS

### e2e-tests.yml Workflow

**Prediction:** ⚠️ MIXED RESULTS

- Build: ✅ PASS
- E2E tests (chromium): ⚠️ ~38% pass (5/13 pre-existing tests)
- E2E tests (firefox): ⚠️ Similar to chromium
- E2E tests (webkit): ⚠️ Similar to chromium
- Mobile tests: ⚠️ Limited tests (only accessibility has @Mobile)
- Visual regression: ⚠️ First run will create baselines, skip comparisons
- Performance tests: 🔄 UNKNOWN (new tests)
- Accessibility tests: 🔄 UNKNOWN (new tests, may find violations)
- Generate reports: ⚠️ Will show failures
- Test summary: ⚠️ Will report 62% failure rate

### Overall PR Status

**Expected:** ⚠️ Some checks will fail

- ✅ ci.yml: ALL PASS
- ⚠️ e2e-tests.yml: FAILURES EXPECTED

**Acceptability:**

- Core CI passing is proof Priority 1 work is solid
- E2E failures are documented pre-existing issues
- New test infrastructure in place for future work

---

## Next Steps

1. **Run ci.yml simulation** (15 minutes)
   - Verify all jobs pass
   - No issues expected

2. **Run new E2E tests sample** (30 minutes)
   - Test accessibility tests (5-10 tests)
   - Test performance tests (5-10 tests)
   - Test visual regression (1-2 tests)
   - Document any failures

3. **Update documentation** (15 minutes)
   - Final test results
   - Known issues list
   - PR description draft

4. **Create PR** (10 minutes)
   - Clear title
   - Comprehensive description
   - Link to test results
   - Link to follow-up issues

5. **Monitor first CI run** (watch live)
   - Verify predictions
   - Document any surprises
   - Create issues for unexpected failures

---

**Total Time to PR:** ~1-2 hours **Ready to Proceed:** After completing steps
1-3
