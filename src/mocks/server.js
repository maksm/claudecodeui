import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server for Node.js (testing) environment
export const server = setupServer(...handlers);

// Start server in test environment if needed
if (process.env.NODE_ENV === 'test') {
  server.listen({
    onUnhandledRequest: 'error',
  });
}

export default server;
