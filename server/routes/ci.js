import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import * as fs from 'fs';
import yaml from 'js-yaml';
import { extractProjectDirectory } from '../projects.js';
import { validatePathComprehensive } from '../utils/path-validator.js';

const router = express.Router();
const { promises: fsPromises, existsSync } = fs;

// Store active CI runs in memory
const activeRuns = new Map();
let runIdCounter = 0;

async function resolveWorkingDirectory(projectPath, requestedDir) {
  if (!requestedDir || requestedDir === '.' || requestedDir === './') {
    return projectPath;
  }

  const normalizedProjectPath = path.resolve(projectPath);
  const resolvedPath = path.resolve(normalizedProjectPath, requestedDir);
  const relative = path.relative(normalizedProjectPath, resolvedPath);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Working directory "${requestedDir}" resolves outside of the project root`);
  }

  try {
    await fsPromises.access(resolvedPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Working directory "${requestedDir}" does not exist within the project`);
    }
    throw error;
  }

  return resolvedPath;
}

// Helper function to get the actual project path
async function getActualProjectPath(projectName) {
  const projectPath = await extractProjectDirectory(projectName);
  const validation = await validatePathComprehensive(projectPath, {
    checkSensitive: true,
    maxLength: 2048,
  });

  if (!validation.valid || !validation.resolvedPath) {
    throw new Error(validation.error || 'Invalid project path');
  }

  try {
    await fsPromises.access(validation.resolvedPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`Project path not found: ${validation.resolvedPath}`);
    }
    throw error;
  }

  return validation.resolvedPath;
}

// Get all workflows for a project
router.get('/workflows', async (req, res) => {
  const { project } = req.query;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const workflowsPath = path.join(projectPath, '.github', 'workflows');

    // Check if workflows directory exists
    try {
      await fsPromises.access(workflowsPath);
    } catch {
      return res.json({ workflows: [] });
    }

    // Read all YAML files in the workflows directory
    const files = await fsPromises.readdir(workflowsPath);
    const workflowFiles = files.filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

    const workflows = await Promise.all(
      workflowFiles.map(async file => {
        const filePath = path.join(workflowsPath, file);
        const content = await fsPromises.readFile(filePath, 'utf8');
        const parsed = yaml.load(content);

        return {
          id: file,
          name: parsed.name || file,
          file,
          path: filePath,
          jobs: Object.keys(parsed.jobs || {}),
          jobCount: Object.keys(parsed.jobs || {}).length,
        };
      })
    );

    res.json({ workflows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get detailed workflow information
router.get('/workflow/:workflowFile', async (req, res) => {
  const { project } = req.query;
  const { workflowFile } = req.params;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const workflowPath = path.join(projectPath, '.github', 'workflows', workflowFile);

    const content = await fsPromises.readFile(workflowPath, 'utf8');
    const parsed = yaml.load(content);

    // Extract jobs with their steps
    const jobs = Object.entries(parsed.jobs || {}).map(([jobId, jobData]) => {
      const steps = (jobData.steps || []).map((step, index) => ({
        id: `${jobId}-step-${index}`,
        name: step.name || `Step ${index + 1}`,
        run: step.run || null,
        uses: step.uses || null,
        with: step.with || null,
        if: step.if || null,
        // Only executable if it has a 'run' command (ignore 'uses' actions for local execution)
        executable: !!step.run,
      }));

      return {
        id: jobId,
        name: jobData.name || jobId,
        runsOn: jobData['runs-on'],
        needs: jobData.needs || [],
        steps,
        executableSteps: steps.filter(s => s.executable),
      };
    });

    res.json({
      name: parsed.name || workflowFile,
      file: workflowFile,
      jobs,
    });
  } catch (error) {
    console.error('Error fetching workflow details:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute a workflow run
router.post('/run', async (req, res) => {
  const { project, workflowFile, selectedSteps, env } = req.body;

  if (!project || !workflowFile) {
    return res.status(400).json({ error: 'Project and workflow file are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const workflowPath = path.join(projectPath, '.github', 'workflows', workflowFile);

    const content = await fsPromises.readFile(workflowPath, 'utf8');
    const parsed = yaml.load(content);

    // Create a new run
    const runId = `run-${++runIdCounter}-${Date.now()}`;
    const run = {
      id: runId,
      project,
      workflowFile,
      workflowName: parsed.name || workflowFile,
      status: 'running',
      startTime: new Date().toISOString(),
      endTime: null,
      jobs: [],
      logs: [],
      currentStep: null,
      currentStepName: null,
      currentJobId: null,
      currentJobName: null,
      currentStepOutput: '',
      currentStepStartedAt: null,
      currentStepUpdatedAt: null,
      cancelRequested: false,
    };

    Object.defineProperty(run, 'currentProcess', {
      value: null,
      writable: true,
      enumerable: false,
    });

    activeRuns.set(runId, run);

    // Send immediate response with run ID
    res.json({ runId, status: 'started' });

    // Execute steps asynchronously
    executeWorkflow(runId, parsed, projectPath, selectedSteps, env).catch(error => {
      console.error('Error executing workflow:', error);
      const run = activeRuns.get(runId);
      if (run) {
        run.status = 'failed';
        run.endTime = new Date().toISOString();
        run.logs.push({
          type: 'error',
          message: `Workflow execution failed: ${error.message}`,
          timestamp: new Date().toISOString(),
        });
      }
    });
  } catch (error) {
    console.error('Error starting workflow run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute workflow steps
async function executeWorkflow(runId, workflow, projectPath, selectedSteps, envVars = {}) {
  const run = activeRuns.get(runId);
  if (!run) return;

  const isCancelled = () => run.status === 'cancelled' || run.cancelRequested;
  const resetCurrentStepMetadata = () => {
    run.currentStep = null;
    run.currentStepName = null;
    run.currentJobId = null;
    run.currentJobName = null;
    run.currentStepOutput = '';
    run.currentStepStartedAt = null;
    run.currentStepUpdatedAt = null;
  };

  try {
    for (const [jobId, jobData] of Object.entries(workflow.jobs || {})) {
      if (isCancelled()) {
        break;
      }

      const jobRun = {
        id: jobId,
        name: jobData.name || jobId,
        status: 'running',
        steps: [],
        startTime: new Date().toISOString(),
      };

      run.jobs.push(jobRun);

      const jobSteps = jobData.steps || [];
      const jobDefaultWorkingDir = jobData?.defaults?.run?.['working-directory'];
      for (let i = 0; i < jobSteps.length; i++) {
        const step = jobSteps[i];
        const stepId = `${jobId}-step-${i}`;

        if (isCancelled()) {
          jobRun.steps.push({
            id: stepId,
            name: step.name || `Step ${i + 1}`,
            status: 'cancelled',
            output: 'Run cancelled by user',
          });
          jobRun.status = 'cancelled';
          jobRun.endTime = new Date().toISOString();
          resetCurrentStepMetadata();
          if (!run.endTime) {
            run.endTime = new Date().toISOString();
          }
          return;
        }

        // Skip if not selected or if it's a 'uses' action (not executable locally)
        if (selectedSteps && !selectedSteps.includes(stepId)) {
          jobRun.steps.push({
            id: stepId,
            name: step.name || `Step ${i + 1}`,
            status: 'skipped',
            output: '',
          });
          continue;
        }

        if (!step.run) {
          jobRun.steps.push({
            id: stepId,
            name: step.name || `Step ${i + 1}`,
            status: 'skipped',
            output: 'Step uses GitHub Action (not executable locally)',
          });
          continue;
        }

        const stepStartTime = new Date().toISOString();
        const stepRun = {
          id: stepId,
          name: step.name || `Step ${i + 1}`,
          status: 'running',
          output: '',
          startTime: stepStartTime,
        };

        run.currentStep = stepId;
        run.currentStepName = stepRun.name;
        run.currentJobId = jobId;
        run.currentJobName = jobRun.name;
        run.currentStepOutput = '';
        run.currentStepStartedAt = stepStartTime;
        run.currentStepUpdatedAt = stepStartTime;

        jobRun.steps.push(stepRun);

        try {
          const workflowDefaultWorkingDir = workflow?.defaults?.run?.['working-directory'];
          const workingDirectorySetting =
            step['working-directory'] || jobDefaultWorkingDir || workflowDefaultWorkingDir;

          let workingDirectory = projectPath;
          try {
            workingDirectory = await resolveWorkingDirectory(projectPath, workingDirectorySetting);
          } catch (dirError) {
            stepRun.output = dirError.message;
            stepRun.status = 'failed';
            stepRun.endTime = new Date().toISOString();
            jobRun.status = 'failed';
            jobRun.endTime = new Date().toISOString();
            run.status = 'failed';
            run.endTime = new Date().toISOString();
            return;
          }

          const output = await executeStep(runId, step.run, workingDirectory, envVars, chunk => {
            stepRun.output += chunk;
            run.currentStepOutput = stepRun.output;
            run.currentStepUpdatedAt = new Date().toISOString();
          });
          stepRun.output = output;
          stepRun.status = 'success';
          stepRun.endTime = new Date().toISOString();
        } catch (error) {
          const cancelled = isCancelled();
          if (cancelled) {
            stepRun.output = 'Step cancelled by user';
          } else {
            stepRun.output = stepRun.output
              ? `${stepRun.output}\n\n${error.message}`
              : error.message;
          }
          stepRun.status = cancelled ? 'cancelled' : 'failed';
          stepRun.endTime = new Date().toISOString();

          jobRun.status = cancelled ? 'cancelled' : 'failed';
          jobRun.endTime = new Date().toISOString();

          if (cancelled) {
            if (!run.endTime) {
              run.endTime = new Date().toISOString();
            }
          } else {
            run.status = 'failed';
            run.endTime = new Date().toISOString();
          }
          return;
        }
      }

      if (jobRun.status === 'running') {
        jobRun.status = 'success';
        jobRun.endTime = new Date().toISOString();
      }

      // Reset current step metadata between jobs
      resetCurrentStepMetadata();
    }

    if (run.status === 'running') {
      run.status = 'success';
    }
    if (!run.endTime) {
      run.endTime = new Date().toISOString();
    }
  } catch (error) {
    if (run.status !== 'cancelled') {
      run.status = 'failed';
    }
    if (!run.endTime) {
      run.endTime = new Date().toISOString();
    }
    resetCurrentStepMetadata();
    run.logs.push({
      type: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Execute a single step
function executeStep(runId, command, cwd, env = {}, onOutputChunk = null) {
  return new Promise((resolve, reject) => {
    // Enhanced logging for debugging
    console.log(`[CI] Executing command: ${command}`);
    console.log(`[CI] Working directory: ${cwd}`);
    console.log(`[CI] Environment:`, Object.keys(env));

    // Validate npm execution context
    const isNpmCommand = command.trim().startsWith('npm');
    if (isNpmCommand) {
      console.log(`[CI] Detected npm command, validating execution context...`);

      // Check if package.json exists in the working directory
      const packageJsonPath = path.join(cwd, 'package.json');
      if (!existsSync(packageJsonPath)) {
        console.log(`[CI] Warning: No package.json found at ${packageJsonPath}`);
      } else {
        console.log(`[CI] Found package.json at ${packageJsonPath}`);
      }
    }

    // Add timeout handling
    const timeoutMs = 300000; // 5 minutes

    // Enhanced spawn configuration for npm commands
    const spawnOptions = {
      cwd,
      env: {
        ...process.env,
        ...env,
        // Ensure PATH includes common npm locations
        PATH: process.env.PATH + ':/usr/local/bin:/usr/bin:/node_modules/.bin',
      },
      shell: true,
      // Add timeout to prevent hanging - handled manually for better control
      stdio: ['pipe', 'pipe', 'pipe'],
    };

    console.log(`[CI] Spawn options:`, {
      cwd: spawnOptions.cwd,
      shell: spawnOptions.shell,
      timeout: timeoutMs,
      envKeys: Object.keys(spawnOptions.env),
    });

    const childProcess = spawn(command, spawnOptions);
    const timeout = setTimeout(() => {
      console.log(`[CI] Command timeout after ${timeoutMs}ms, terminating process...`);
      childProcess.kill('SIGTERM');

      // Force kill if graceful termination fails
      setTimeout(() => {
        try {
          childProcess.kill('SIGKILL');
        } catch (e) {
          console.log(`[CI] Process already terminated`);
        }
      }, 5000);
    }, timeoutMs);

    const run = activeRuns.get(runId);
    if (run) {
      run.currentProcess = childProcess;
    }

    let stdout = '';
    let stderr = '';

    const cleanupProcessRef = () => {
      if (run && run.currentProcess === childProcess) {
        run.currentProcess = null;
      }
    };

    childProcess.stdout.on('data', data => {
      const output = data.toString();
      stdout += output;
      if (typeof onOutputChunk === 'function' && output) {
        onOutputChunk(output);
      }
      // Real-time logging for npm commands
      if (isNpmCommand && output.trim()) {
        console.log(`[CI] npm stdout:`, output.trim());
      }
    });

    childProcess.stderr.on('data', data => {
      const output = data.toString();
      stderr += output;
      if (typeof onOutputChunk === 'function' && output) {
        onOutputChunk(output);
      }
      // Real-time logging for npm commands
      if (isNpmCommand && output.trim()) {
        console.log(`[CI] npm stderr:`, output.trim());
      }
    });

    childProcess.on('close', (code, signal) => {
      clearTimeout(timeout);
      cleanupProcessRef();
      const output = stdout + (stderr ? '\n' + stderr : '');

      console.log(`[CI] Process closed with code: ${code}, signal: ${signal}`);
      console.log(`[CI] Total output length: ${output.length} characters`);

      if (code === 0) {
        console.log(`[CI] Command executed successfully`);
        resolve(output);
      } else {
        const runCancelled = run && (run.status === 'cancelled' || run.cancelRequested);
        if (runCancelled) {
          console.log(`[CI] Run was cancelled by user`);
          reject(new Error('Run cancelled by user'));
        } else {
          // Enhanced error detection for npm commands
          let errorDetails = [
            `Command failed with exit code ${code ?? signal ?? 'unknown'}`,
            `Command: ${command}`,
            `Working directory: ${cwd}`,
          ];

          // Check for specific npm error patterns
          if (isNpmCommand) {
            if (stdout.includes('Usage:') || stdout.includes('npm <command>')) {
              errorDetails.push(
                '🔍 NPM Error: Command showing help output - likely invalid arguments or command not found'
              );
            }
            if (stderr.includes('command not found') || stderr.includes('npm: not found')) {
              errorDetails.push('🔍 NPM Error: npm executable not found in PATH');
            }
            if (stderr.includes('ENONENT') || stderr.includes('no such file')) {
              errorDetails.push('🔍 NPM Error: File or directory not found');
            }
            if (stderr.includes('EACCES') || stderr.includes('permission denied')) {
              errorDetails.push(
                '🔍 NPM Error: Permission denied - check file/directory permissions'
              );
            }
            if (stdout.includes('Missing script') || stdout.includes('Missing script')) {
              errorDetails.push('🔍 NPM Error: Script not found in package.json');
            }
          }

          if (stderr.trim()) {
            errorDetails.push(`stderr:\n${stderr.trim()}`);
          }

          if (stdout.trim()) {
            errorDetails.push(`stdout:\n${stdout.trim()}`);
          }

          const errorMessage = errorDetails.join('\n\n');
          console.log(`[CI] Error details:`, errorMessage);
          reject(new Error(errorMessage));
        }
      }
    });

    childProcess.on('error', error => {
      clearTimeout(timeout);
      cleanupProcessRef();
      console.log(`[CI] Process error:`, error.message);

      // Enhanced error handling for npm-specific issues
      let enhancedError = error;
      if (isNpmCommand) {
        if (error.code === 'ENOENT') {
          enhancedError = new Error(
            `npm executable not found. Please ensure Node.js and npm are properly installed and accessible in PATH. Original error: ${error.message}`
          );
        } else if (error.code === 'EACCES') {
          enhancedError = new Error(
            `Permission denied executing npm command. Please check file/directory permissions. Original error: ${error.message}`
          );
        } else {
          enhancedError = new Error(`npm execution failed: ${error.message} (code: ${error.code})`);
        }
      }

      reject(enhancedError);
    });
  });
}

// Get run status
router.get('/run/:runId', async (req, res) => {
  const { runId } = req.params;
  const run = activeRuns.get(runId);

  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  res.json(run);
});

// List all runs for a project
router.get('/runs', async (req, res) => {
  const { project } = req.query;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const projectRuns = Array.from(activeRuns.values())
    .filter(run => run.project === project)
    .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

  res.json({ runs: projectRuns });
});

// Cancel a running workflow
router.post('/run/:runId/cancel', async (req, res) => {
  const { runId } = req.params;
  const run = activeRuns.get(runId);

  if (!run) {
    return res.status(404).json({ error: 'Run not found' });
  }

  if (run.status === 'running') {
    run.status = 'cancelled';
    run.endTime = new Date().toISOString();
    run.cancelRequested = true;
    run.logs.push({
      type: 'info',
      message: 'Run cancelled by user request',
      timestamp: new Date().toISOString(),
    });

    if (run.currentProcess && !run.currentProcess.killed) {
      const processRef = run.currentProcess;
      processRef.kill('SIGTERM');
      setTimeout(() => {
        if (processRef && !processRef.killed) {
          processRef.kill('SIGKILL');
        }
      }, 2000);
    }
  }

  res.json({ success: true, run });
});

// Clear old runs
router.delete('/runs', async (req, res) => {
  const { project } = req.query;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  // Remove completed runs for the project
  for (const [runId, run] of activeRuns.entries()) {
    if (run.project === project && run.status !== 'running') {
      activeRuns.delete(runId);
    }
  }

  res.json({ success: true });
});

export default router;
