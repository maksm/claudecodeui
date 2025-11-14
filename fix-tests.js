#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// List of test files to fix
const testFiles = [
  'tests/frontend/components/ChatInterface.test.jsx',
  'tests/frontend/components/FileTree.test.jsx',
  'tests/frontend/components/Shell.test.jsx',
  'tests/frontend/components/Settings.test.jsx',
  'tests/frontend/components/Sidebar.test.jsx',
];

testFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    console.log(`Fixing ${filePath}...`);

    let content = fs.readFileSync(filePath, 'utf8');

    // Replace imports
    content = content.replace(
      "import { vi, describe, it, expect, beforeEach, afterEach } from '@jest/globals';",
      "import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';"
    );

    // Replace vi.mock with jest.mock
    content = content.replace(/\bvi\./g, 'jest.');
    content = content.replace(/\bvi\(/g, 'jest(');
    content = content.replace(/\bvi\.mock\(/g, 'jest.mock(');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${filePath}`);
  } else {
    console.log(`File not found: ${filePath}`);
  }
});

console.log('Done fixing test files!');
