/**
 * DevWorkflow Component
 *
 * AI-powered development workflow: Branch → Test → Commit → PR
 * Mobile-responsive UI with real-time CI updates via WebSocket
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  GitBranch,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  GitCommit,
  GitPullRequest,
  Loader2,
  ChevronRight,
  RotateCcw,
  Terminal,
  FileCode,
  AlertCircle,
  Check,
} from 'lucide-react';
import { useWorkflow } from '../hooks/useWorkflow';

// Steps configuration
const steps = [
  { id: 'branch', label: 'Branch', icon: GitBranch },
  { id: 'test', label: 'Test', icon: Play },
  { id: 'commit', label: 'Commit', icon: GitCommit },
  { id: 'pr', label: 'PR', icon: GitPullRequest },
];

// Step indicator component
function StepIndicator({ currentStep, completedSteps, isMobile }) {
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);

  return (
    <div className={`flex items-center justify-between ${isMobile ? 'mb-4' : 'mb-8'}`}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = currentStep === step.id;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center gap-2 flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-green-500 text-white'
                    : isCurrent
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}
              >
                {isCompleted ? <Check className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span
                className={`text-xs font-medium ${
                  isCurrent
                    ? 'text-blue-600 dark:text-blue-400'
                    : isCompleted
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <ChevronRight
                className={`w-5 h-5 mx-2 ${
                  isCompleted ? 'text-green-500' : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// Branch Creation Step
function BranchStep({ workflow, branchName, setBranchName }) {
  // Check if current branch is a main branch
  const mainBranches = ['main', 'master', 'develop'];
  const isOnMainBranch = workflow.currentBranch && mainBranches.includes(workflow.currentBranch);
  const isOnFeatureBranch = workflow.currentBranch && !isOnMainBranch;

  // Handler to proceed on current branch
  const handleContinueOnCurrentBranch = () => {
    workflow.setCurrentStep('test');
    workflow.setCompletedSteps(prev => [...new Set([...prev, 'branch'])]);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">
        {isOnFeatureBranch ? 'Branch Selection' : 'Create Feature Branch'}
      </h2>

      {workflow.currentBranch && (
        <div
          className={`border rounded-lg p-3 ${
            isOnFeatureBranch
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
          }`}
        >
          <div
            className={`flex items-center gap-2 text-sm ${
              isOnFeatureBranch
                ? 'text-green-700 dark:text-green-300'
                : 'text-blue-700 dark:text-blue-300'
            }`}
          >
            <GitBranch className="w-4 h-4" />
            <span>
              Current branch:{' '}
              <span className="font-mono font-semibold">{workflow.currentBranch}</span>
            </span>
          </div>
        </div>
      )}

      {isOnFeatureBranch && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            You are currently on a feature branch. You can continue on this branch or create a new
            one.
          </p>

          <button
            onClick={handleContinueOnCurrentBranch}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors font-medium"
          >
            <Play className="w-4 h-4" />
            Continue on {workflow.currentBranch}
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or create a new branch</span>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Branch Name</label>
          <input
            type="text"
            value={branchName}
            onChange={e => setBranchName(e.target.value)}
            placeholder="feature/my-feature"
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use format: feature/name, fix/name, or chore/name
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Base Branch</label>
          <select
            value={workflow.baseBranch}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled
          >
            <option value="main">main</option>
            <option value="master">master</option>
            <option value="develop">develop</option>
          </select>
        </div>

        {workflow.branchError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{workflow.branchError}</span>
          </div>
        )}

        <button
          onClick={() => workflow.createBranch(branchName)}
          disabled={!branchName || workflow.isLoadingBranch}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium"
        >
          {workflow.isLoadingBranch ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating Branch...
            </>
          ) : (
            <>
              <GitBranch className="w-4 h-4" />
              {isOnFeatureBranch ? 'Create New Branch' : 'Create Branch'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// CI Test Step
function TestStep({ workflow, showOutput, setShowOutput, outputEndRef }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Run CI Tests</h2>
        {workflow.currentRun && (
          <button
            onClick={() => setShowOutput(!showOutput)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            {showOutput ? 'Hide' : 'Show'} Output
          </button>
        )}
      </div>

      {workflow.currentRun ? (
        <div className="space-y-3">
          {/* Run Status Card */}
          <div className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {workflow.currentRun.status === 'running' && (
                  <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                )}
                {workflow.currentRun.status === 'completed' && workflow.currentRun.passed && (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                )}
                {workflow.currentRun.status === 'completed' && !workflow.currentRun.passed && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                {workflow.currentRun.status === 'failed' && (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                {workflow.currentRun.status === 'cancelled' && (
                  <Clock className="w-5 h-5 text-gray-500" />
                )}
                <span className="font-medium text-foreground">
                  {workflow.currentRun.status === 'running' && 'Running Tests...'}
                  {workflow.currentRun.status === 'completed' &&
                    workflow.currentRun.passed &&
                    'All Tests Passed'}
                  {workflow.currentRun.status === 'completed' &&
                    !workflow.currentRun.passed &&
                    'Tests Failed'}
                  {workflow.currentRun.status === 'failed' && 'Run Failed'}
                  {workflow.currentRun.status === 'cancelled' && 'Run Cancelled'}
                </span>
              </div>
              {workflow.currentRun.status === 'running' && (
                <button
                  onClick={() => workflow.cancelCIRun(workflow.currentRun.runId)}
                  className="text-sm text-red-600 dark:text-red-400 hover:underline"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* Progress Bar */}
            {workflow.currentRun.progress && workflow.currentRun.status === 'running' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{workflow.currentRun.progress.currentTest}</span>
                  <span>
                    {workflow.currentRun.progress.current} / {workflow.currentRun.progress.total}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${(workflow.currentRun.progress.current / workflow.currentRun.progress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Test Results Summary */}
            {workflow.currentRun.results && (
              <div className="mt-3 space-y-2">
                {Object.entries(workflow.currentRun.results.results || {}).map(
                  ([testName, result]) => (
                    <div key={testName} className="flex items-center justify-between text-sm py-1">
                      <span className="font-mono text-muted-foreground">{testName}</span>
                      {result.passed ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                  )
                )}
                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Duration: {(workflow.currentRun.duration / 1000).toFixed(2)}s
                </div>
              </div>
            )}
          </div>

          {/* CI Output Console */}
          {showOutput && workflow.ciOutput[workflow.currentRun.runId] && (
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-gray-900 dark:bg-gray-950 p-3 flex items-center gap-2 border-b border-gray-700">
                <Terminal className="w-4 h-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-300">Test Output</span>
              </div>
              <div className="bg-gray-900 dark:bg-gray-950 p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                  {Object.entries(workflow.ciOutput[workflow.currentRun.runId]).map(
                    ([testType, outputs]) => (
                      <div key={testType} className="mb-4">
                        <div className="text-blue-400 font-bold mb-2">
                          === {testType.toUpperCase()} ===
                        </div>
                        {outputs.map((output, i) => (
                          <div key={i}>{output.data}</div>
                        ))}
                      </div>
                    )
                  )}
                  <div ref={outputEndRef} />
                </pre>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Run the full CI test suite (lint, audit, build, tests) to validate your changes.
          </p>

          {workflow.ciError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{workflow.ciError}</span>
            </div>
          )}

          <button
            onClick={() => workflow.startCIRun()}
            disabled={workflow.isLoadingCI}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium"
          >
            {workflow.isLoadingCI ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Starting Tests...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run All Tests
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// Commit Step
function CommitStep({ workflow }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Commit Changes</h2>

      {workflow.stagedFiles.length > 0 && (
        <div className="border border-border rounded-lg p-3 bg-card">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground mb-2">
            <FileCode className="w-4 h-4" />
            Staged Files ({workflow.stagedFiles.length})
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {workflow.stagedFiles.map((file, i) => (
              <div key={i} className="text-xs font-mono text-muted-foreground">
                {file}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-foreground">Commit Message</label>
            <button
              onClick={() => workflow.generateCommitMessage()}
              disabled={workflow.isGeneratingCommit}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              {workflow.isGeneratingCommit ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate with AI'
              )}
            </button>
          </div>
          <textarea
            value={workflow.commitMessage}
            onChange={e => workflow.setCommitMessage(e.target.value)}
            placeholder="feat: add new feature&#10;&#10;Detailed description of changes..."
            rows={4}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use conventional commits format: feat, fix, chore, docs, etc.
          </p>
        </div>

        {workflow.commitError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{workflow.commitError}</span>
          </div>
        )}

        <button
          onClick={() => workflow.commitChanges(workflow.commitMessage)}
          disabled={!workflow.commitMessage || workflow.isGeneratingCommit}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium"
        >
          {workflow.isGeneratingCommit ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Committing...
            </>
          ) : (
            <>
              <GitCommit className="w-4 h-4" />
              Commit & Push
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// PR Creation Step
function PRStep({ workflow }) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Create Pull Request</h2>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">PR Title</label>
          <input
            type="text"
            value={workflow.prTitle}
            onChange={e => workflow.setPrTitle(e.target.value)}
            placeholder="Add new feature for..."
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Description</label>
          <textarea
            value={workflow.prBody}
            onChange={e => workflow.setPrBody(e.target.value)}
            placeholder="## Summary&#10;- Changes made&#10;&#10;## Testing&#10;- [ ] Tests pass"
            rows={6}
            className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
          />
        </div>

        {workflow.prError && (
          <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-md text-red-700 dark:text-red-300 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{workflow.prError}</span>
          </div>
        )}

        <button
          onClick={() =>
            workflow.createPullRequest(workflow.prTitle, workflow.prBody, workflow.baseBranch)
          }
          disabled={!workflow.prTitle || workflow.isCreatingPR}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white rounded-md transition-colors font-medium"
        >
          {workflow.isCreatingPR ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Creating PR...
            </>
          ) : (
            <>
              <GitPullRequest className="w-4 h-4" />
              Create Pull Request
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Complete Step
function CompleteStep({ workflow }) {
  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center">
        <CheckCircle className="w-16 h-16 text-green-500" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Workflow Complete!</h2>
      <p className="text-muted-foreground">Your pull request has been created successfully.</p>

      {workflow.prUrl && (
        <a
          href={workflow.prUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors font-medium"
        >
          <GitPullRequest className="w-4 h-4" />
          View Pull Request
        </a>
      )}

      <button
        onClick={workflow.resetWorkflow}
        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-border hover:bg-accent text-foreground rounded-md transition-colors font-medium mt-4"
      >
        <RotateCcw className="w-4 h-4" />
        Start New Workflow
      </button>
    </div>
  );
}

// Main DevWorkflow Component
export default function DevWorkflow({ selectedProject, isMobile }) {
  const projectName = selectedProject?.name;
  const projectPath = selectedProject?.fullPath || selectedProject?.path;

  const workflow = useWorkflow(projectName, projectPath);
  const [branchName, setBranchName] = useState('');
  const [showOutput, setShowOutput] = useState(false);
  const outputEndRef = useRef(null);

  // Auto-scroll CI output to bottom
  useEffect(() => {
    if (showOutput && outputEndRef.current) {
      outputEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [workflow.ciOutput, showOutput]);

  if (!selectedProject) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <GitBranch className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Select a project to start the workflow</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full overflow-y-auto ${isMobile ? 'p-4' : 'p-6'}`}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">Development Workflow</h1>
          <p className="text-sm text-muted-foreground">
            AI-powered Branch → Test → Commit → PR workflow for{' '}
            {selectedProject.displayName || selectedProject.name}
          </p>
        </div>

        <StepIndicator
          currentStep={workflow.currentStep}
          completedSteps={workflow.completedSteps}
          isMobile={isMobile}
        />

        <div className="bg-card border border-border rounded-lg p-6 shadow-sm">
          {workflow.currentStep === 'branch' && (
            <BranchStep workflow={workflow} branchName={branchName} setBranchName={setBranchName} />
          )}
          {workflow.currentStep === 'test' && (
            <TestStep
              workflow={workflow}
              showOutput={showOutput}
              setShowOutput={setShowOutput}
              outputEndRef={outputEndRef}
            />
          )}
          {workflow.currentStep === 'commit' && <CommitStep workflow={workflow} />}
          {workflow.currentStep === 'pr' && <PRStep workflow={workflow} />}
          {workflow.currentStep === 'complete' && <CompleteStep workflow={workflow} />}
        </div>
      </div>
    </div>
  );
}
