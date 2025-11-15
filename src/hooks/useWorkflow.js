/**
 * useWorkflow Hook
 *
 * State management for the AI-powered development workflow (Branch → Test → Commit → PR)
 * Handles branch creation, CI runs, commit generation, and PR creation with real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { authenticatedFetch } from '../utils/api';
import { useWebSocketContext } from '../contexts/WebSocketContext';

export function useWorkflow(projectName, projectPath) {
  // Workflow state
  const [currentBranch, setCurrentBranch] = useState(null);
  const [baseBranch, setBaseBranch] = useState('main');
  const [isLoadingBranch, setIsLoadingBranch] = useState(false);
  const [branchError, setBranchError] = useState(null);

  // CI Runner state
  const [ciRuns, setCiRuns] = useState([]); // Active runs
  const [runHistory, setRunHistory] = useState([]); // Historical runs
  const [currentRun, setCurrentRun] = useState(null); // Currently selected/active run
  const [ciOutput, setCiOutput] = useState({}); // Output by runId -> test type
  const [isLoadingCI, setIsLoadingCI] = useState(false);
  const [ciError, setCiError] = useState(null);

  // Commit state
  const [commitMessage, setCommitMessage] = useState('');
  const [isGeneratingCommit, setIsGeneratingCommit] = useState(false);
  const [commitError, setCommitError] = useState(null);
  const [stagedFiles, setStagedFiles] = useState([]);

  // PR state
  const [prTitle, setPrTitle] = useState('');
  const [prBody, setPrBody] = useState('');
  const [isCreatingPR, setIsCreatingPR] = useState(false);
  const [prError, setPrError] = useState(null);
  const [prUrl, setPrUrl] = useState(null);

  // Workflow step tracking
  const [currentStep, setCurrentStep] = useState('branch'); // 'branch', 'test', 'commit', 'pr', 'complete'
  const [completedSteps, setCompletedSteps] = useState([]);

  // WebSocket integration
  const { messages } = useWebSocketContext();
  const processedMessageIds = useRef(new Set());

  // Subscribe to WebSocket messages for CI updates
  useEffect(() => {
    if (messages.length === 0) return;

    const latestMessage = messages[messages.length - 1];
    const messageId = `${latestMessage.type}-${latestMessage.runId || ''}-${latestMessage.timestamp || Date.now()}`;

    // Avoid processing the same message twice
    if (processedMessageIds.current.has(messageId)) {
      return;
    }
    processedMessageIds.current.add(messageId);

    // Keep only last 100 message IDs to prevent memory leak
    if (processedMessageIds.current.size > 100) {
      const oldestIds = Array.from(processedMessageIds.current).slice(0, 50);
      oldestIds.forEach(id => processedMessageIds.current.delete(id));
    }

    // Handle CI-related WebSocket messages
    switch (latestMessage.type) {
      case 'ci-output':
        // Real-time CI output streaming
        if (latestMessage.runId) {
          setCiOutput(prev => ({
            ...prev,
            [latestMessage.runId]: {
              ...prev[latestMessage.runId],
              [latestMessage.testType]: [
                ...(prev[latestMessage.runId]?.[latestMessage.testType] || []),
                {
                  data: latestMessage.data,
                  timestamp: latestMessage.timestamp,
                },
              ],
            },
          }));
        }
        break;

      case 'ci-progress':
        // Progress updates
        if (latestMessage.runId && currentRun?.runId === latestMessage.runId) {
          setCurrentRun(prev => ({
            ...prev,
            progress: {
              current: latestMessage.current,
              total: latestMessage.total,
              currentTest: latestMessage.currentTest,
            },
          }));
        }
        break;

      case 'ci-complete':
        // CI run completed
        if (latestMessage.runId) {
          setCurrentRun(prev => {
            if (prev?.runId === latestMessage.runId) {
              return {
                ...prev,
                status: 'completed',
                passed: latestMessage.passed,
                results: latestMessage.results,
                duration: latestMessage.duration,
              };
            }
            return prev;
          });

          // Move to commit step if tests passed
          if (latestMessage.passed) {
            setCurrentStep('commit');
            setCompletedSteps(prev => [...new Set([...prev, 'test'])]);
          }
        }
        break;

      case 'ci-error':
        // CI run error
        if (latestMessage.runId) {
          setCurrentRun(prev => {
            if (prev?.runId === latestMessage.runId) {
              return {
                ...prev,
                status: 'failed',
                error: latestMessage.error,
              };
            }
            return prev;
          });
          setCiError(latestMessage.error);
        }
        break;

      default:
        break;
    }
  }, [messages, currentRun?.runId]);

  // Fetch current git branch
  const fetchCurrentBranch = useCallback(async () => {
    if (!projectName || !projectPath) return;

    try {
      const response = await authenticatedFetch(
        `/api/workflow/current-branch?project=${encodeURIComponent(projectName)}`
      );

      if (response.ok) {
        const data = await response.json();
        setCurrentBranch(data.branch);
      }
    } catch (error) {
      console.error('Error fetching current branch:', error);
    }
  }, [projectName, projectPath]);

  // Create a new feature branch
  const createBranch = useCallback(
    async (branchName, base = 'main') => {
      if (!projectName || !branchName) return { success: false, error: 'Missing parameters' };

      setIsLoadingBranch(true);
      setBranchError(null);

      try {
        const response = await authenticatedFetch('/api/workflow/create-feature-branch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: projectName,
            branchName,
            baseBranch: base,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setCurrentBranch(branchName);
          setBaseBranch(base);
          setCurrentStep('test');
          setCompletedSteps(prev => [...new Set([...prev, 'branch'])]);
          return { success: true, data };
        } else {
          setBranchError(data.error || 'Failed to create branch');
          return { success: false, error: data.error };
        }
      } catch (error) {
        setBranchError(error.message);
        return { success: false, error: error.message };
      } finally {
        setIsLoadingBranch(false);
      }
    },
    [projectName]
  );

  // Start CI test run
  const startCIRun = useCallback(
    async (tests = null) => {
      if (!projectName) return { success: false, error: 'Missing project name' };

      setIsLoadingCI(true);
      setCiError(null);

      try {
        const endpoint = tests ? '/api/ci/run-single' : '/api/ci/run';
        const body = tests ? { project: projectName, test: tests } : { project: projectName };

        const response = await authenticatedFetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();

        if (response.ok) {
          setCurrentRun({
            runId: data.runId,
            status: data.status,
            startedAt: data.startedAt,
            tests: data.tests || [tests],
            progress: { current: 0, total: data.tests?.length || 1 },
          });

          // Add to active runs
          setCiRuns(prev => [data, ...prev]);

          return { success: true, data };
        } else {
          setCiError(data.error || 'Failed to start CI run');
          return { success: false, error: data.error };
        }
      } catch (error) {
        setCiError(error.message);
        return { success: false, error: error.message };
      } finally {
        setIsLoadingCI(false);
      }
    },
    [projectName]
  );

  // Get CI run status
  const getCIStatus = useCallback(async runId => {
    if (!runId) return { success: false, error: 'Missing run ID' };

    try {
      const response = await authenticatedFetch(`/api/ci/status/${runId}`);
      const data = await response.json();

      if (response.ok) {
        // Update current run if it matches
        setCurrentRun(prev => {
          if (prev?.runId === runId) {
            return { ...prev, ...data };
          }
          return prev;
        });

        return { success: true, data };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Cancel CI run
  const cancelCIRun = useCallback(async runId => {
    if (!runId) return { success: false, error: 'Missing run ID' };

    try {
      const response = await authenticatedFetch(`/api/ci/cancel/${runId}`, {
        method: 'POST',
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setCurrentRun(prev => {
          if (prev?.runId === runId) {
            return { ...prev, status: 'cancelled' };
          }
          return prev;
        });
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }, []);

  // Fetch CI history
  const fetchCIHistory = useCallback(
    async (limit = 10) => {
      if (!projectName) return;

      try {
        const response = await authenticatedFetch(
          `/api/ci/history?project=${encodeURIComponent(projectName)}&limit=${limit}`
        );

        if (response.ok) {
          const data = await response.json();
          setRunHistory(data.runs || []);
        }
      } catch (error) {
        console.error('Error fetching CI history:', error);
      }
    },
    [projectName]
  );

  // Fetch active CI runs
  const fetchActiveCIRuns = useCallback(async () => {
    if (!projectName) return;

    try {
      const response = await authenticatedFetch(
        `/api/ci/active?project=${encodeURIComponent(projectName)}`
      );

      if (response.ok) {
        const data = await response.json();
        setCiRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Error fetching active CI runs:', error);
    }
  }, [projectName]);

  // Generate commit message with AI
  const generateCommitMessage = useCallback(
    async (provider = 'claude') => {
      if (!projectName) return { success: false, error: 'Missing project name' };

      setIsGeneratingCommit(true);
      setCommitError(null);

      try {
        const response = await authenticatedFetch('/api/workflow/auto-commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: projectName,
            provider,
            dryRun: true, // Just generate message, don't commit yet
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setCommitMessage(data.message);
          setStagedFiles(data.stagedFiles || []);
          return { success: true, data };
        } else {
          setCommitError(data.error || 'Failed to generate commit message');
          return { success: false, error: data.error };
        }
      } catch (error) {
        setCommitError(error.message);
        return { success: false, error: error.message };
      } finally {
        setIsGeneratingCommit(false);
      }
    },
    [projectName]
  );

  // Commit changes
  const commitChanges = useCallback(
    async (message, files = null) => {
      if (!projectName || !message) {
        return { success: false, error: 'Missing parameters' };
      }

      setIsGeneratingCommit(true);
      setCommitError(null);

      try {
        const response = await authenticatedFetch('/api/workflow/commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: projectName,
            message,
            files,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setCurrentStep('pr');
          setCompletedSteps(prev => [...new Set([...prev, 'commit'])]);
          return { success: true, data };
        } else {
          setCommitError(data.error || 'Failed to commit');
          return { success: false, error: data.error };
        }
      } catch (error) {
        setCommitError(error.message);
        return { success: false, error: error.message };
      } finally {
        setIsGeneratingCommit(false);
      }
    },
    [projectName]
  );

  // Create pull request
  const createPullRequest = useCallback(
    async (title, body, base = 'main') => {
      if (!projectName || !title) {
        return { success: false, error: 'Missing parameters' };
      }

      setIsCreatingPR(true);
      setPrError(null);

      try {
        const response = await authenticatedFetch('/api/workflow/create-pr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project: projectName,
            title,
            body,
            baseBranch: base,
            head: currentBranch,
          }),
        });

        const data = await response.json();

        if (response.ok && data.success) {
          setPrUrl(data.url);
          setCurrentStep('complete');
          setCompletedSteps(prev => [...new Set([...prev, 'pr'])]);
          return { success: true, data };
        } else {
          setPrError(data.error || 'Failed to create PR');
          return { success: false, error: data.error };
        }
      } catch (error) {
        setPrError(error.message);
        return { success: false, error: error.message };
      } finally {
        setIsCreatingPR(false);
      }
    },
    [projectName, currentBranch]
  );

  // Reset workflow to start over
  const resetWorkflow = useCallback(() => {
    setCurrentStep('branch');
    setCompletedSteps([]);
    setCurrentRun(null);
    setCiOutput({});
    setCommitMessage('');
    setStagedFiles([]);
    setPrTitle('');
    setPrBody('');
    setPrUrl(null);
    setBranchError(null);
    setCiError(null);
    setCommitError(null);
    setPrError(null);
  }, []);

  // Initialize: Fetch current branch on mount
  useEffect(() => {
    fetchCurrentBranch();
  }, [fetchCurrentBranch]);

  return {
    // Branch state
    currentBranch,
    baseBranch,
    isLoadingBranch,
    branchError,
    createBranch,
    fetchCurrentBranch,

    // CI state
    ciRuns,
    runHistory,
    currentRun,
    ciOutput,
    isLoadingCI,
    ciError,
    startCIRun,
    getCIStatus,
    cancelCIRun,
    fetchCIHistory,
    fetchActiveCIRuns,

    // Commit state
    commitMessage,
    stagedFiles,
    isGeneratingCommit,
    commitError,
    generateCommitMessage,
    commitChanges,
    setCommitMessage,

    // PR state
    prTitle,
    prBody,
    isCreatingPR,
    prError,
    prUrl,
    createPullRequest,
    setPrTitle,
    setPrBody,

    // Workflow control
    currentStep,
    completedSteps,
    setCurrentStep,
    resetWorkflow,
  };
}
