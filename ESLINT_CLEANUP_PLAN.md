# ESLint Cleanup Plan

## Overview

This document outlines a systematic approach to clean up the 261 ESLint warnings
in the codebase.

## Warning Categories

### 1. Unused Variables (200+ warnings)

**Pattern**: Variables defined but never used **Common files**: Server-side
error handling, test files

#### 1.1 Unused Error Variables (50+ warnings)

- **Files**: `server/routes/taskmaster.js`, `server/projects.js`,
  `server/index.js`
- **Issue**: `error`, `e`, `err` parameters in catch blocks not used
- **Solution**: Prefix with underscore: `_error`, `catch (_error)`

#### 1.2 Unused Function Parameters (30+ warnings)

- **Files**: Component props, callback functions
- **Issue**: Parameters not used in function body
- **Solution**: Prefix with underscore: `_paramName`

#### 1.3 Unused Imports (40+ warnings)

- **Files**: Test files, component files
- **Issue**: Imported but never referenced
- **Solution**: Remove unused imports

#### 1.4 Unused Variables (80+ warnings)

- **Files**: Various files across codebase
- **Issue**: Variables assigned but never used
- **Solution**: Remove assignments or prefix with underscore

### 2. React Hooks Dependencies (30+ warnings)

**Pattern**: Missing dependencies in useEffect/useCallback arrays **Common
files**: React components

#### 2.1 Missing Dependencies

- **Files**: `src/components/ChatInterface.jsx`, `src/App.jsx`
- **Issue**: Dependencies not included in effect arrays
- **Solution**: Add missing dependencies or use useCallback/useMemo

#### 2.2 Complex Expressions in Dependencies

- **Issue**: Complex objects/arrays in dependency arrays
- **Solution**: Extract to variables outside effect

### 3. Unused ESLint Directives (5+ warnings)

**Pattern**: eslint-disable comments that aren't needed

- **Solution**: Remove unused eslint-disable comments

## Prioritized Cleanup Strategy

### Phase 1: Critical Fixes (High Priority)

1. **React Hooks Dependencies** - Affects functionality
2. **Core Server Error Handling** - Improves maintainability
3. **Component Props** - Clean component interfaces

### Phase 2: Code Quality Improvements (Medium Priority)

1. **Unused Variables** - General cleanup
2. **Unused Imports** - Reduce bundle size
3. **Test File Cleanup** - Better test organization

### Phase 3: Final Polish (Low Priority)

1. **ESLint Directives** - Remove unused directives
2. **Minor Variables** - Edge case cleanup

## Implementation Approach

### Automated Fixes

```bash
# Find all unused error variables
grep -r "catch (error" server/ --include="*.js"
grep -r "catch (e" server/ --include="*.js"
grep -r "catch (err" server/ --include="*.js"

# Find unused imports
npx eslint . --rule "no-unused-vars: error" | grep "no-unused-vars"
```

### Manual Fixes Required

- React hooks dependencies (need analysis)
- Component interface decisions
- Error handling strategy decisions

## Files Requiring Most Attention

### Server Files (150+ warnings total)

1. `server/routes/taskmaster.js` - 25+ warnings
2. `server/projects.js` - 15+ warnings
3. `server/index.js` - 10+ warnings
4. `server/routes/agent.js` - 10+ warnings
5. `server/routes/git.js` - 8+ warnings

### Frontend Files (80+ warnings total)

1. `src/components/ChatInterface.jsx` - 30+ warnings
2. `src/components/GitPanel.jsx` - 10+ warnings
3. `src/App.jsx` - 8+ warnings
4. `src/components/Settings.jsx` - 8+ warnings

### Test Files (30+ warnings total)

1. Various test files with unused imports
2. Mock utilities not being used

## Success Metrics

- Reduce warnings from 261 to < 50
- All critical React hooks issues resolved
- Server error handling cleaned up
- Bundle size reduced from unused imports

## Timeline Estimate

- **Phase 1**: 2-3 hours (critical fixes)
- **Phase 2**: 4-5 hours (quality improvements)
- **Phase 3**: 1-2 hours (final polish)
- **Total**: 7-10 hours

## Next Steps

1. Commit CI fix to unblock development
2. Create separate branches for each phase
3. Implement Phase 1 first
4. Test thoroughly after each phase
5. Update ESLint configuration to prevent future accumulation
