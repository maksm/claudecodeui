#!/usr/bin/env node

/**
 * Interactive setup script for Claude Code UI
 * Guides users through initial project setup
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { spawn } from 'child_process';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

const c = {
  info: text => `${colors.cyan}${text}${colors.reset}`,
  ok: text => `${colors.green}${text}${colors.reset}`,
  warn: text => `${colors.yellow}${text}${colors.reset}`,
  error: text => `${colors.red}${text}${colors.reset}`,
  tip: text => `${colors.blue}${text}${colors.reset}`,
  bright: text => `${colors.bright}${text}${colors.reset}`,
  dim: text => `${colors.dim}${text}${colors.reset}`,
};

// Helper to prompt user for input
function question(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(query, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Check Node version
function checkNodeVersion() {
  console.log(c.info('[INFO]') + ' Checking Node.js version...');

  const nvmrcPath = path.join(projectRoot, '.nvmrc');
  if (!fs.existsSync(nvmrcPath)) {
    console.log(c.warn('[WARN]') + ' .nvmrc file not found, skipping version check');
    return true;
  }

  const requiredVersion = fs.readFileSync(nvmrcPath, 'utf8').trim();
  const currentVersion = process.version;

  console.log(`       Current: ${currentVersion}`);
  console.log(`       Required: ${requiredVersion}`);

  if (currentVersion !== requiredVersion) {
    console.log('');
    console.log(c.warn('[WARN]') + ` Node.js version mismatch!`);
    console.log(
      `       ${c.dim('Consider using nvm to switch: nvm use ' + requiredVersion.replace('v', ''))}`
    );
    console.log('');
  } else {
    console.log(`       ${c.ok('✓')} Node.js version matches!`);
    console.log('');
  }

  return true;
}

// Check if CLI is available
function checkCliAvailable(cliName) {
  return new Promise(resolve => {
    const proc = spawn(cliName, ['--version'], {
      stdio: 'ignore',
      shell: true,
    });

    proc.on('error', () => resolve(false));
    proc.on('close', code => resolve(code === 0));

    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}

// Create .env file from .env.example
async function setupEnvFile() {
  console.log(c.info('[INFO]') + ' Setting up environment configuration...');
  console.log('');

  const envPath = path.join(projectRoot, '.env');
  const envExamplePath = path.join(projectRoot, '.env.example');

  // Check if .env already exists
  if (fs.existsSync(envPath)) {
    console.log(c.info('[INFO]') + ' .env file already exists');
    const overwrite = await question(
      c.bright('       Do you want to reconfigure it? (y/N): ')
    );

    if (overwrite.toLowerCase() !== 'y') {
      console.log(c.info('[INFO]') + ' Keeping existing .env file');
      console.log('');
      return;
    }
  }

  // Copy .env.example to .env
  if (fs.existsSync(envExamplePath)) {
    fs.copyFileSync(envExamplePath, envPath);
    console.log(c.ok('[SUCCESS]') + ' Created .env file from .env.example');
  } else {
    console.log(c.warn('[WARN]') + ' .env.example not found, creating minimal .env');
    fs.writeFileSync(envPath, '# Claude Code UI Environment Configuration\n\n');
  }

  console.log('');
  console.log(c.bright('Let\'s configure your environment:'));
  console.log(c.dim('(Press Enter to use default values)'));
  console.log('');

  // Read existing .env content
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Helper to update or add env variable
  function updateEnvVar(key, value) {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(envContent)) {
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      envContent += `\n${key}=${value}`;
    }
  }

  // 1. Configure PORT
  const port = await question(c.bright('1. Backend server port (default: 3001): '));
  const portValue = port || '3001';
  updateEnvVar('PORT', portValue);

  // 2. Configure VITE_PORT
  const vitePort = await question(c.bright('2. Frontend dev server port (default: 5173): '));
  const vitePortValue = vitePort || '5173';
  updateEnvVar('VITE_PORT', vitePortValue);

  // 3. Configure DEFAULT_PROVIDER
  console.log('');
  console.log(c.bright('3. Choose your AI provider:'));
  console.log('   1) Claude (default)');
  console.log('   2) Cursor');
  console.log('   3) Zai');
  const providerChoice = await question(c.bright('   Enter choice (1-3, default: 1): '));

  let provider = 'claude';
  if (providerChoice === '2') provider = 'cursor';
  else if (providerChoice === '3') provider = 'zai';

  updateEnvVar('DEFAULT_PROVIDER', provider);

  // 4. Configure CLI path if needed
  if (provider === 'claude') {
    console.log('');
    const cliPath = await question(
      c.bright('4. Claude CLI path (default: claude): ')
    );
    const cliPathValue = cliPath || 'claude';
    updateEnvVar('CLAUDE_CLI_PATH', cliPathValue);

    // Check if Claude CLI is available
    const claudeAvailable = await checkCliAvailable(cliPathValue);
    if (!claudeAvailable) {
      console.log('');
      console.log(
        c.warn('[WARN]') +
          ` Claude CLI not found at "${cliPathValue}"`
      );
      console.log(
        '       ' +
          c.dim('Make sure Claude CLI is installed: https://github.com/anthropics/claude-cli')
      );
      console.log('');
    } else {
      console.log(`       ${c.ok('✓')} Claude CLI is available`);
    }
  } else if (provider === 'cursor') {
    // Check if Cursor CLI is available
    const cursorAvailable = await checkCliAvailable('cursor');
    if (!cursorAvailable) {
      console.log('');
      console.log(c.warn('[WARN]') + ' Cursor CLI not found');
      console.log(
        '       ' + c.dim('Make sure Cursor is installed and "cursor" command is in your PATH')
      );
      console.log('');
    } else {
      console.log(`       ${c.ok('✓')} Cursor CLI is available`);
    }
  } else if (provider === 'zai') {
    console.log('');
    const zaiKey = await question(c.bright('4. Zai API key: '));
    if (zaiKey) {
      updateEnvVar('ZAI_API_KEY', zaiKey);

      const zaiUrl = await question(
        c.bright('5. Zai base URL (default: https://api.zai.com/v1): ')
      );
      updateEnvVar('ZAI_BASE_URL', zaiUrl || 'https://api.zai.com/v1');

      const zaiModel = await question(
        c.bright('6. Zai model (default: claude-sonnet-4-20250514): ')
      );
      updateEnvVar('ZAI_MODEL', zaiModel || 'claude-sonnet-4-20250514');
    } else {
      console.log(c.warn('[WARN]') + ' No Zai API key provided - Zai provider may not work');
    }
  }

  // 5. Context window
  console.log('');
  const contextWindow = await question(
    c.bright('Context window size (default: 160000): ')
  );
  const contextValue = contextWindow || '160000';
  updateEnvVar('CONTEXT_WINDOW', contextValue);
  updateEnvVar('VITE_CONTEXT_WINDOW', contextValue);

  // Write updated .env file
  fs.writeFileSync(envPath, envContent);

  console.log('');
  console.log(c.ok('[SUCCESS]') + ' Environment configuration saved to .env');
  console.log('');
}

// Check if npm install is needed
function checkNpmInstall() {
  console.log(c.info('[INFO]') + ' Checking dependencies...');

  const nodeModulesPath = path.join(projectRoot, 'node_modules');
  const packageLockPath = path.join(projectRoot, 'package-lock.json');

  if (!fs.existsSync(nodeModulesPath)) {
    console.log(c.warn('[WARN]') + ' node_modules not found');
    return true;
  }

  if (!fs.existsSync(packageLockPath)) {
    console.log(c.warn('[WARN]') + ' package-lock.json not found');
    return true;
  }

  // Check if package-lock.json is newer than node_modules
  const nodeModulesStats = fs.statSync(nodeModulesPath);
  const packageLockStats = fs.statSync(packageLockPath);

  if (packageLockStats.mtime > nodeModulesStats.mtime) {
    console.log(c.warn('[WARN]') + ' Dependencies may be outdated');
    return true;
  }

  console.log(`       ${c.ok('✓')} Dependencies are up to date`);
  console.log('');
  return false;
}

// Run npm install
function runNpmInstall() {
  return new Promise((resolve, reject) => {
    console.log(c.info('[INFO]') + ' Running npm install...');
    console.log('');

    const proc = spawn('npm', ['install'], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
    });

    proc.on('close', code => {
      if (code === 0) {
        console.log('');
        console.log(c.ok('[SUCCESS]') + ' Dependencies installed');
        console.log('');
        resolve();
      } else {
        console.log('');
        console.log(c.error('[ERROR]') + ' npm install failed');
        console.log('');
        reject(new Error('npm install failed'));
      }
    });

    proc.on('error', err => {
      console.log('');
      console.log(c.error('[ERROR]') + ' Failed to run npm install: ' + err.message);
      console.log('');
      reject(err);
    });
  });
}

// Main setup function
async function setup() {
  console.log('');
  console.log(c.dim('═'.repeat(63)));
  console.log(`  ${c.bright('Claude Code UI - Setup Wizard')}`);
  console.log(c.dim('═'.repeat(63)));
  console.log('');

  try {
    // 1. Check Node version
    checkNodeVersion();

    // 2. Setup .env file
    await setupEnvFile();

    // 3. Check and install dependencies
    const needsInstall = checkNpmInstall();
    if (needsInstall) {
      const install = await question(
        c.bright('Run npm install now? (Y/n): ')
      );

      if (install.toLowerCase() !== 'n') {
        await runNpmInstall();
      } else {
        console.log(c.warn('[WARN]') + ' Skipping npm install');
        console.log('       ' + c.dim('Run "npm install" manually before starting the server'));
        console.log('');
      }
    }

    // 4. Show next steps
    console.log(c.dim('═'.repeat(63)));
    console.log(`  ${c.bright('Setup Complete!')}`);
    console.log(c.dim('═'.repeat(63)));
    console.log('');
    console.log(c.tip('[NEXT STEPS]'));
    console.log('');
    console.log(`  ${c.bright('1.')} Start development server:`);
    console.log(`     ${c.dim('npm run dev')}`);
    console.log('');
    console.log(`  ${c.bright('2.')} Access the UI:`);
    console.log(`     ${c.dim('http://localhost:' + (process.env.PORT || '3001'))}`);
    console.log('');
    console.log(`  ${c.bright('3.')} Check configuration:`);
    console.log(`     ${c.dim('cloudcli status')}`);
    console.log('');
    console.log(c.dim('═'.repeat(63)));
    console.log('');
  } catch (error) {
    console.log('');
    console.log(c.error('[ERROR]') + ' Setup failed: ' + error.message);
    console.log('');
    process.exit(1);
  }
}

// Run setup
setup();
