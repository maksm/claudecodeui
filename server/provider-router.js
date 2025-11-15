/**
 * Provider Router
 *
 * Central routing module for managing multiple AI providers (Claude, Cursor).
 * Handles provider selection, session routing, and unified interface for provider operations.
 *
 * Key features:
 * - Dynamic provider selection with runtime switching
 * - Session-to-provider mapping
 * - Unified API for all provider operations
 * - Default provider configuration
 *
 * Note: Zai is handled as a backend option within Claude SDK, not a separate provider.
 */

import { queryClaudeSDK, abortClaudeSDKSession, isClaudeSDKSessionActive } from './claude-sdk.js';
import { spawnCursor, abortCursorSession, isCursorSessionActive } from './cursor-cli.js';

// Available providers
export const PROVIDERS = {
  CLAUDE: 'claude',
  CURSOR: 'cursor',
};

// Session to provider mapping with TTL support
const sessionProviderMap = new Map();
const sessionTimestamps = new Map();

// Configuration
const SESSION_TTL = parseInt(process.env.SESSION_TTL) || 60 * 60 * 1000; // 1 hour default
const MAX_SESSION_MAP_SIZE = parseInt(process.env.MAX_SESSION_MAP_SIZE) || 1000;

// Default provider (can be configured via environment variable)
let defaultProvider = process.env.DEFAULT_PROVIDER || PROVIDERS.CLAUDE;

// Cleanup interval for stale sessions
const cleanupInterval = setInterval(() => {
  cleanupStaleSessions();
}, 10 * 60 * 1000); // Run every 10 minutes

// Ensure cleanup runs on process exit
process.on('SIGINT', () => {
  clearInterval(cleanupInterval);
  process.exit();
});

process.on('SIGTERM', () => {
  clearInterval(cleanupInterval);
  process.exit();
});

/**
 * Sets the default provider
 * @param {string} provider - Provider name (claude, cursor, zai)
 */
export function setDefaultProvider(provider) {
  if (!Object.values(PROVIDERS).includes(provider)) {
    throw new Error(
      `Invalid provider: ${provider}. Must be one of: ${Object.values(PROVIDERS).join(', ')}`
    );
  }
  defaultProvider = provider;
  console.log(`✅ Default provider set to: ${provider}`);
}

/**
 * Gets the current default provider
 * @returns {string} Default provider name
 */
export function getDefaultProvider() {
  return defaultProvider;
}

/**
 * Gets all available providers
 * @returns {Object} Object with provider names
 */
export function getAvailableProviders() {
  return {
    providers: Object.values(PROVIDERS),
    default: defaultProvider,
  };
}

/**
 * Maps a session to a provider with TTL and size limit enforcement
 * @param {string} sessionId - Session identifier
 * @param {string} provider - Provider name
 */
function mapSessionToProvider(sessionId, provider) {
  if (!sessionId) return;

  // Enforce maximum size limit with LRU eviction
  if (sessionProviderMap.size >= MAX_SESSION_MAP_SIZE) {
    // Find and remove oldest session
    const oldestSession = Array.from(sessionTimestamps.entries()).sort((a, b) => a[1] - b[1])[0]?.[
      0
    ];

    if (oldestSession) {
      console.warn(
        `⚠️  [Provider Router] Session map at capacity (${MAX_SESSION_MAP_SIZE}), evicting oldest: ${oldestSession}`
      );
      unmapSession(oldestSession);
    }
  }

  sessionProviderMap.set(sessionId, provider);
  sessionTimestamps.set(sessionId, Date.now());
  console.log(`📍 Mapped session ${sessionId} to provider: ${provider}`);
}

/**
 * Gets the provider for a session
 * @param {string} sessionId - Session identifier
 * @returns {string} Provider name
 */
function getProviderForSession(sessionId) {
  if (!sessionId) {
    return defaultProvider;
  }
  return sessionProviderMap.get(sessionId) || defaultProvider;
}

/**
 * Removes session-to-provider mapping
 * @param {string} sessionId - Session identifier
 */
function unmapSession(sessionId) {
  if (!sessionId) return;
  sessionProviderMap.delete(sessionId);
  sessionTimestamps.delete(sessionId);
  console.log(`🗑️ Unmapped session ${sessionId}`);
}

/**
 * Cleans up stale sessions that have exceeded TTL
 */
function cleanupStaleSessions() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [sessionId, timestamp] of sessionTimestamps.entries()) {
    if (now - timestamp > SESSION_TTL) {
      console.log(`🧹 [Provider Router] Cleaning up stale session: ${sessionId}`);
      unmapSession(sessionId);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(
      `🧹 [Provider Router] Cleaned up ${cleanedCount} stale sessions. ` +
        `Active sessions: ${sessionProviderMap.size}`
    );
  }
}

/**
 * Routes a query to the appropriate provider
 * @param {string} command - User prompt/command
 * @param {Object} options - Query options
 * @param {Object} ws - WebSocket connection
 * @param {string} provider - Provider name (optional, uses default if not specified)
 * @returns {Promise<void>}
 */
export async function routeQuery(command, options = {}, ws, provider = null) {
  // Determine which provider to use
  let selectedProvider = provider || getProviderForSession(options.sessionId) || defaultProvider;

  // Validate provider
  if (!Object.values(PROVIDERS).includes(selectedProvider)) {
    console.error(
      `Invalid provider: ${selectedProvider}, falling back to default: ${defaultProvider}`
    );
    selectedProvider = defaultProvider;
  }

  console.log(
    `🔀 Routing query to provider: ${selectedProvider} (session: ${options.sessionId || 'new'})`
  );

  // Map session to provider for future requests
  if (options.sessionId) {
    mapSessionToProvider(options.sessionId, selectedProvider);
  }

  // Route to appropriate provider
  try {
    switch (selectedProvider) {
      case PROVIDERS.CLAUDE:
        await queryClaudeSDK(command, options, ws);
        break;

      case PROVIDERS.CURSOR:
        await spawnCursor(command, options, ws);
        break;

      default:
        throw new Error(`Unknown provider: ${selectedProvider}`);
    }

    // Clean up session mapping after completion
    if (options.sessionId) {
      unmapSession(options.sessionId);
    }
  } catch (error) {
    console.error(`Error in provider ${selectedProvider}:`, error);
    // Clean up session mapping on error
    if (options.sessionId) {
      unmapSession(options.sessionId);
    }
    throw error;
  }
}

/**
 * Aborts a session on the appropriate provider
 * @param {string} sessionId - Session identifier
 * @returns {Promise<boolean>} True if session was aborted
 */
export async function abortSession(sessionId) {
  if (!sessionId) {
    console.error('Cannot abort session: sessionId is required');
    return false;
  }

  const provider = getProviderForSession(sessionId);
  console.log(`🛑 Aborting session ${sessionId} on provider: ${provider}`);

  let aborted = false;

  try {
    switch (provider) {
      case PROVIDERS.CLAUDE:
        aborted = await abortClaudeSDKSession(sessionId);
        break;

      case PROVIDERS.CURSOR:
        aborted = await abortCursorSession(sessionId);
        break;

      default:
        console.error(`Unknown provider for session ${sessionId}: ${provider}`);
        return false;
    }

    // Clean up session mapping
    if (aborted) {
      unmapSession(sessionId);
    }

    return aborted;
  } catch (error) {
    console.error(`Error aborting session ${sessionId}:`, error);
    return false;
  }
}

/**
 * Checks if a session is active on any provider
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if session is active
 */
export function isSessionActive(sessionId) {
  if (!sessionId) return false;

  const provider = getProviderForSession(sessionId);

  switch (provider) {
    case PROVIDERS.CLAUDE:
      return isClaudeSDKSessionActive(sessionId);

    case PROVIDERS.CURSOR:
      return isCursorSessionActive(sessionId);

    default:
      return false;
  }
}

/**
 * Gets provider information for a session
 * @param {string} sessionId - Session identifier
 * @returns {Object} Provider information
 */
export function getSessionProviderInfo(sessionId) {
  const provider = getProviderForSession(sessionId);
  const isActive = isSessionActive(sessionId);

  return {
    provider,
    isActive,
    defaultProvider,
  };
}

/**
 * Changes provider for a new session
 * This is used when switching providers mid-conversation (for new sessions only)
 * @param {string} newProvider - New provider name
 * @returns {boolean} True if provider was changed
 */
export function switchProvider(newProvider) {
  if (!Object.values(PROVIDERS).includes(newProvider)) {
    console.error(`Invalid provider: ${newProvider}`);
    return false;
  }

  console.log(`🔄 Switching default provider from ${defaultProvider} to ${newProvider}`);
  setDefaultProvider(newProvider);
  return true;
}

/**
 * Gets statistics about active sessions per provider
 * @returns {Object} Statistics object
 */
export function getProviderStats() {
  const stats = {
    totalSessions: sessionProviderMap.size,
    byProvider: {
      [PROVIDERS.CLAUDE]: 0,
      [PROVIDERS.CURSOR]: 0,
    },
    defaultProvider,
  };

  for (const provider of sessionProviderMap.values()) {
    if (stats.byProvider[provider] !== undefined) {
      stats.byProvider[provider]++;
    }
  }

  return stats;
}

export default {
  PROVIDERS,
  routeQuery,
  abortSession,
  isSessionActive,
  getSessionProviderInfo,
  setDefaultProvider,
  getDefaultProvider,
  getAvailableProviders,
  switchProvider,
  getProviderStats,
};
