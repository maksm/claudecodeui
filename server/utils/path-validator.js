/**
 * Path Validation Utilities
 *
 * Provides security-focused path validation to prevent unauthorized access
 * to system directories, path traversal attacks, and other file system exploits.
 */

import path from 'path';
import { promises as fs } from 'fs';

// System directories that should never be used as workspaces
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

// Safe subdirectories within otherwise forbidden paths
const SAFE_EXCEPTIONS = ['/var/tmp', '/var/folders'];

// Sensitive file patterns to detect
const SENSITIVE_PATTERNS = [
  /\.env$/i,
  /id_rsa$/i,
  /\.ssh\//i,
  /\.aws\//i,
  /credentials$/i,
  /\.pgpass$/i,
  /secret/i,
  /password/i,
  /\.pem$/i,
  /\.key$/i,
];

/**
 * Validates a path to ensure it's safe for workspace operations
 * @param {string} requestedPath - Path to validate
 * @param {string|null} workspaceRoot - Optional workspace root to restrict paths to
 * @returns {Promise<Object>} Validation result with {valid, error?, resolvedPath?}
 */
export async function validatePath(requestedPath, workspaceRoot = null) {
  if (!requestedPath || typeof requestedPath !== 'string') {
    return {
      valid: false,
      error: 'Path must be a non-empty string',
    };
  }

  // Normalize and resolve path
  const normalizedPath = path.normalize(path.resolve(requestedPath));

  // Check against forbidden paths
  for (const forbidden of FORBIDDEN_PATHS) {
    if (normalizedPath === forbidden || normalizedPath.startsWith(forbidden + path.sep)) {
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
    if (!normalizedPath.startsWith(resolvedRoot + path.sep) && normalizedPath !== resolvedRoot) {
      return {
        valid: false,
        error: `Path must be within workspace root: ${workspaceRoot}`,
      };
    }
  }

  // Check for path traversal attempts
  const parts = normalizedPath.split(path.sep);
  if (parts.includes('..')) {
    return {
      valid: false,
      error: 'Path traversal detected (..) - this is not allowed',
    };
  }

  // Validate symlinks - ensure they don't point outside allowed directories
  try {
    const stat = await fs.lstat(normalizedPath);
    if (stat.isSymbolicLink()) {
      const realPath = await fs.realpath(normalizedPath);
      // Re-validate the real path
      return validatePath(realPath, workspaceRoot);
    }
  } catch (error) {
    // Path doesn't exist yet - that's okay for creation operations
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

/**
 * Validates file path length to prevent buffer overflow attacks
 * @param {string} pathString - Path to validate
 * @param {number} maxLength - Maximum allowed path length (default: 4096)
 * @returns {Object} Validation result
 */
export function validatePathLength(pathString, maxLength = 4096) {
  if (!pathString) {
    return {
      valid: false,
      error: 'Path cannot be empty',
    };
  }

  if (pathString.length > maxLength) {
    return {
      valid: false,
      error: `Path length ${pathString.length} exceeds maximum ${maxLength}`,
    };
  }

  return { valid: true };
}

/**
 * Checks if a file path contains sensitive patterns
 * @param {string} filePath - Path to check
 * @returns {Object} Check result with {isSensitive, pattern?}
 */
export function checkSensitiveFile(filePath) {
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(filePath)) {
      return {
        isSensitive: true,
        pattern: pattern.toString(),
      };
    }
  }

  return { isSensitive: false };
}

/**
 * Validates file access permissions
 * @param {string} filePath - Path to check
 * @returns {Promise<boolean>} True if file is accessible
 */
export async function validateFileAccess(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Comprehensive path validation with all security checks
 * @param {string} requestedPath - Path to validate
 * @param {Object} options - Validation options
 * @param {string} options.workspaceRoot - Workspace root restriction
 * @param {number} options.maxLength - Maximum path length
 * @param {boolean} options.checkSensitive - Check for sensitive patterns
 * @returns {Promise<Object>} Comprehensive validation result
 */
export async function validatePathComprehensive(requestedPath, options = {}) {
  const { workspaceRoot = null, maxLength = 4096, checkSensitive = false } = options;

  // Length validation
  const lengthResult = validatePathLength(requestedPath, maxLength);
  if (!lengthResult.valid) {
    return lengthResult;
  }

  // Path validation
  const pathResult = await validatePath(requestedPath, workspaceRoot);
  if (!pathResult.valid) {
    return pathResult;
  }

  // Sensitive file check (optional)
  if (checkSensitive) {
    const sensitiveCheck = checkSensitiveFile(requestedPath);
    if (sensitiveCheck.isSensitive) {
      return {
        valid: false,
        error: `Path contains sensitive pattern: ${sensitiveCheck.pattern}`,
        warning: 'This file may contain credentials or secrets',
      };
    }
  }

  return {
    valid: true,
    resolvedPath: pathResult.resolvedPath,
  };
}

export default {
  validatePath,
  validatePathLength,
  checkSensitiveFile,
  validateFileAccess,
  validatePathComprehensive,
};
