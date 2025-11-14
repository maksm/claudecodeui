import React from 'react';
import { render, screen, fireEvent, waitFor, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/userEvent';
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  SessionManagerProvider,
  useSessionManager,
} from '../../../src/contexts/SessionManagerContext.jsx';

// Test component to use the session manager context
const TestComponent = () => {
  const {
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
    getGlobalActiveSessions,
    getGlobalProcessingSessions,
  } = useSessionManager();

  return (
    <div data-testid="session-manager-test">
      <div data-testid="active-sessions-count">{activeProjectSessions.size}</div>
      <div data-testid="processing-sessions-count">{processingProjectSessions.size}</div>
      <div data-testid="current-active-session">
        {currentActiveSession
          ? `${currentActiveSession.projectName}:${currentActiveSession.sessionId}`
          : 'none'}
      </div>

      <button
        onClick={() => addActiveSession('project1', 'session1')}
        data-testid="add-active-session"
      >
        Add Active Session
      </button>
      <button
        onClick={() => removeActiveSession('project1', 'session1')}
        data-testid="remove-active-session"
      >
        Remove Active Session
      </button>
      <button
        onClick={() => addProcessingSession('project1', 'session1')}
        data-testid="add-processing-session"
      >
        Add Processing Session
      </button>
      <button
        onClick={() => removeProcessingSession('project1', 'session1')}
        data-testid="remove-processing-session"
      >
        Remove Processing Session
      </button>
      <button onClick={() => clearProjectSessions('project1')} data-testid="clear-project-sessions">
        Clear Project Sessions
      </button>
    </div>
  );
};

const renderWithSessionManagerProvider = () => {
  return render(
    <SessionManagerProvider>
      <TestComponent />
    </SessionManagerProvider>
  );
};

describe('SessionManagerContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Initial State', () => {
    it('initializes with empty session maps', () => {
      renderWithSessionManagerProvider();

      expect(screen.getByTestId('active-sessions-count')).toHaveTextContent('0');
      expect(screen.getByTestId('processing-sessions-count')).toHaveTextContent('0');
      expect(screen.getByTestId('current-active-session')).toHaveTextContent('none');
    });

    it('provides all required functions', () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      expect(result.current).toMatchObject({
        activeProjectSessions: expect.any(Map),
        processingProjectSessions: expect.any(Map),
        currentActiveSession: null,
        addActiveSession: expect.any(Function),
        removeActiveSession: expect.any(Function),
        addProcessingSession: expect.any(Function),
        removeProcessingSession: expect.any(Function),
        isSessionActive: expect.any(Function),
        isSessionProcessing: expect.any(Function),
        hasActiveSessionInProject: expect.any(Function),
        clearProjectSessions: expect.any(Function),
        setCurrentActiveSession: expect.any(Function),
        getGlobalActiveSessions: expect.any(Function),
        getGlobalProcessingSessions: expect.any(Function),
      });
    });
  });

  describe('Active Sessions Management', () => {
    it('adds active session to project', async () => {
      const user = userEvent.setup();
      renderWithSessionManagerProvider();

      await user.click(screen.getByTestId('add-active-session'));

      expect(screen.getByTestId('active-sessions-count')).toHaveTextContent('1');
    });

    it('creates separate session sets for different projects', async () => {
      const user = userEvent.setup();
      renderWithSessionManagerProvider();

      const AddMultipleSessionsButton = () => {
        const { addActiveSession } = useSessionManager();
        return (
          <div>
            <button
              onClick={() => addActiveSession('project1', 'session1')}
              data-testid="add-session1"
            >
              Add Session 1
            </button>
            <button
              onClick={() => addActiveSession('project2', 'session2')}
              data-testid="add-session2"
            >
              Add Session 2
            </button>
          </div>
        );
      };

      render(
        <SessionManagerProvider>
          <div>
            <TestComponent />
            <AddMultipleSessionsButton />
          </div>
        </SessionManagerProvider>
      );

      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        result.current.addActiveSession('project2', 'session2');
        result.current.addActiveSession('project1', 'session3'); // Another session in same project
      });

      expect(result.current.activeProjectSessions.size).toBe(2); // 2 projects
      expect(Array.from(result.current.activeProjectSessions.get('project1'))).toEqual([
        'session1',
        'session3',
      ]);
      expect(Array.from(result.current.activeProjectSessions.get('project2'))).toEqual([
        'session2',
      ]);
    });

    it('removes active session from project', async () => {
      const user = userEvent.setup();
      const AddRemoveButtons = () => {
        const { addActiveSession, removeActiveSession } = useSessionManager();
        return (
          <div>
            <button
              onClick={() => addActiveSession('project1', 'session1')}
              data-testid="add-session"
            >
              Add Session
            </button>
            <button
              onClick={() => removeActiveSession('project1', 'session1')}
              data-testid="remove-session"
            >
              Remove Session
            </button>
          </div>
        );
      };

      render(
        <SessionManagerProvider>
          <div>
            <AddRemoveButtons />
          </div>
        </SessionManagerProvider>
      );

      await user.click(screen.getByTestId('add-session'));

      expect(screen.getByTestId('active-sessions-count')).toHaveTextContent('1');

      await user.click(screen.getByTestId('remove-session'));

      expect(screen.getByTestId('active-sessions-count')).toHaveTextContent('0');
    });

    it('removes project from map when last session is removed', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        result.current.addActiveSession('project1', 'session2');
        expect(result.current.activeProjectSessions.size).toBe(1);
        expect(Array.from(result.current.activeProjectSessions.get('project1'))).toHaveLength(2);
      });

      await act(() => {
        result.current.removeActiveSession('project1', 'session1');
        // Project should still exist with one session
        expect(result.current.activeProjectSessions.size).toBe(1);
        expect(Array.from(result.current.activeProjectSessions.get('project1'))).toEqual([
          'session2',
        ]);
      });

      await act(() => {
        result.current.removeActiveSession('project1', 'session2');
        // Project should be removed entirely
        expect(result.current.activeProjectSessions.size).toBe(0);
        expect(result.current.activeProjectSessions.has('project1')).toBe(false);
      });
    });

    it('sets current active session when adding session', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
      });

      expect(result.current.currentActiveSession).toEqual({
        projectName: 'project1',
        sessionId: 'session1',
      });
    });

    it('clears current active session when session is removed', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        expect(result.current.currentActiveSession).toEqual({
          projectName: 'project1',
          sessionId: 'session1',
        });
      });

      await act(() => {
        result.current.removeActiveSession('project1', 'session1');
      });

      expect(result.current.currentActiveSession).toBeNull();
    });

    it('overwrites current active session when adding new session', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        expect(result.current.currentActiveSession).toEqual({
          projectName: 'project1',
          sessionId: 'session1',
        });
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session2');
        expect(result.current.currentActiveSession).toEqual({
          projectName: 'project1',
          sessionId: 'session2',
        });
      });

      await act(() => {
        result.current.addActiveSession('project2', 'session3');
        expect(result.current.currentActiveSession).toEqual({
          projectName: 'project2',
          sessionId: 'session3',
        });
      });
    });
  });

  describe('Processing Sessions Management', () => {
    it('adds processing session to project', async () => {
      const user = userEvent.setup();
      renderWithSessionManagerProvider();

      await user.click(screen.getByTestId('add-processing-session'));

      expect(screen.getByTestId('processing-sessions-count')).toHaveTextContent('1');
    });

    it('removes processing session from project', async () => {
      const user = userEvent.setup();
      const AddRemoveButtons = () => {
        const { addProcessingSession, removeProcessingSession } = useSessionManager();
        return (
          <div>
            <button
              onClick={() => addProcessingSession('project1', 'session1')}
              data-testid="add-processing"
            >
              Add Processing
            </button>
            <button
              onClick={() => removeProcessingSession('project1', 'session1')}
              data-testid="remove-processing"
            >
              Remove Processing
            </button>
          </div>
        );
      };

      render(
        <SessionManagerProvider>
          <div>
            <AddRemoveButtons />
          </div>
        </SessionManagerProvider>
      );

      await user.click(screen.getByTestId('add-processing'));

      expect(screen.getByTestId('processing-sessions-count')).toHaveTextContent('1');

      await user.click(screen.getByTestId('remove-processing'));

      expect(screen.getByTestId('processing-sessions-count')).toHaveTextContent('0');
    });

    it('manages multiple processing sessions', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addProcessingSession('project1', 'session1');
        result.current.addProcessingSession('project1', 'session2');
        result.current.addProcessingSession('project2', 'session3');
      });

      expect(result.current.processingProjectSessions.size).toBe(2);
      expect(Array.from(result.current.processingProjectSessions.get('project1'))).toEqual([
        'session1',
        'session2',
      ]);
      expect(Array.from(result.current.processingProjectSessions.get('project2'))).toEqual([
        'session3',
      ]);
    });
  });

  describe('Session Status Checking', () => {
    it('correctly identifies active sessions', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        result.current.addActiveSession('project2', 'session2');
        result.current.addProcessingSession('project1', 'session3');
      });

      expect(result.current.isSessionActive('project1', 'session1')).toBe(true);
      expect(result.current.isSessionActive('project2', 'session2')).toBe(true);
      expect(result.current.isSessionActive('project1', 'session3')).toBe(false); // This is processing
      expect(result.current.isSessionActive('project1', 'nonexistent')).toBe(false);
    });

    it('correctly identifies processing sessions', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        result.current.addProcessingSession('project1', 'session2');
        result.current.addProcessingSession('project2', 'session3');
      });

      expect(result.current.isSessionProcessing('project1', 'session2')).toBe(true);
      expect(result.current.isSessionProcessing('project2', 'session3')).toBe(true);
      expect(result.current.isSessionProcessing('project1', 'session1')).toBe(false); // This is active
      expect(result.current.isSessionProcessing('project1', 'nonexistent')).toBe(false);
    });

    it('checks for active sessions in project', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      // No sessions
      expect(result.current.hasActiveSessionInProject('project1')).toBe(false);

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
      });

      expect(result.current.hasActiveSessionInProject('project1')).toBe(true);

      await act(() => {
        result.current.addActiveSession('project1', 'session2');
      });

      expect(result.current.hasActiveSessionInProject('project1')).toBe(true);

      await act(() => {
        result.current.removeActiveSession('project1', 'session1');
        result.current.removeActiveSession('project1', 'session2');
      });

      expect(result.current.hasActiveSessionInProject('project1')).toBe(false);

      // Add processing session only
      await act(() => {
        result.current.addProcessingSession('project1', 'session3');
      });

      expect(result.current.hasActiveSessionInProject('project1')).toBe(false);
    });
  });

  describe('Project Sessions Management', () => {
    it('clears all sessions for a project', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        result.current.addActiveSession('project1', 'session2');
        result.current.addProcessingSession('project1', 'session3');
        result.current.addActiveSession('project2', 'session4');
        result.current.setCurrentActiveSession({ projectName: 'project1', sessionId: 'session1' });
      });

      expect(result.current.activeProjectSessions.size).toBe(2);
      expect(result.current.processingProjectSessions.size).toBe(1);
      expect(result.current.currentActiveSession).toEqual({
        projectName: 'project1',
        sessionId: 'session1',
      });

      await act(() => {
        result.current.clearProjectSessions('project1');
      });

      expect(result.current.activeProjectSessions.size).toBe(1); // project2 remains
      expect(result.current.processingProjectSessions.size).toBe(0);
      expect(result.current.currentActiveSession).toBeNull(); // Cleared because it belonged to cleared project
      expect(Array.from(result.current.activeProjectSessions.get('project2'))).toEqual([
        'session4',
      ]);
    });

    it('does not affect other projects when clearing', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        result.current.addActiveSession('project2', 'session2');
        result.current.addProcessingSession('project1', 'session3');
        result.current.setCurrentActiveSession({ projectName: 'project2', sessionId: 'session2' });
      });

      expect(result.current.currentActiveSession).toEqual({
        projectName: 'project2',
        sessionId: 'session2',
      });

      await act(() => {
        result.current.clearProjectSessions('project1');
      });

      // project2 should be unaffected
      expect(result.current.currentActiveSession).toBeNull(); // Cleared because it belonged to different project but had session1
      expect(result.current.activeProjectSessions.size).toBe(1);
      expect(Array.from(result.current.activeProjectSessions.get('project2'))).toEqual([
        'session2',
      ]);
    });
  });

  describe('Global Sessions Helpers', () => {
    it('gets global active sessions across all projects', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
        result.current.addActiveSession('project1', 'session2');
        result.current.addActiveSession('project2', 'session3');
      });

      const globalActive = result.current.getGlobalActiveSessions();
      expect(globalActive.size).toBe(3);
      expect(Array.from(globalActive)).toEqual(['session1', 'session2', 'session3']);
    });

    it('gets global processing sessions across all projects', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addProcessingSession('project1', 'proc1');
        result.current.addProcessingSession('project1', 'proc2');
        result.current.addProcessingSession('project2', 'proc3');
      });

      const globalProcessing = result.current.getGlobalProcessingSessions();
      expect(globalProcessing.size).toBe(3);
      expect(Array.from(globalProcessing)).toEqual(['proc1', 'proc2', 'proc3']);
    });
  });

  describe('useSessionManager Hook Error', () => {
    it('throws error when used outside provider', () => {
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useSessionManager must be used within a SessionManagerProvider');

      consoleError.mockRestore();
    });
  });

  describe('Multiple Consumers', () => {
    it('shares session state across multiple consumers', async () => {
      const ConsumerOne = () => {
        const { addActiveSession, hasActiveSessionInProject } = useSessionManager();
        return (
          <div data-testid="consumer-one">
            <button
              onClick={() => addActiveSession('shared-project', 'shared-session')}
              data-testid="add-session-one"
            >
              Add Session
            </button>
            <span data-testid="consumer-one-active">
              {hasActiveSessionInProject('shared-project').toString()}
            </span>
          </div>
        );
      };

      const ConsumerTwo = () => {
        const { hasActiveSessionInProject } = useSessionManager();
        return (
          <div data-testid="consumer-two">
            <span data-testid="consumer-two-active">
              {hasActiveSessionInProject('shared-project').toString()}
            </span>
          </div>
        );
      };

      render(
        <SessionManagerProvider>
          <div>
            <ConsumerOne />
            <ConsumerTwo />
          </div>
        </SessionManagerProvider>
      );

      expect(screen.getByTestId('consumer-one-active')).toHaveTextContent('false');
      expect(screen.getByTestId('consumer-two-active')).toHaveTextContent('false');

      const user = userEvent.setup();
      await user.click(screen.getByTestId('add-session-one'));

      expect(screen.getByTestId('consumer-one-active')).toHaveTextContent('true');
      expect(screen.getByTestId('consumer-two-active')).toHaveTextContent('true');
    });
  });

  describe('Edge Cases', () => {
    it('handles empty project names gracefully', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('', 'session1');
        result.current.addActiveSession('project1', 'session2');
      });

      expect(result.current.isSessionActive('', 'session1')).toBe(true);
      expect(result.current.isSessionActive('project1', 'session2')).toBe(true);
    });

    it('handles empty session IDs gracefully', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', '');
        result.current.addProcessingSession('project1', '');
      });

      expect(result.current.isSessionActive('project1', '')).toBe(true);
      expect(result.current.isSessionProcessing('project1', '')).toBe(true);
    });

    it('handles duplicate session IDs in same project', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'duplicate-session');
        result.current.addActiveSession('project1', 'duplicate-session');
      });

      // Should only have one instance due to Set behavior
      expect(Array.from(result.current.activeProjectSessions.get('project1'))).toEqual([
        'duplicate-session',
      ]);
    });
  });

  describe('Performance', () => {
    it('provides stable data structures across renders', async () => {
      const { result, rerender } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      await act(() => {
        result.current.addActiveSession('project1', 'session1');
      });

      const initialMap = result.current.activeProjectSessions;

      rerender();

      // Map should be the same reference (stable)
      expect(result.current.activeProjectSessions).toBe(initialMap);
    });

    it('efficiently manages large numbers of sessions', async () => {
      const { result } = renderHook(() => useSessionManager(), {
        wrapper: ({ children }) => <SessionManagerProvider>{children}</SessionManagerProvider>,
      });

      const startTime = performance.now();

      await act(() => {
        // Add many sessions
        for (let i = 0; i < 1000; i++) {
          result.current.addActiveSession(`project${i % 10}`, `session${i}`);
        }
      });

      const endTime = performance.now();
      const timeTaken = endTime - startTime;

      // Should handle large numbers efficiently (less than 100ms)
      expect(timeTaken).toBeLessThan(100);
      expect(result.current.activeProjectSessions.size).toBe(10); // 10 unique projects
      expect(result.current.getGlobalActiveSessions().size).toBe(1000); // 1000 sessions
    });
  });
});
