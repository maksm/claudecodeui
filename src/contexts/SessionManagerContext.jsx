import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

/**
 * SessionManagerContext - Provides session-isolated state management
 *
 * This context replaces global session state with per-project session isolation
 * to prevent cross-session interference and enable proper concurrent sessions.
 */
const SessionManagerContext = createContext({
  // Per-project active sessions
  activeProjectSessions: new Map(), // Map<projectName, Set<sessionId>>
  // Per-project processing sessions
  processingProjectSessions: new Map(), // Map<projectName, Set<sessionId>>
  // Track current active session globally (for UI state)
  currentActiveSession: null,
  // Actions
  addActiveSession: () => {},
  removeActiveSession: () => {},
  addProcessingSession: () => {},
  removeProcessingSession: () => {},
  isSessionActive: () => {},
  isSessionProcessing: () => {},
  hasActiveSessionInProject: () => {},
  clearProjectSessions: () => {},
  setCurrentActiveSession: () => {},
});

export const useSessionManager = () => {
  const context = useContext(SessionManagerContext);
  if (!context) {
    throw new Error('useSessionManager must be used within a SessionManagerProvider');
  }
  return context;
};

export const SessionManagerProvider = ({ children }) => {
  const [activeProjectSessions, setActiveProjectSessions] = useState(new Map());
  const [processingProjectSessions, setProcessingProjectSessions] = useState(new Map());
  const [currentActiveSession, setCurrentActiveSession] = useState(null);

  // Add an active session to a specific project
  const addActiveSession = useCallback((projectName, sessionId) => {
    setActiveProjectSessions(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(projectName)) {
        newMap.set(projectName, new Set());
      }
      newMap.get(projectName).add(sessionId);
      console.log(`[SessionManager] Added active session ${sessionId} to project ${projectName}`);
      return newMap;
    });
    setCurrentActiveSession({ projectName, sessionId });
  }, []);

  // Remove an active session from a specific project
  const removeActiveSession = useCallback(
    (projectName, sessionId) => {
      setActiveProjectSessions(prev => {
        const newMap = new Map(prev);
        const projectSessions = newMap.get(projectName);
        if (projectSessions) {
          projectSessions.delete(sessionId);
          if (projectSessions.size === 0) {
            newMap.delete(projectName);
          }
        }
        console.log(
          `[SessionManager] Removed active session ${sessionId} from project ${projectName}`
        );
        return newMap;
      });
      // Clear current active session if it matches
      if (
        currentActiveSession?.projectName === projectName &&
        currentActiveSession?.sessionId === sessionId
      ) {
        setCurrentActiveSession(null);
      }
    },
    [currentActiveSession]
  );

  // Add a processing session to a specific project
  const addProcessingSession = useCallback((projectName, sessionId) => {
    setProcessingProjectSessions(prev => {
      const newMap = new Map(prev);
      if (!newMap.has(projectName)) {
        newMap.set(projectName, new Set());
      }
      newMap.get(projectName).add(sessionId);
      console.log(
        `[SessionManager] Added processing session ${sessionId} to project ${projectName}`
      );
      return newMap;
    });
  }, []);

  // Remove a processing session from a specific project
  const removeProcessingSession = useCallback((projectName, sessionId) => {
    setProcessingProjectSessions(prev => {
      const newMap = new Map(prev);
      const projectSessions = newMap.get(projectName);
      if (projectSessions) {
        projectSessions.delete(sessionId);
        if (projectSessions.size === 0) {
          newMap.delete(projectName);
        }
      }
      console.log(
        `[SessionManager] Removed processing session ${sessionId} from project ${projectName}`
      );
      return newMap;
    });
  }, []);

  // Check if a specific session is active in its project
  const isSessionActive = useCallback(
    (projectName, sessionId) => {
      const projectSessions = activeProjectSessions.get(projectName);
      return projectSessions ? projectSessions.has(sessionId) : false;
    },
    [activeProjectSessions]
  );

  // Check if a specific session is processing in its project
  const isSessionProcessing = useCallback(
    (projectName, sessionId) => {
      const projectSessions = processingProjectSessions.get(projectName);
      return projectSessions ? projectSessions.has(sessionId) : false;
    },
    [processingProjectSessions]
  );

  // Check if any session is active in a specific project
  const hasActiveSessionInProject = useCallback(
    projectName => {
      const projectSessions = activeProjectSessions.get(projectName);
      return projectSessions ? projectSessions.size > 0 : false;
    },
    [activeProjectSessions]
  );

  // Clear all sessions for a specific project (useful for project deletion)
  const clearProjectSessions = useCallback(
    projectName => {
      setActiveProjectSessions(prev => {
        const newMap = new Map(prev);
        newMap.delete(projectName);
        console.log(`[SessionManager] Cleared all sessions for project ${projectName}`);
        return newMap;
      });
      setProcessingProjectSessions(prev => {
        const newMap = new Map(prev);
        newMap.delete(projectName);
        return newMap;
      });
      // Clear current active session if it's in this project
      if (currentActiveSession?.projectName === projectName) {
        setCurrentActiveSession(null);
      }
    },
    [currentActiveSession]
  );

  // Computed values for backward compatibility
  const value = useMemo(
    () => ({
      activeProjectSessions,
      processingProjectSessions,
      currentActiveSession,
      addActiveSession,
      removeActiveSession,
      addProcessingSession,
      removeProcessingSession,
      isSessionActive,
      isSessionProcessing,
      hasActiveSessionInProject,
      clearProjectSessions,
      setCurrentActiveSession,
      // Backward compatibility helpers
      getGlobalActiveSessions: () => {
        const allSessions = new Set();
        activeProjectSessions.forEach(sessions => {
          sessions.forEach(sessionId => allSessions.add(sessionId));
        });
        return allSessions;
      },
      getGlobalProcessingSessions: () => {
        const allSessions = new Set();
        processingProjectSessions.forEach(sessions => {
          sessions.forEach(sessionId => allSessions.add(sessionId));
        });
        return allSessions;
      },
    }),
    [
      activeProjectSessions,
      processingProjectSessions,
      currentActiveSession,
      addActiveSession,
      removeActiveSession,
      addProcessingSession,
      removeProcessingSession,
      isSessionActive,
      isSessionProcessing,
      hasActiveSessionInProject,
      clearProjectSessions,
    ]
  );

  return <SessionManagerContext.Provider value={value}>{children}</SessionManagerContext.Provider>;
};

export default SessionManagerContext;
