#!/usr/bin/env node

/**
 * WebSocket Testing Script
 * Tests real-time CI progress updates via WebSocket
 */

import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3001/ws';
const API_URL = 'http://localhost:3001';
const PROJECT_NAME = 'claudecodeui';

console.log('\n🧪 WebSocket Testing Script\n');
console.log('═══════════════════════════════════════\n');

// Connect to WebSocket
console.log('📡 Connecting to WebSocket:', WS_URL);
const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log('✅ WebSocket connected\n');

  // Trigger a CI run via HTTP to generate WebSocket messages
  console.log('🚀 Triggering CI run to test real-time updates...');

  fetch(`${API_URL}/api/ci/run-single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project: PROJECT_NAME,
      test: 'lint',
    }),
  })
    .then(res => res.json())
    .then(data => {
      console.log('✅ CI run started:', data.runId);
      console.log('\n📊 Listening for WebSocket updates...\n');
    })
    .catch(err => {
      console.error('❌ Error starting CI run:', err.message);
      process.exit(1);
    });
});

ws.on('message', data => {
  try {
    const message = JSON.parse(data.toString());

    // Filter for CI-related messages
    if (message.type?.startsWith('ci-')) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📨 Message Type:', message.type);
      console.log('🔍 Data:', JSON.stringify(message, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Exit on completion
      if (message.type === 'ci-complete') {
        console.log('✅ CI run completed!');
        console.log('📊 Results:', message.passed ? '✅ PASSED' : '❌ FAILED');
        console.log('⏱️  Duration:', message.duration, 'ms');

        setTimeout(() => {
          console.log('\n✅ WebSocket test complete!');
          ws.close();
          process.exit(0);
        }, 1000);
      }

      if (message.type === 'ci-error') {
        console.log('❌ CI run error:', message.error);
        setTimeout(() => {
          ws.close();
          process.exit(1);
        }, 1000);
      }
    }
  } catch (err) {
    console.error('❌ Error parsing message:', err.message);
  }
});

ws.on('error', error => {
  console.error('❌ WebSocket error:', error.message);
  console.log('\n💡 Make sure the server is running: npm run server');
  process.exit(1);
});

ws.on('close', () => {
  console.log('\n📡 WebSocket disconnected');
});

// Timeout after 60 seconds
setTimeout(() => {
  console.log('\n⏱️  Timeout: No CI completion message received');
  console.log('💡 This might mean the CI run is still in progress or failed');
  ws.close();
  process.exit(0);
}, 60000);
