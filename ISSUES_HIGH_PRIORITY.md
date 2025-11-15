# High Priority Issues - Code Review

This document contains detailed high-priority issues identified during code
review of changes between origin and upstream.

---

## Issue #1: API Key Fallback Security Concern

**Priority:** 🔴 High **Type:** Security **Component:** Zai SDK Integration
**File:** `server/zai-sdk.js:24`

### Description

The Zai SDK configuration uses a fallback pattern that could lead to unintended
API usage and potential security issues:

```javascript
const zaiClient = new Anthropic({
  apiKey: process.env.ZAI_API_KEY || process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ZAI_BASE_URL || 'https://api.zai.com/v1',
});
```

### Problem

1. **Unintended Provider Usage**: If `ZAI_API_KEY` is not set, the code silently
   falls back to `ANTHROPIC_API_KEY`, which may route requests to the wrong
   provider
2. **Cost Implications**: Using the wrong API key could result in unexpected
   billing
3. **Security Risk**: API keys are provider-specific and should not be
   interchangeable
4. **Silent Failures**: No warning is logged when falling back to the wrong key

### Impact

- Users may unknowingly use Anthropic API when they intended to use Zai
- Billing surprises and cost overruns
- Potential API quota issues
- Security audit failures

### Recommended Solution

**Option 1: Fail Fast (Recommended)**

```javascript
const zaiClient = new Anthropic({
  apiKey:
    process.env.ZAI_API_KEY ||
    (() => {
      throw new Error(
        'ZAI_API_KEY environment variable is required for Zai provider'
      );
    })(),
  baseURL: process.env.ZAI_BASE_URL || 'https://api.zai.com/v1',
});
```

**Option 2: Explicit Warning**

```javascript
const getZaiApiKey = () => {
  if (process.env.ZAI_API_KEY) {
    return process.env.ZAI_API_KEY;
  }

  if (process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '⚠️  ZAI_API_KEY not found, falling back to ANTHROPIC_API_KEY. This may cause unexpected behavior.'
    );
    return process.env.ANTHROPIC_API_KEY;
  }

  throw new Error(
    'Neither ZAI_API_KEY nor ANTHROPIC_API_KEY environment variable is set'
  );
};

const zaiClient = new Anthropic({
  apiKey: getZaiApiKey(),
  baseURL: process.env.ZAI_BASE_URL || 'https://api.zai.com/v1',
});
```

### Action Items

- [ ] Decide on approach (fail fast vs. explicit warning)
- [ ] Update `server/zai-sdk.js` with chosen solution
- [ ] Add environment variable validation on server startup
- [ ] Update documentation to clarify required environment variables
- [ ] Add integration tests for missing API key scenarios

### Related Files

- `server/zai-sdk.js:24`
- `server/provider-router.js`
- `.env.example` (should document ZAI_API_KEY)

---

## Issue #2: Session Mapping Memory Leak Risk

**Priority:** 🟡 Medium-High **Type:** Bug / Performance **Component:** Provider
Router **File:** `server/provider-router.js:26, 69-95, 141-152`

### Description

The session-to-provider mapping uses an in-memory Map without timeout-based
cleanup, which could lead to memory leaks if sessions don't complete normally.

```javascript
// Session to provider mapping
const sessionProviderMap = new Map();

// Mapped at line 71
sessionProviderMap.set(sessionId, provider);

// Only removed at completion or error (lines 141-152)
if (options.sessionId) {
  unmapSession(options.sessionId);
}
```

### Problem

1. **Stuck Sessions**: If a session crashes, times out, or the WebSocket
   disconnects unexpectedly, the mapping is never cleaned up
2. **Memory Growth**: Long-running servers will accumulate orphaned session
   mappings
3. **No TTL**: Sessions have no expiration time
4. **No Maximum Size**: Map can grow unbounded

### Impact

- Memory usage grows over time on production servers
- No automatic recovery from abnormal session termination
- Potential server instability under high load

### Proof of Concept

```javascript
// Scenario: WebSocket dies mid-session
1. Session created: sessionProviderMap.set('sess-123', 'claude')
2. WebSocket connection lost (client crashes)
3. routeQuery() never completes → unmapSession() never called
4. 'sess-123' stays in map forever
```

### Recommended Solution

**Add Timeout-Based Cleanup:**

```javascript
// Enhanced session tracking with TTL
const sessionProviderMap = new Map();
const sessionTimestamps = new Map();
const SESSION_TTL = 60 * 60 * 1000; // 1 hour

function mapSessionToProvider(sessionId, provider) {
  if (!sessionId) return;
  sessionProviderMap.set(sessionId, provider);
  sessionTimestamps.set(sessionId, Date.now());
  console.log(`📍 Mapped session ${sessionId} to provider: ${provider}`);
}

function unmapSession(sessionId) {
  if (!sessionId) return;
  sessionProviderMap.delete(sessionId);
  sessionTimestamps.delete(sessionId);
  console.log(`🗑️ Unmapped session ${sessionId}`);
}

// Cleanup stale sessions
function cleanupStaleSessions() {
  const now = Date.now();
  for (const [sessionId, timestamp] of sessionTimestamps.entries()) {
    if (now - timestamp > SESSION_TTL) {
      console.log(`🧹 Cleaning up stale session: ${sessionId}`);
      unmapSession(sessionId);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupStaleSessions, 10 * 60 * 1000);
```

**Add Maximum Size Limit:**

```javascript
const MAX_SESSION_MAP_SIZE = 1000;

function mapSessionToProvider(sessionId, provider) {
  if (!sessionId) return;

  // If at capacity, remove oldest session
  if (sessionProviderMap.size >= MAX_SESSION_MAP_SIZE) {
    const oldestSession = Array.from(sessionTimestamps.entries()).sort(
      (a, b) => a[1] - b[1]
    )[0]?.[0];
    if (oldestSession) {
      console.warn(
        `⚠️  Session map at capacity, removing oldest: ${oldestSession}`
      );
      unmapSession(oldestSession);
    }
  }

  sessionProviderMap.set(sessionId, provider);
  sessionTimestamps.set(sessionId, Date.now());
  console.log(`📍 Mapped session ${sessionId} to provider: ${provider}`);
}
```

### Action Items

- [ ] Add timestamp tracking for sessions
- [ ] Implement TTL-based cleanup with configurable timeout
- [ ] Add maximum size limit with LRU eviction
- [ ] Add monitoring/metrics for session map size
- [ ] Add unit tests for cleanup logic
- [ ] Document session lifecycle in code comments

### Related Files

- `server/provider-router.js`
- `server/claude-sdk.js` (session tracking)
- `server/cursor-cli.js` (session tracking)

---

## Issue #3: Path Validation Logic Missing in Production Code

**Priority:** 🟡 Medium **Type:** Security / Architecture **Component:** Testing
Infrastructure **File:** `tests/security.test.js:597-629`

### Description

Critical path validation logic exists only in test files as helper functions,
but is not implemented in the actual production codebase. This creates a
test-only security check that doesn't protect the application at runtime.

```javascript
// tests/security.test.js:597
function validatePath(requestedPath) {
  const forbiddenPaths = ['/', '/etc', '/bin', '/sbin', '/usr', '/dev', ...];
  // ... validation logic ...
  return { valid: true/false, error: '...', resolvedPath: '...' };
}
```

### Problem

1. **Test-Only Security**: Security checks only run in tests, not in production
2. **False Sense of Security**: Tests pass, but production code is unprotected
3. **Missing Implementation**: No corresponding validation in
   `server/projects.js` or other route handlers
4. **Architecture Issue**: Security logic should be in production code, not
   duplicated in tests

### Impact

- Production application may accept dangerous paths (e.g., `/etc/passwd`,
  `/root`)
- Security vulnerability: potential unauthorized file access
- Test coverage metrics are misleading
- Code maintenance burden (logic in wrong place)

### Current Test Coverage

The test file covers:

- System directory rejection (`/etc`, `/bin`, `/sys`, etc.)
- Path traversal prevention (`../../../etc/passwd`)
- Symlink validation
- Workspace root enforcement
- Relative path handling

### Recommended Solution

**Step 1: Create Production Validation Module**

Create `server/utils/path-validator.js`:

```javascript
import path from 'path';
import { promises as fs } from 'fs';

const FORBIDDEN_PATHS = [
  '/',
  '/etc',
  '/bin',
  '/sbin',
  '/usr',
  '/dev',
  '/proc',
  '/sys',
  '/var',
  '/boot',
  '/root',
  '/lib',
  '/lib64',
  '/opt',
  '/tmp',
  '/run',
];

const SAFE_EXCEPTIONS = ['/var/tmp', '/var/folders'];

export async function validatePath(requestedPath, workspaceRoot = null) {
  // Normalize and resolve path
  const normalizedPath = path.normalize(path.resolve(requestedPath));

  // Check against forbidden paths
  for (const forbidden of FORBIDDEN_PATHS) {
    if (
      normalizedPath === forbidden ||
      normalizedPath.startsWith(forbidden + path.sep)
    ) {
      // Check safe exceptions
      const isSafeException = SAFE_EXCEPTIONS.some(safe =>
        normalizedPath.startsWith(safe + path.sep)
      );

      if (!isSafeException) {
        return {
          valid: false,
          error: `Cannot create workspace in system directory: ${forbidden}`,
        };
      }
    }
  }

  // Validate within workspace root if specified
  if (workspaceRoot) {
    const resolvedRoot = path.resolve(workspaceRoot);
    if (!normalizedPath.startsWith(resolvedRoot + path.sep)) {
      return {
        valid: false,
        error: `Path must be within workspace root: ${workspaceRoot}`,
      };
    }
  }

  // Validate symlinks
  try {
    const stat = await fs.lstat(normalizedPath);
    if (stat.isSymbolicLink()) {
      const realPath = await fs.realpath(normalizedPath);
      // Re-validate the real path
      return validatePath(realPath, workspaceRoot);
    }
  } catch (error) {
    // Path doesn't exist yet - that's okay for creation
    if (error.code !== 'ENOENT') {
      return {
        valid: false,
        error: `Path validation error: ${error.message}`,
      };
    }
  }

  return {
    valid: true,
    resolvedPath: normalizedPath,
  };
}

export async function validatePathLength(pathString, maxLength = 4096) {
  if (pathString.length > maxLength) {
    return {
      valid: false,
      error: `Path length ${pathString.length} exceeds maximum ${maxLength}`,
    };
  }
  return { valid: true };
}
```

**Step 2: Use in Production Code**

Update `server/routes/projects.js` or relevant routes:

```javascript
import { validatePath, validatePathLength } from '../utils/path-validator.js';

router.post('/create-project', async (req, res) => {
  const { projectPath, name } = req.body;

  // Validate path
  const validation = await validatePath(
    projectPath,
    process.env.WORKSPACES_ROOT
  );
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Validate path length
  const lengthValidation = await validatePathLength(projectPath);
  if (!lengthValidation.valid) {
    return res.status(400).json({ error: lengthValidation.error });
  }

  // Proceed with project creation
  // ...
});
```

**Step 3: Update Tests to Import Production Code**

Update `tests/security.test.js`:

```javascript
import { validatePath, validatePathLength } from '../server/utils/path-validator.js';

describe('File System Security and Path Validation', () => {
  // Remove test helper functions - use production code instead

  test('should reject dangerous system paths', async () => {
    const forbiddenPaths = ['/', '/etc', '/bin', ...];

    for (const forbiddenPath of forbiddenPaths) {
      const result = await validatePath(forbiddenPath);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot create workspace in system directory');
    }
  });

  // ... rest of tests use imported functions
});
```

### Action Items

- [ ] Create `server/utils/path-validator.js` with production validation logic
- [ ] Identify all routes that accept file paths (projects, git, file
      operations)
- [ ] Add validation to all relevant route handlers
- [ ] Update tests to import and test production code
- [ ] Remove duplicate validation logic from test files
- [ ] Add integration tests for path validation in routes
- [ ] Document path validation in API documentation

### Related Files

- `tests/security.test.js` (contains test-only implementation)
- `server/routes/projects.js` (needs validation)
- `server/routes/git.js` (needs validation)
- `server/projects.js` (needs validation)

---

## Issue #4: GitHub CLI Dependency Not Gracefully Handled

**Priority:** 🔵 Low-Medium **Type:** User Experience **Component:** Git
Integration **File:** `server/routes/git.js:1132-1141`

### Description

The GitHub PR detection feature depends on GitHub CLI (`gh`) being installed,
but handles the missing dependency by returning a JSON response without properly
communicating the limitation to users.

```javascript
// Check if gh CLI is available
try {
  await execAsync('which gh');
} catch (error) {
  return res.json({
    hasPR: false,
    prUrl: null,
    error: 'GitHub CLI not available',
  });
}
```

### Problem

1. **Silent Degradation**: Feature silently doesn't work if `gh` is not
   installed
2. **Poor User Experience**: No guidance on how to install or configure `gh`
3. **Inconsistent Error Handling**: Error field in successful response (200
   status) is confusing
4. **No Startup Validation**: Server doesn't check for `gh` on startup
5. **Documentation Gap**: No mention of `gh` as a dependency

### Impact

- Users may think PR detection is broken when it's just a missing dependency
- No clear path to enable the feature
- Support burden increases (users report "bug" when it's just missing `gh`)

### Recommended Solution

**Option 1: Startup Validation with Clear Messaging**

Add to `server/index.js`:

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function checkOptionalDependencies() {
  const dependencies = {
    gh: {
      name: 'GitHub CLI',
      check: async () => {
        try {
          await execAsync('which gh');
          return true;
        } catch {
          return false;
        }
      },
      installUrl: 'https://cli.github.com/',
      features: ['GitHub PR detection in Git panel'],
    },
  };

  console.log('\n📋 Checking optional dependencies:');

  for (const [key, dep] of Object.entries(dependencies)) {
    const available = await dep.check();
    if (available) {
      console.log(`  ✅ ${dep.name}: Available`);
    } else {
      console.log(`  ⚠️  ${dep.name}: Not found`);
      console.log(`     Features disabled: ${dep.features.join(', ')}`);
      console.log(`     Install: ${dep.installUrl}`);
    }
  }

  console.log('');
}

// Call during server startup
await checkOptionalDependencies();
```

**Option 2: Better Error Response**

Update `server/routes/git.js`:

```javascript
// Check if gh CLI is available
try {
  await execAsync('which gh');
} catch (error) {
  return res.status(200).json({
    hasPR: false,
    prUrl: null,
    available: false,
    message: 'GitHub CLI (gh) is not installed. PR detection unavailable.',
    installUrl: 'https://cli.github.com/',
  });
}
```

**Option 3: Frontend Graceful Degradation**

Update `src/components/GitPanel.jsx`:

```javascript
const checkForPR = async () => {
  // ... existing code ...

  const data = await response.json();
  if (data.error) {
    console.error('Error checking for PR:', data.error);

    // Show user-friendly message for missing gh CLI
    if (data.error.includes('GitHub CLI')) {
      // Could show a one-time tooltip or banner
      console.info('💡 Install GitHub CLI (gh) to enable PR detection');
    }

    setHasPR(false);
    setPrUrl(null);
  }
  // ... rest of code ...
};
```

### Action Items

- [ ] Add optional dependency check on server startup
- [ ] Improve error response structure (add `available`, `message`, `installUrl`
      fields)
- [ ] Update frontend to show helpful message when `gh` is not available
- [ ] Add `gh` to documentation as optional dependency
- [ ] Consider adding `gh` to Docker image (if applicable)
- [ ] Add environment variable to disable PR check if needed:
      `ENABLE_PR_DETECTION`

### Related Files

- `server/routes/git.js:1132-1141`
- `src/components/GitPanel.jsx:357-390`
- `server/index.js` (for startup checks)
- `README.md` (for documentation)
- `Dockerfile` (if using Docker)

---

## Summary

### Priority Breakdown

- 🔴 **High Priority:** 1 issue (API Key Fallback)
- 🟡 **Medium-High Priority:** 2 issues (Session Memory Leak, Path Validation)
- 🔵 **Low-Medium Priority:** 1 issue (GitHub CLI Dependency)

### Recommended Timeline

1. **Week 1**: Fix Issue #1 (API Key Fallback) - Security critical
2. **Week 2**: Fix Issue #2 (Session Cleanup) - Prevents memory leaks
3. **Week 3**: Fix Issue #3 (Path Validation) - Security hardening
4. **Week 4**: Fix Issue #4 (GitHub CLI) - UX improvement

### Testing Requirements

Each fix should include:

- Unit tests for the fix
- Integration tests where applicable
- Manual testing in development environment
- Security testing (for Issues #1 and #3)

---

**Generated:** 2025-11-14 **Review Version:** 1.0 **Reviewer:** Claude Code
Review Assistant
