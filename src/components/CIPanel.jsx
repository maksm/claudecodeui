import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  PlayCircle,
  StopCircle,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Copy,
  MessageSquare,
  Loader2,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { authenticatedFetch } from '../utils/api';
import { useNotification } from '../contexts/NotificationContext';

function CIPanel({ selectedProject, onSendToChat }) {
  const { notifyCICompletion } = useNotification();
  const [workflows, setWorkflows] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  const [workflowDetails, setWorkflowDetails] = useState(null);
  const [runs, setRuns] = useState([]);
  const [activeRun, setActiveRun] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSteps, setSelectedSteps] = useState(new Set());
  const [expandedJobs, setExpandedJobs] = useState(new Set());
  const [runScope, setRunScope] = useState('all'); // 'all' or 'changes'
  const [changedFiles, setChangedFiles] = useState([]);
  const [isStepSelectorCollapsed, setIsStepSelectorCollapsed] = useState(false);
  const [previousRunStatus, setPreviousRunStatus] = useState(null);
  const pollIntervalRef = useRef(null);

  const totalExecutableSteps = useMemo(() => {
    if (!workflowDetails) return 0;
    return workflowDetails.jobs.reduce((acc, job) => acc + (job.executableSteps?.length || 0), 0);
  }, [workflowDetails]);

  const currentStepContext = useMemo(() => {
    if (!activeRun?.currentStep) {
      return null;
    }

    const context = {
      stepName: activeRun.currentStepName || null,
      jobName: activeRun.currentJobName || null,
    };

    if (context.stepName && context.jobName) {
      return context;
    }

    if (activeRun.jobs) {
      for (const job of activeRun.jobs) {
        const targetStep = job.steps?.find(step => step.id === activeRun.currentStep);
        if (targetStep) {
          return {
            stepName: context.stepName || targetStep.name,
            jobName: context.jobName || job.name,
          };
        }
      }
    }

    return {
      stepName: context.stepName || activeRun.currentStep,
      jobName: context.jobName || null,
    };
  }, [activeRun]);

  const currentStepLabel = currentStepContext?.stepName || activeRun?.currentStep || '';
  const currentJobLabel = currentStepContext?.jobName || '';
  const showLiveStepPanel = Boolean(activeRun?.currentStep);
  const liveStepOutput = activeRun?.currentStepOutput || '';

  // Fetch workflows on mount
  useEffect(() => {
    if (selectedProject) {
      fetchWorkflows();
      fetchRuns();
      fetchChangedFiles();
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [selectedProject]);

  // Poll for run updates when there's an active run
  useEffect(() => {
    if (activeRun && activeRun.status === 'running') {
      pollIntervalRef.current = setInterval(() => {
        fetchRunStatus(activeRun.id);
      }, 2000); // Poll every 2 seconds

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    } else if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
  }, [activeRun]);

  // Notify when CI run completes
  useEffect(() => {
    if (activeRun && activeRun.status && selectedWorkflow) {
      // Check if status changed from 'running' to a terminal state
      if (
        previousRunStatus === 'running' &&
        (activeRun.status === 'success' || activeRun.status === 'failed')
      ) {
        const success = activeRun.status === 'success';
        const workflowName = selectedWorkflow.name || selectedWorkflow.file;
        notifyCICompletion(workflowName, success);
      }
      setPreviousRunStatus(activeRun.status);
    }
  }, [activeRun, selectedWorkflow, previousRunStatus, notifyCICompletion]);

  const fetchChangedFiles = async () => {
    if (!selectedProject) return;

    try {
      const response = await authenticatedFetch(
        `/api/git/status?project=${encodeURIComponent(selectedProject.name)}`
      );
      const data = await response.json();

      if (!data.error) {
        const files = [
          ...(data.modified || []),
          ...(data.added || []),
          ...(data.deleted || []),
          ...(data.untracked || []),
        ];
        setChangedFiles(files);
      }
    } catch (error) {
      console.error('Error fetching changed files:', error);
    }
  };

  const fetchWorkflows = async () => {
    if (!selectedProject) return;

    setIsLoading(true);
    try {
      const response = await authenticatedFetch(
        `/api/ci/workflows?project=${encodeURIComponent(selectedProject.name)}`
      );
      const data = await response.json();

      if (data.error) {
        console.error('Error fetching workflows:', data.error);
      } else {
        setWorkflows(data.workflows || []);
        // Auto-select first workflow
        if (data.workflows && data.workflows.length > 0 && !selectedWorkflow) {
          selectWorkflow(data.workflows[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching workflows:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const selectWorkflow = async workflow => {
    setSelectedWorkflow(workflow);

    try {
      const response = await authenticatedFetch(
        `/api/ci/workflow/${workflow.file}?project=${encodeURIComponent(selectedProject.name)}`
      );
      const data = await response.json();

      if (data.error) {
        console.error('Error fetching workflow details:', data.error);
      } else {
        setWorkflowDetails(data);

        // Select all executable steps by default
        const allSteps = new Set();
        data.jobs.forEach(job => {
          job.executableSteps.forEach(step => {
            allSteps.add(step.id);
          });
        });
        setSelectedSteps(allSteps);
      }
    } catch (error) {
      console.error('Error fetching workflow details:', error);
    }
  };

  const fetchRuns = async () => {
    if (!selectedProject) return;

    try {
      const response = await authenticatedFetch(
        `/api/ci/runs?project=${encodeURIComponent(selectedProject.name)}`
      );
      const data = await response.json();

      if (!data.error) {
        setRuns(data.runs || []);
      }
    } catch (error) {
      console.error('Error fetching runs:', error);
    }
  };

  const fetchRunStatus = async runId => {
    try {
      const response = await authenticatedFetch(`/api/ci/run/${runId}`);
      const data = await response.json();

      if (!data.error) {
        setActiveRun(data);

        // Update runs list
        setRuns(prevRuns => {
          const index = prevRuns.findIndex(r => r.id === runId);
          if (index >= 0) {
            const newRuns = [...prevRuns];
            newRuns[index] = data;
            return newRuns;
          }
          return [data, ...prevRuns];
        });
      }
    } catch (error) {
      console.error('Error fetching run status:', error);
    }
  };

  const runWorkflow = async () => {
    if (!selectedProject || !selectedWorkflow) return;

    try {
      // Prepare environment variables for changed files
      const env = {};
      if (runScope === 'changes' && changedFiles.length > 0) {
        env.CHANGED_FILES = changedFiles.join(' ');
        env.CHANGED_FILES_COUNT = changedFiles.length.toString();
      }

      const response = await authenticatedFetch('/api/ci/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project: selectedProject.name,
          workflowFile: selectedWorkflow.file,
          selectedSteps: Array.from(selectedSteps),
          env,
        }),
      });

      const data = await response.json();

      if (data.error) {
        console.error('Error running workflow:', data.error);
      } else {
        // Start polling for the new run
        setActiveRun({ id: data.runId, status: 'running' });
        fetchRunStatus(data.runId);

        // Expand all jobs to show progress
        if (workflowDetails) {
          setExpandedJobs(new Set(workflowDetails.jobs.map(j => j.id)));
        }
      }
    } catch (error) {
      console.error('Error running workflow:', error);
    }
  };

  const cancelRun = async runId => {
    try {
      const response = await authenticatedFetch(`/api/ci/run/${runId}/cancel`, {
        method: 'POST',
      });

      const data = await response.json();

      if (!data.error) {
        setActiveRun(data.run);
        fetchRuns();
      }
    } catch (error) {
      console.error('Error cancelling run:', error);
    }
  };

  const clearRuns = async () => {
    if (!selectedProject) return;

    try {
      const response = await authenticatedFetch(
        `/api/ci/runs?project=${encodeURIComponent(selectedProject.name)}`,
        {
          method: 'DELETE',
        }
      );
      const data = await response.json();

      if (response.ok && !data.error) {
        setRuns([]);
        setActiveRun(null);
      } else {
        console.error('Error clearing runs:', data.error || response.statusText);
      }
    } catch (error) {
      console.error('Error clearing runs:', error);
    }
  };

  const toggleStep = stepId => {
    setSelectedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepId)) {
        newSet.delete(stepId);
      } else {
        newSet.add(stepId);
      }
      return newSet;
    });
  };

  const toggleAllSteps = () => {
    if (!workflowDetails) return;

    const allSteps = new Set();
    workflowDetails.jobs.forEach(job => {
      job.executableSteps.forEach(step => {
        allSteps.add(step.id);
      });
    });

    if (selectedSteps.size === allSteps.size) {
      setSelectedSteps(new Set());
    } else {
      setSelectedSteps(allSteps);
    }
  };

  const toggleJobSteps = jobId => {
    if (!workflowDetails) return;

    const job = workflowDetails.jobs.find(j => j.id === jobId);
    if (!job || !job.executableSteps?.length) return;

    setSelectedSteps(prev => {
      const newSet = new Set(prev);
      const stepIds = job.executableSteps.map(step => step.id);
      const hasAllSelected = stepIds.every(id => newSet.has(id));

      stepIds.forEach(id => {
        if (hasAllSelected) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
      });

      return newSet;
    });
  };

  const toggleJob = jobId => {
    setExpandedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  const copyError = output => {
    navigator.clipboard.writeText(output);
  };

  const sendToChat = output => {
    if (onSendToChat) {
      onSendToChat(`Fix this CI error:\n\n\`\`\`\n${output}\n\`\`\``);
    }
  };

  const getStatusIcon = status => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'skipped':
        return <Clock className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = status => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'failed':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'running':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'skipped':
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">
          <PlayCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Select a project to view CI workflows</p>
        </div>
      </div>
    );
  }

  if (isLoading && workflows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div className="text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="mb-2">No CI workflows found</p>
          <p className="text-sm">Add GitHub Actions workflows to .github/workflows/</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-none border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <PlayCircle className="w-5 h-5" />
            CI/CD
          </h2>
          <div className="flex gap-2">
            <button
              onClick={fetchWorkflows}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
              title="Refresh workflows"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {runs.length > 0 && (
              <button
                onClick={clearRuns}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
                title="Clear run history"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Workflow selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Workflow</label>
          <select
            value={selectedWorkflow?.file || ''}
            onChange={e => {
              const workflow = workflows.find(w => w.file === e.target.value);
              if (workflow) selectWorkflow(workflow);
            }}
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {workflows.map(workflow => (
              <option key={workflow.file} value={workflow.file}>
                {workflow.name} ({workflow.jobCount} jobs)
              </option>
            ))}
          </select>
        </div>

        {/* Scope selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Run Scope</label>
          <div className="flex gap-2">
            <button
              onClick={() => setRunScope('all')}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                runScope === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              All Files
            </button>
            <button
              onClick={() => setRunScope('changes')}
              disabled={changedFiles.length === 0}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                runScope === 'changes'
                  ? 'bg-blue-600 text-white'
                  : changedFiles.length === 0
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Changes Only
              {changedFiles.length > 0 && ` (${changedFiles.length})`}
            </button>
          </div>
          {runScope === 'changes' && changedFiles.length > 0 && (
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              CI will run with CHANGED_FILES env variable set
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        {workflowDetails && (
          <div className="p-4 space-y-4">
            {/* Step selector */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex flex-wrap gap-2 items-center mb-3">
                <button
                  type="button"
                  onClick={() => setIsStepSelectorCollapsed(prev => !prev)}
                  className="flex-1 flex items-center justify-between gap-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                >
                  <div className="text-left">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Select Steps to Run
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {totalExecutableSteps === 0
                        ? 'This workflow has no executable steps'
                        : `${selectedSteps.size} of ${totalExecutableSteps} steps selected`}
                    </p>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-500 transition-transform ${isStepSelectorCollapsed ? '-rotate-90' : ''}`}
                  />
                </button>
                <button
                  onClick={toggleAllSteps}
                  disabled={totalExecutableSteps === 0}
                  className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/40 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedSteps.size === totalExecutableSteps && totalExecutableSteps > 0
                    ? 'Deselect All'
                    : 'Select All'}
                </button>
              </div>

              {isStepSelectorCollapsed ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Selection hidden. Expand to review individual jobs and steps.
                </div>
              ) : (
                workflowDetails.jobs.map(job => {
                  const executableSteps = job.executableSteps || [];
                  const executableStepIds = executableSteps.map(step => step.id);
                  const selectedCount = executableStepIds.filter(id =>
                    selectedSteps.has(id)
                  ).length;
                  const jobHasSelectableSteps = executableStepIds.length > 0;
                  const isJobChecked =
                    jobHasSelectableSteps && selectedCount === executableStepIds.length;
                  const isJobIndeterminate =
                    jobHasSelectableSteps &&
                    selectedCount > 0 &&
                    selectedCount < executableStepIds.length;

                  return (
                    <div key={job.id} className="mb-3 last:mb-0">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleJob(job.id)}
                          className="flex-1 flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md text-left transition-colors"
                        >
                          {expandedJobs.has(job.id) ? (
                            <ChevronDown className="w-4 h-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          )}
                          <span className="font-medium text-gray-900 dark:text-white text-sm">
                            {job.name}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({executableSteps.length} steps)
                          </span>
                        </button>
                        <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            checked={isJobChecked}
                            aria-checked={isJobIndeterminate ? 'mixed' : isJobChecked}
                            disabled={!jobHasSelectableSteps}
                            onChange={() => toggleJobSteps(job.id)}
                            ref={el => {
                              if (el) {
                                el.indeterminate = isJobIndeterminate;
                              }
                            }}
                            className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                          />
                          <span>Select all</span>
                        </label>
                      </div>

                      {expandedJobs.has(job.id) && (
                        <div className="ml-6 mt-2 space-y-1">
                          {job.steps.map(step => {
                            if (!step.executable) {
                              return (
                                <div
                                  key={step.id}
                                  className="flex items-center gap-2 p-2 text-sm text-gray-400 dark:text-gray-500"
                                >
                                  <input type="checkbox" disabled className="w-4 h-4 opacity-50" />
                                  <span className="line-through">{step.name}</span>
                                  <span className="text-xs">(GitHub Action)</span>
                                </div>
                              );
                            }

                            return (
                              <label
                                key={step.id}
                                className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-md cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={selectedSteps.has(step.id)}
                                  onChange={() => toggleStep(step.id)}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-sm text-gray-900 dark:text-white">
                                  {step.name}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Run button */}
            <button
              onClick={runWorkflow}
              disabled={selectedSteps.size === 0 || (activeRun && activeRun.status === 'running')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {activeRun && activeRun.status === 'running' ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayCircle className="w-5 h-5" />
                  Run Selected Steps ({selectedSteps.size})
                </>
              )}
            </button>

            {/* Active run */}
            {activeRun && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(activeRun.status)}
                    <h3 className="font-medium text-gray-900 dark:text-white">Current Run</h3>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(activeRun.status)}`}
                    >
                      {activeRun.status}
                    </span>
                  </div>
                  {activeRun.status === 'running' && (
                    <button
                      onClick={() => cancelRun(activeRun.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md transition-colors"
                      title="Cancel run"
                    >
                      <StopCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {showLiveStepPanel && (
                  <div className="mb-4 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Running step
                        </p>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {currentStepLabel}
                        </p>
                        {currentJobLabel && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Job: {currentJobLabel}
                          </p>
                        )}
                      </div>
                      {activeRun.currentStepUpdatedAt && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Updated {new Date(activeRun.currentStepUpdatedAt).toLocaleTimeString()}
                        </p>
                      )}
                    </div>
                    <pre className="text-xs bg-gray-900 dark:bg-black text-gray-100 p-3 rounded-md whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
                      {liveStepOutput.trim().length > 0 ? liveStepOutput : 'Waiting for output...'}
                    </pre>
                  </div>
                )}

                {/* Job results */}
                {activeRun.jobs &&
                  activeRun.jobs.map(job => (
                    <div key={job.id} className="mb-4 last:mb-0">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(job.status)}
                        <span className="font-medium text-sm text-gray-900 dark:text-white">
                          {job.name}
                        </span>
                      </div>

                      {job.steps &&
                        job.steps.map(step => (
                          <div key={step.id} className="ml-6 mb-2">
                            <div className="flex items-center gap-2 mb-1">
                              {getStatusIcon(step.status)}
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {step.name}
                              </span>
                            </div>

                            {step.output && (
                              <div className="ml-6 mt-2">
                                <pre className="text-xs bg-gray-900 dark:bg-black text-gray-100 p-3 rounded-md overflow-x-auto max-h-64 overflow-y-auto">
                                  {step.output}
                                </pre>

                                {step.status === 'failed' && (
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => copyError(step.output)}
                                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
                                    >
                                      <Copy className="w-3 h-3" />
                                      Copy Error
                                    </button>
                                    <button
                                      onClick={() => sendToChat(step.output)}
                                      className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/40 rounded-md transition-colors"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      Send to AI
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  ))}
              </div>
            )}

            {/* Run history */}
            {runs.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">Recent Runs</h3>
                <div className="space-y-2">
                  {runs.slice(0, 5).map(run => (
                    <button
                      key={run.id}
                      onClick={() => setActiveRun(run)}
                      className={`w-full flex items-center justify-between p-3 rounded-md transition-colors ${
                        activeRun?.id === run.id
                          ? 'bg-blue-50 dark:bg-blue-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {getStatusIcon(run.status)}
                        <div className="text-left">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {run.workflowName}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(run.startTime).toLocaleString()}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status)}`}
                      >
                        {run.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default CIPanel;
