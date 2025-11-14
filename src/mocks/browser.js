import { setupWorker } from 'msw/browser';
import { handlers, websocketHandlers } from './handlers';

// Setup MSW worker for browser environment
export const worker = setupWorker(...handlers, ...websocketHandlers.map(handler => ({
  ...handler,
  // Convert string channel to URL pattern for MSW
  channel: new URL(handler.channel)
})));

// Enable service worker in development
if (process.env.NODE_ENV === 'development') {
  worker.start({
    onUnhandledRequest: 'warn',
    serviceWorker: {
      url: '/mockServiceWorker.js'
    }
  });
}

export default worker;