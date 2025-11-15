import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { extractProjectDirectory } from '../projects.js';
import { queryClaudeSDK } from '../claude-sdk.js';
import { TestRunner } from '../utils/test-runner.js';
import { randomUUID } from 'crypto';

const router = express.Router();
const execAsync = promisify(exec);

// Store active workflows in memory
const activeWorkflows = new Map();

/**
 * Get actual project path from project name
 */
async function getProjectPath(projectName) {
  try {
    return await extractProjectDirectory(projectName);
  } catch (error) {
    console.error(`Error extracting project directory for ${projectName}:`, error);
    return projectName.replace(/-/g, '/');
  }
}

/**
 * Validate branch name
 */
function validateBranchName(branchName) {
  // Branch name rules:
  // - No spaces
  // - No special chars except / - _
  // - Max 100 chars
  // - Start with letter or number
  const regex = /^[a-zA-Z0-9][a-zA-Z0-9\/_-]{0,99}$/;
  return regex.test(branchName);
}

/**
 * POST /api/workflow/create-feature-branch
 *
 * Create a new feature branch
 * Body: { project: string, branchName: string, baseBranch?: string }
 */
router.post('/create-feature-branch', async (req, res) => {
  const { project, branchName, baseBranch } = req.body;

  if (!project || !branchName) {
    return res.status(400).json({
      error: 'Project name and branch name are required',
    });
  }

  // Validate branch name
  if (!validateBranchName(branchName)) {
    return res.status(400).json({
      error: 'Invalid branch name',
      details:
        'Branch name must start with letter/number and contain only letters, numbers, /, -, _',
    });
  }

  try {
    const projectPath = await getProjectPath(project);

    // Check if branch already exists
    try {
      const { stdout } = await execAsync('git branch --list', { cwd: projectPath });
      const branches = stdout
        .split('\n')
        .map((b) => b.trim().replace(/^\*\s+/, ''));

      if (branches.includes(branchName)) {
        return res.status(409).json({
          error: 'Branch already exists',
          code: 'BRANCH_EXISTS',
          branchName,
        });
      }
    } catch (error) {
      // If git command fails, continue anyway
      console.error('Error checking branches:', error);
    }

    // Get current branch if baseBranch not specified
    let base = baseBranch;
    if (!base) {
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
      });
      base = currentBranch.trim();
    }

    // Create and checkout new branch
    await execAsync(`git checkout -b "${branchName}" "${base}"`, { cwd: projectPath });

    res.json({
      success: true,
      branch: branchName,
      baseBranch: base,
      created: true,
      checkedOut: true,
    });
  } catch (error) {
    console.error('Error creating feature branch:', error);

    let errorMessage = 'Failed to create branch';
    let details = error.message;

    if (error.message.includes('already exists')) {
      errorMessage = 'Branch already exists';
    } else if (error.message.includes('not a git repository')) {
      errorMessage = 'Not a git repository';
      details = 'This directory is not a git repository. Initialize git first.';
    }

    res.status(500).json({
      error: errorMessage,
      details,
    });
  }
});

/**
 * POST /api/workflow/auto-commit
 *
 * Auto-commit changes with AI-generated message
 * Body: { project: string, runCI?: boolean, provider?: 'claude'|'cursor' }
 */
router.post('/auto-commit', async (req, res) => {
  const { project, runCI = true, provider = 'claude' } = req.body;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getProjectPath(project);

    // Get changed files
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: projectPath,
    });

    if (!statusOutput.trim()) {
      return res.json({
        success: false,
        error: 'No changes to commit',
        code: 'NO_CHANGES',
      });
    }

    const changedFiles = statusOutput
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => line.substring(3));

    // Run CI if requested
    let ciResults = null;
    if (runCI) {
      const runner = new TestRunner({ cwd: projectPath });
      ciResults = await runner.runAll();

      if (!ciResults.passed) {
        return res.json({
          success: false,
          ciPassed: false,
          ciResults: ciResults.results,
          message: 'Cannot commit - CI tests failed',
          code: 'CI_FAILED',
        });
      }
    }

    // Get diffs for AI
    let diffContext = '';
    for (const file of changedFiles) {
      try {
        const { stdout: diff } = await execAsync(`git diff HEAD -- "${file}"`, {
          cwd: projectPath,
        });
        if (diff) {
          diffContext += `\n--- ${file} ---\n${diff.substring(0, 1000)}`;
        }
      } catch (error) {
        // Might be untracked file
        try {
          const content = await fs.readFile(path.join(projectPath, file), 'utf-8');
          diffContext += `\n--- ${file} (new file) ---\n${content.substring(0, 1000)}`;
        } catch (e) {
          // Skip this file
        }
      }
    }

    // Generate commit message using AI
    const commitMessage = await generateCommitMessage(
      changedFiles,
      diffContext,
      provider,
      projectPath
    );

    // Stage all files
    await execAsync('git add -A', { cwd: projectPath });

    // Commit with AI-generated message
    const safeMessage = commitMessage.replace(/"/g, '\\"');
    const { stdout: commitOutput } = await execAsync(
      `git commit -m "${safeMessage}"`,
      { cwd: projectPath }
    );

    // Get commit hash
    const { stdout: commitHash } = await execAsync('git rev-parse --short HEAD', {
      cwd: projectPath,
    });

    res.json({
      success: true,
      ciPassed: runCI ? true : null,
      ciResults: ciResults?.results,
      commitHash: commitHash.trim(),
      commitMessage,
      filesCommitted: changedFiles.length,
      output: commitOutput,
    });
  } catch (error) {
    console.error('Error auto-committing:', error);
    res.status(500).json({
      error: 'Failed to commit',
      details: error.message,
    });
  }
});

/**
 * POST /api/workflow/create-pr
 *
 * Create a pull request using gh CLI
 * Body: { project: string, branch?: string, baseBranch?: string, title?: string, body?: string, draft?: boolean }
 */
router.post('/create-pr', async (req, res) => {
  const { project, branch, baseBranch = 'main', title, body, draft = false } = req.body;

  if (!project) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  try {
    const projectPath = await getProjectPath(project);

    // Check if gh CLI is installed
    try {
      await execAsync('which gh || where gh');
    } catch (error) {
      return res.status(400).json({
        error: 'GitHub CLI not installed',
        code: 'GH_NOT_INSTALLED',
        installUrl: 'https://cli.github.com/',
        installCommand: {
          macos: 'brew install gh',
          linux: 'curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg',
          windows: 'Download from https://cli.github.com/',
        },
      });
    }

    // Get current branch if not specified
    let currentBranch = branch;
    if (!currentBranch) {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
      });
      currentBranch = stdout.trim();
    }

    // Check if branch is pushed to remote
    let isPushed = false;
    try {
      await execAsync(`git rev-parse origin/${currentBranch}`, { cwd: projectPath });
      isPushed = true;
    } catch (error) {
      // Branch not on remote, need to push
    }

    // Push branch if not already pushed
    if (!isPushed) {
      try {
        // Try to push with retry logic
        for (let i = 0; i < 4; i++) {
          try {
            await execAsync(`git push -u origin ${currentBranch}`, {
              cwd: projectPath,
              timeout: 30000,
            });
            isPushed = true;
            break;
          } catch (pushError) {
            if (i < 3) {
              // Wait with exponential backoff
              const delay = Math.pow(2, i + 1) * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
            } else {
              throw pushError;
            }
          }
        }
      } catch (pushError) {
        return res.status(500).json({
          error: 'Failed to push branch',
          details: pushError.message,
          code: 'PUSH_FAILED',
        });
      }
    }

    // Generate PR title and body if not provided
    let prTitle = title;
    let prBody = body;

    if (!prTitle || !prBody) {
      const generated = await generatePRContent(currentBranch, projectPath);
      prTitle = prTitle || generated.title;
      prBody = prBody || generated.body;
    }

    // Create PR using gh CLI
    const draftFlag = draft ? '--draft' : '';
    const prCommand = `gh pr create --title "${prTitle.replace(/"/g, '\\"')}" --body "${prBody.replace(/"/g, '\\"')}" --base ${baseBranch} ${draftFlag}`;

    const { stdout: prOutput } = await execAsync(prCommand, { cwd: projectPath });

    // Extract PR URL from output
    const prUrlMatch = prOutput.match(/(https:\/\/github\.com\/[^\s]+)/);
    const prUrl = prUrlMatch ? prUrlMatch[1] : null;

    // Extract PR number
    const prNumberMatch = prUrl?.match(/\/pull\/(\d+)/);
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1], 10) : null;

    res.json({
      success: true,
      prUrl,
      prNumber,
      title: prTitle,
      body: prBody,
      branch: currentBranch,
      baseBranch,
      branchPushed: true,
      draft,
    });
  } catch (error) {
    console.error('Error creating PR:', error);

    let errorMessage = 'Failed to create PR';
    let details = error.message;
    let code = 'PR_CREATE_FAILED';

    if (error.message.includes('not found')) {
      errorMessage = 'GitHub CLI not configured';
      details = 'Run "gh auth login" to authenticate';
      code = 'GH_NOT_AUTHENTICATED';
    } else if (error.message.includes('403')) {
      errorMessage = 'Permission denied';
      details = 'You do not have permission to create PRs in this repository';
      code = 'PERMISSION_DENIED';
    }

    res.status(500).json({
      error: errorMessage,
      details,
      code,
    });
  }
});

/**
 * POST /api/workflow/run-complete
 *
 * Run complete workflow: branch → code → test → commit → PR
 * Body: { project: string, branchName: string, skipCI?: boolean }
 */
router.post('/run-complete', async (req, res) => {
  const { project, branchName, skipCI = false } = req.body;

  if (!project || !branchName) {
    return res.status(400).json({
      error: 'Project name and branch name are required',
    });
  }

  const workflowId = `workflow-${randomUUID()}`;
  const wss = req.app.get('wss');

  const workflow = {
    id: workflowId,
    project,
    status: 'running',
    startedAt: new Date().toISOString(),
    steps: [],
  };

  activeWorkflows.set(workflowId, workflow);

  // Send progress update
  const sendProgress = (step, data = {}) => {
    if (!wss || !wss.clients) return;

    wss.clients.forEach((client) => {
      if (client.readyState === 1) {
        try {
          client.send(
            JSON.stringify({
              type: 'workflow-progress',
              workflowId,
              step,
              ...data,
            })
          );
        } catch (error) {
          console.error('Error sending workflow progress:', error);
        }
      }
    });
  };

  // Run workflow in background
  (async () => {
    try {
      const projectPath = await getProjectPath(project);

      // Step 1: Create branch
      sendProgress('creating-branch', { branchName });
      const { stdout: currentBranch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectPath,
      });
      await execAsync(`git checkout -b "${branchName}" "${currentBranch.trim()}"`, {
        cwd: projectPath,
      });
      workflow.steps.push({ step: 'branch-created', branch: branchName });
      sendProgress('branch-created', { branch: branchName });

      // Step 2: Wait for user to make changes (this workflow assumes changes are already made)
      // In practice, this would be triggered after AI makes changes

      // Step 3: Run CI (optional)
      if (!skipCI) {
        sendProgress('ci-running');
        const runner = new TestRunner({ cwd: projectPath });

        runner.on('progress', (progress) => {
          sendProgress('ci-progress', progress);
        });

        const ciResults = await runner.runAll();
        workflow.steps.push({ step: 'ci-complete', passed: ciResults.passed });

        if (!ciResults.passed) {
          sendProgress('ci-failed', { results: ciResults });
          workflow.status = 'failed';
          workflow.error = 'CI tests failed';
          return;
        }

        sendProgress('ci-passed', { duration: ciResults.duration });
      }

      // Step 4: Auto-commit
      sendProgress('committing');
      // Check if there are changes
      const { stdout: statusOutput } = await execAsync('git status --porcelain', {
        cwd: projectPath,
      });

      if (statusOutput.trim()) {
        const changedFiles = statusOutput
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => line.substring(3));

        // Get diffs
        let diffContext = '';
        for (const file of changedFiles.slice(0, 5)) {
          // Limit to 5 files
          try {
            const { stdout: diff } = await execAsync(`git diff HEAD -- "${file}"`, {
              cwd: projectPath,
            });
            diffContext += `\n--- ${file} ---\n${diff.substring(0, 500)}`;
          } catch (error) {
            // Skip
          }
        }

        const commitMessage = await generateCommitMessage(
          changedFiles,
          diffContext,
          'claude',
          projectPath
        );

        await execAsync('git add -A', { cwd: projectPath });
        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
          cwd: projectPath,
        });

        const { stdout: commitHash } = await execAsync('git rev-parse --short HEAD', {
          cwd: projectPath,
        });

        workflow.steps.push({ step: 'committed', hash: commitHash.trim() });
        sendProgress('committed', { hash: commitHash.trim(), message: commitMessage });
      } else {
        workflow.steps.push({ step: 'no-changes' });
        sendProgress('no-changes');
      }

      // Step 5: Create PR
      sendProgress('creating-pr');
      // Push branch
      await execAsync(`git push -u origin ${branchName}`, { cwd: projectPath });

      // Generate PR content
      const prContent = await generatePRContent(branchName, projectPath);

      // Create PR
      const { stdout: prOutput } = await execAsync(
        `gh pr create --title "${prContent.title.replace(/"/g, '\\"')}" --body "${prContent.body.replace(/"/g, '\\"')}" --base main`,
        { cwd: projectPath }
      );

      const prUrlMatch = prOutput.match(/(https:\/\/github\.com\/[^\s]+)/);
      const prUrl = prUrlMatch ? prUrlMatch[1] : null;

      workflow.steps.push({ step: 'pr-created', prUrl });
      workflow.status = 'complete';
      sendProgress('workflow-complete', { prUrl });

      res.json({
        success: true,
        workflowId,
        prUrl,
        steps: workflow.steps,
      });
    } catch (error) {
      console.error('Workflow error:', error);
      workflow.status = 'failed';
      workflow.error = error.message;
      sendProgress('workflow-error', { error: error.message });

      res.status(500).json({
        error: 'Workflow failed',
        details: error.message,
        workflowId,
      });
    }
  })();

  // Return immediately with workflow ID
  res.json({
    workflowId,
    status: 'running',
    startedAt: workflow.startedAt,
  });
});

/**
 * Generate commit message using AI
 * @private
 */
async function generateCommitMessage(files, diffContext, provider, projectPath) {
  const prompt = `Generate a conventional commit message for these changes.

REQUIREMENTS:
- Format: type(scope): subject
- Include body explaining what changed and why
- Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore
- Subject under 50 chars, body wrapped at 72 chars
- Focus on user-facing changes
- Return ONLY the commit message (no markdown, explanations, or code blocks)

FILES CHANGED:
${files.slice(0, 10).map((f) => `- ${f}`).join('\n')}

DIFFS:
${diffContext.substring(0, 3000)}

Generate the commit message:`;

  try {
    let responseText = '';
    const writer = {
      send: (data) => {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;

          if (parsed.type === 'claude-response' && parsed.data) {
            const message = parsed.data.message || parsed.data;
            if (message.content && Array.isArray(message.content)) {
              for (const item of message.content) {
                if (item.type === 'text' && item.text) {
                  responseText += item.text;
                }
              }
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      },
      setSessionId: () => {},
    };

    await queryClaudeSDK(
      prompt,
      {
        cwd: projectPath,
        permissionMode: 'bypassPermissions',
        model: 'sonnet',
      },
      writer
    );

    // Clean up the response
    let cleaned = responseText.trim();
    cleaned = cleaned.replace(/```[a-z]*\n/g, '');
    cleaned = cleaned.replace(/```/g, '');
    cleaned = cleaned.replace(/^#+\s*/gm, '');
    cleaned = cleaned.replace(/^["']|["']$/g, '');

    // Find conventional commit pattern
    const conventionalMatch = cleaned.match(
      /(feat|fix|docs|style|refactor|perf|test|build|ci|chore)(\(.+?\))?:.+/s
    );
    if (conventionalMatch) {
      cleaned = cleaned.substring(cleaned.indexOf(conventionalMatch[0]));
    }

    return cleaned.trim() || `chore: update ${files.length} file${files.length !== 1 ? 's' : ''}`;
  } catch (error) {
    console.error('Error generating commit message:', error);
    return `chore: update ${files.length} file${files.length !== 1 ? 's' : ''}`;
  }
}

/**
 * Generate PR title and body using AI
 * @private
 */
async function generatePRContent(branchName, projectPath) {
  const prompt = `Generate a pull request title and description for a branch named "${branchName}".

REQUIREMENTS:
- Title: Clear, concise summary (max 72 chars)
- Description: Include sections: Summary, Changes, Testing
- Use markdown formatting
- Focus on what and why, not how
- Return in format:
  TITLE: <title here>
  BODY:
  <body here>

Generate the PR content:`;

  try {
    let responseText = '';
    const writer = {
      send: (data) => {
        try {
          const parsed = typeof data === 'string' ? JSON.parse(data) : data;
          if (parsed.type === 'claude-response' && parsed.data) {
            const message = parsed.data.message || parsed.data;
            if (message.content && Array.isArray(message.content)) {
              for (const item of message.content) {
                if (item.type === 'text' && item.text) {
                  responseText += item.text;
                }
              }
            }
          }
        } catch (e) {
          // Ignore
        }
      },
      setSessionId: () => {},
    };

    await queryClaudeSDK(
      prompt,
      {
        cwd: projectPath,
        permissionMode: 'bypassPermissions',
        model: 'sonnet',
      },
      writer
    );

    // Parse response
    const titleMatch = responseText.match(/TITLE:\s*(.+)/i);
    const bodyMatch = responseText.match(/BODY:\s*([\s\S]+)/i);

    const title = titleMatch
      ? titleMatch[1].trim()
      : branchName.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());

    const body = bodyMatch
      ? bodyMatch[1].trim()
      : `## Summary\nChanges from branch: ${branchName}\n\n## Testing\n- [ ] Tests pass locally`;

    return { title, body };
  } catch (error) {
    console.error('Error generating PR content:', error);
    return {
      title: branchName.replace(/[-_]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      body: `## Summary\nChanges from branch: ${branchName}\n\n## Testing\n- [ ] Tests pass locally`,
    };
  }
}

export default router;
