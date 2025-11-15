import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import net from 'net';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

const c = {
  error: text => `${colors.red}${text}${colors.reset}`,
  ok: text => `${colors.green}${text}${colors.reset}`,
  warn: text => `${colors.yellow}${text}${colors.reset}`,
  info: text => `${colors.cyan}${text}${colors.reset}`,
  bright: text => `${colors.bright}${text}${colors.reset}`,
};

/**
 * Check if a CLI command is available and executable
 */
async function checkCliAvailable(cliPath) {
  return new Promise(resolve => {
    const proc = spawn(cliPath, ['--version'], {
      stdio: 'ignore',
      shell: true,
    });

    proc.on('error', () => resolve(false));
    proc.on('close', code => resolve(code === 0));

    // Timeout after 5 seconds
    setTimeout(() => {
      proc.kill();
      resolve(false);
    }, 5000);
  });
}

/**
 * Check if a port is available
 */
async function checkPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer();

    server.once('error', err => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(true);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '0.0.0.0');
  });
}

/**
 * Check if a directory exists and is writable
 */
async function checkDirectoryWritable(dirPath) {
  try {
    // Try to create directory if it doesn't exist
    await fs.mkdir(dirPath, { recursive: true });

    // Try to write a test file
    const testFile = path.join(dirPath, '.write-test');
    await fs.writeFile(testFile, 'test');
    await fs.unlink(testFile);

    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Validate environment configuration before server starts
 * Returns { valid: boolean, errors: string[], warnings: string[] }
 */
export async function validateEnvironment() {
  const errors = [];
  const warnings = [];

  console.log('');
  console.log(c.info('[INFO]') + ' Validating environment configuration...');
  console.log('');

  // 1. Check PORT
  const port = process.env.PORT || 3001;
  const portNum = parseInt(port, 10);

  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    errors.push(`Invalid PORT value: ${port}. Must be between 1 and 65535.`);
  } else {
    const portAvailable = await checkPortAvailable(portNum);
    if (!portAvailable) {
      errors.push(
        `Port ${portNum} is already in use. Please choose a different PORT in your .env file.`
      );
    } else {
      console.log(`  ${c.ok('✓')} Port ${portNum} is available`);
    }
  }

  // 2. Check CLAUDE_CLI_PATH or DEFAULT_PROVIDER
  const provider = process.env.DEFAULT_PROVIDER || 'claude';
  const claudeCliPath = process.env.CLAUDE_CLI_PATH || 'claude';

  if (provider === 'claude' || provider === 'cursor') {
    const cliPath = provider === 'claude' ? claudeCliPath : 'cursor';
    const cliAvailable = await checkCliAvailable(cliPath);

    if (!cliAvailable) {
      warnings.push(
        `${provider.toUpperCase()} CLI not found at "${cliPath}". ` +
          `Make sure it's installed and in your PATH, or set CLAUDE_CLI_PATH/CURSOR_CLI_PATH in .env`
      );
      console.log(
        `  ${c.warn('⚠')} ${provider.toUpperCase()} CLI not found (${cliPath}) - some features may not work`
      );
    } else {
      console.log(`  ${c.ok('✓')} ${provider.toUpperCase()} CLI is available (${cliPath})`);
    }
  } else if (provider === 'zai') {
    // For Zai, check API key
    if (!process.env.ZAI_API_KEY) {
      warnings.push('ZAI_API_KEY not set. Zai provider requires an API key in .env file.');
      console.log(`  ${c.warn('⚠')} ZAI_API_KEY not set - Zai provider may not work`);
    } else {
      console.log(`  ${c.ok('✓')} ZAI_API_KEY is configured`);
    }
  }

  // 3. Check database directory is writable
  const dbPath = process.env.DATABASE_PATH || path.join(os.homedir(), '.claude', 'auth.db');
  const dbDir = path.dirname(dbPath);

  const dbDirWritable = await checkDirectoryWritable(dbDir);
  if (!dbDirWritable) {
    errors.push(`Database directory is not writable: ${dbDir}`);
  } else {
    console.log(`  ${c.ok('✓')} Database directory is writable (${dbDir})`);
  }

  // 4. Check .claude directory for projects
  const claudeDir = path.join(os.homedir(), '.claude');
  const claudeDirExists = await checkDirectoryWritable(claudeDir);
  if (!claudeDirExists) {
    warnings.push(
      `Claude directory does not exist or is not writable: ${claudeDir}. ` +
        `It will be created automatically.`
    );
    console.log(`  ${c.warn('⚠')} Claude directory will be created (${claudeDir})`);
  } else {
    console.log(`  ${c.ok('✓')} Claude directory is accessible (${claudeDir})`);
  }

  // 5. Check context window setting
  const contextWindow = parseInt(process.env.CONTEXT_WINDOW || '160000', 10);
  if (isNaN(contextWindow) || contextWindow < 1000) {
    warnings.push(
      `Invalid CONTEXT_WINDOW value: ${process.env.CONTEXT_WINDOW}. Using default: 160000`
    );
  }

  console.log('');

  // Display validation results
  if (errors.length > 0) {
    console.log(c.error('[ERROR]') + ' Environment validation failed:');
    console.log('');
    errors.forEach(err => {
      console.log(`  ${c.error('✗')} ${err}`);
    });
    console.log('');
  }

  if (warnings.length > 0 && errors.length === 0) {
    console.log(c.warn('[WARN]') + ' Environment validation warnings:');
    console.log('');
    warnings.forEach(warn => {
      console.log(`  ${c.warn('⚠')} ${warn}`);
    });
    console.log('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log(c.ok('[SUCCESS]') + ' All environment checks passed!');
    console.log('');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
