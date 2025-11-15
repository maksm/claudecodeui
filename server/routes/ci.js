import express from 'express';
import { spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import yaml from 'js-yaml';
import { extractProjectDirectory } from '../projects.js';

const router = express.Router();

// Store active CI runs in memory
const activeRuns = new Map();
let runIdCounter = 0;

// Helper function to get the actual project path
async function getActualProjectPath(projectName) {
  try {
    return await extractProjectDirectory(projectName);
  } catch (error) {
    console.error(`Error extracting project directory for ${projectName}:`, error);
    return projectName.replace(/-/g, '/');
  }
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
      await fs.access(workflowsPath);
    } catch {
      return res.json({ workflows: [] });
    }

    // Read all YAML files in the workflows directory
    const files = await fs.readdir(workflowsPath);
    const workflowFiles = files.filter(
      (f) => f.endsWith('.yml') || f.endsWith('.yaml')
    );

    const workflows = await Promise.all(
      workflowFiles.map(async (file) => {
        const filePath = path.join(workflowsPath, file);
        const content = await fs.readFile(filePath, 'utf8');
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
    const workflowPath = path.join(
      projectPath,
      '.github',
      'workflows',
      workflowFile
    );

    const content = await fs.readFile(workflowPath, 'utf8');
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
        executableSteps: steps.filter((s) => s.executable),
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
    return res
      .status(400)
      .json({ error: 'Project and workflow file are required' });
  }

  try {
    const projectPath = await getActualProjectPath(project);
    const workflowPath = path.join(
      projectPath,
      '.github',
      'workflows',
      workflowFile
    );

    const content = await fs.readFile(workflowPath, 'utf8');
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
    };

    activeRuns.set(runId, run);

    // Send immediate response with run ID
    res.json({ runId, status: 'started' });

    // Execute steps asynchronously
    executeWorkflow(runId, parsed, projectPath, selectedSteps, env).catch(
      (error) => {
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
      }
    );
  } catch (error) {
    console.error('Error starting workflow run:', error);
    res.status(500).json({ error: error.message });
  }
});

// Execute workflow steps
async function executeWorkflow(runId, workflow, projectPath, selectedSteps, envVars = {}) {
  const run = activeRuns.get(runId);
  if (!run) return;

  try {
    // Process jobs sequentially (respecting dependencies would be more complex)
    for (const [jobId, jobData] of Object.entries(workflow.jobs || {})) {
      const jobRun = {
        id: jobId,
        name: jobData.name || jobId,
        status: 'running',
        steps: [],
        startTime: new Date().toISOString(),
      };

      run.jobs.push(jobRun);

      // Execute each step
      for (let i = 0; i < (jobData.steps || []).length; i++) {
        const step = jobData.steps[i];
        const stepId = `${jobId}-step-${i}`;

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
          // Skip 'uses' actions
          jobRun.steps.push({
            id: stepId,
            name: step.name || `Step ${i + 1}`,
            status: 'skipped',
            output: 'Step uses GitHub Action (not executable locally)',
          });
          continue;
        }

        run.currentStep = stepId;

        const stepRun = {
          id: stepId,
          name: step.name || `Step ${i + 1}`,
          status: 'running',
          output: '',
          startTime: new Date().toISOString(),
        };

        jobRun.steps.push(stepRun);

        try {
          // Execute the step
          const output = await executeStep(step.run, projectPath, envVars);
          stepRun.output = output;
          stepRun.status = 'success';
          stepRun.endTime = new Date().toISOString();
        } catch (error) {
          stepRun.output = error.message;
          stepRun.status = 'failed';
          stepRun.endTime = new Date().toISOString();

          // Mark job as failed and stop
          jobRun.status = 'failed';
          jobRun.endTime = new Date().toISOString();
          run.status = 'failed';
          run.endTime = new Date().toISOString();
          return;
        }
      }

      jobRun.status = 'success';
      jobRun.endTime = new Date().toISOString();
    }

    run.status = 'success';
    run.endTime = new Date().toISOString();
  } catch (error) {
    run.status = 'failed';
    run.endTime = new Date().toISOString();
    run.logs.push({
      type: 'error',
      message: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}

// Execute a single step
function executeStep(command, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const childProcess = spawn('sh', ['-c', command], {
      cwd,
      env: { ...process.env, ...env },
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', (code) => {
      const output = stdout + (stderr ? '\n' + stderr : '');

      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(output || `Command failed with exit code ${code}`));
      }
    });

    childProcess.on('error', (error) => {
      reject(error);
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
    .filter((run) => run.project === project)
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
