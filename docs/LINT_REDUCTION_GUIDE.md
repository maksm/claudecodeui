# ESLint Warning Reduction Guide

## Overview

**Current Warnings**: 383 (as of last check) **Target**: Reduce by 100+ warnings
**Approach**: Conservative, manual fixes to avoid breaking changes

## Warning Categories

### 1. Unused Variables (341 warnings - 89%)

Most common type. Includes:

- Catch block error variables not used
- Function parameters not used
- Destructured properties not used
- Imported modules not used

### 2. React Hooks Dependencies (40 warnings - 10%)

Missing dependencies in useEffect, useCallback, useMemo arrays. **High Risk**:
Can cause infinite loops or unexpected behavior.

## Safe Fix Patterns

### Pattern 1: Empty Catch Blocks

**Current**:

```javascript
try {
  await someOperation();
} catch (error) {
  return res.status(500).json({ error: 'Failed' });
}
```

**Fixed**:

```javascript
try {
  await someOperation();
} catch {
  // Empty catch - error not needed
  return res.status(500).json({ error: 'Failed' });
}
```

**Verification**: Error variable must NOT appear anywhere in catch block.

### Pattern 2: Unused Function Parameters (Only when not used!)

**Current**:

```javascript
array.map((item, index) => {
  return item.name; // index not used
});
```

**Fixed**:

```javascript
array.map((item, _index) => {
  return item.name; // _ prefix indicates intentionally unused
});
```

**CRITICAL**: Do NOT rename if parameter is used in function body!

### Pattern 3: Remove Unused Imports

**Current**:

```javascript
import { spawn, exec } from 'child_process';
// Only exec is used
```

**Fixed**:

```javascript
import { exec } from 'child_process';
```

**Verification**: Search entire file to confirm import never used.

## ⚠️ Common Pitfalls

### Pitfall 1: Renaming Used Variables

```javascript
// WRONG - Will break code!
async (args, context) => {
  return context.sessionId; // context is used!
};

// Renaming to _context breaks this!
async (_args, _context) => {
  return context.sessionId; // Error: context is not defined
};
```

### Pitfall 2: Assuming Destructured Variables Are Unused

```javascript
const { theme, setTheme } = useTheme();
// theme appears unused but might be used later or in JSX
```

### Pitfall 3: React Hook Dependencies

```javascript
// RISKY - May cause infinite loops
useEffect(() => {
  fetchData(dependency);
}, [dependency]); // Adding this might trigger constant re-renders
```

## Recommended Workflow

1. **One File at a Time**: Process individual files completely
2. **Search Before Fix**: Use "Find All References" in editor
3. **Verify After Each Fix**: Run `npx eslint path/to/file.js`
4. **Test Changes**: Run `npm run lint` to check overall count
5. **Commit Incrementally**: Small commits are easier to review/revert

## Tools

```bash
# Count total warnings
npm run lint 2>&1 | grep "warning" | wc -l

# Check specific file
npx eslint server/routes/commands.js

# See detailed warnings
npm run lint 2>&1 | less
```

## Priority Order

1. **Start Here**: Unused catch block errors (safest)
2. **Next**: Remove unused imports (verify carefully)
3. **Then**: Prefix unused callback parameters (verify not used)
4. **Later**: Unused destructured variables (medium risk)
5. **Last**: React Hooks dependencies (highest risk, needs testing)

## Success Criteria

- ✅ Warnings reduced without introducing errors
- ✅ All pre-commit hooks pass
- ✅ No "is not defined" errors introduced
- ✅ Code still functions identically

## Estimated Effort

- **Quick wins** (50-70 warnings): 2-3 hours of careful manual work
- **Medium fixes** (30-40 warnings): 2-3 hours with testing
- **Complex fixes** (React Hooks): Requires component testing

**Total to reduce 100 warnings**: 4-6 hours of focused, careful work

## Notes

This is a maintenance task that improves code quality but requires patience and
attention to detail. Automated tools are risky because they can't understand
code context. Manual review is essential.
