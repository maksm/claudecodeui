// GitHub PR detection utility functions
export async function getGitHubPRInfo(projectPath, branch) {
  try {
    // Get remote URL to determine GitHub repo
    let repoUrl = null;
    let repoOwner = null;
    let repoName = null;

    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout: remoteUrlOutput } = await execAsync('git remote get-url origin', {
        cwd: projectPath,
      });
      repoUrl = remoteUrlOutput.trim();

      // Parse GitHub URL to extract owner and repo name
      const githubUrlMatch = repoUrl.match(/github\.com[/:]([^/]+)\/(.+?)(\.git)?$/);
      if (githubUrlMatch) {
        repoOwner = githubUrlMatch[1];
        repoName = githubUrlMatch[2].replace('.git', '');
      }
    } catch {
      return { hasPR: false, error: 'No GitHub remote configured' };
    }

    if (!repoOwner || !repoName) {
      return { hasPR: false, error: 'Not a GitHub repository' };
    }

    // Try to use GitHub CLI first (more reliable)
    let prInfo = null;
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      const { stdout: ghPrOutput } = await execAsync(
        `gh pr view --json url,number,state,headRefName --repo ${repoOwner}/${repoName} ${branch}`,
        { cwd: projectPath }
      );

      if (ghPrOutput) {
        const prData = JSON.parse(ghPrOutput);
        if (prData.state === 'OPEN') {
          prInfo = {
            url: prData.url,
            number: prData.number,
            headRefName: prData.headRefName,
          };
        }
      }
    } catch {
      // GitHub CLI not available or failed, create a fallback URL
      console.log('GitHub CLI not available, using fallback URL construction');

      // Construct potential PR URL (user would need to verify if PR exists)
      prInfo = {
        url: `https://github.com/${repoOwner}/${repoName}/pulls`,
        number: null,
        headRefName: branch,
        isPotential: true,
      };
    }

    if (prInfo) {
      return {
        hasPR: true,
        repoUrl,
        repoOwner,
        repoName,
        pr: prInfo,
      };
    } else {
      return {
        hasPR: false,
        repoUrl,
        repoOwner,
        repoName,
      };
    }
  } catch (error) {
    return {
      hasPR: false,
      error: error.message,
    };
  }
}
